/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createReceiptsRepository,
  createSessionLogsRepository,
  withTransaction,
  type Database,
} from "@ordah-please/db";
import * as schema from "@ordah-please/db";
import type { ReceiptStorage } from "@ordah-please/storage";
import {
  executeReceiptAction,
  cleanupReceiptObjects,
  type ReceiptRunner,
  type ReceiptView,
} from "./receipt-service";
let pool: Pool;
let db: Database;
const testSchema = `receipt_test_${randomUUID().replaceAll("-", "")}`;
let schemaCreated = false;
beforeAll(async () => {
  const raw = process.env.DATABASE_MIGRATION_URL;
  if (!raw) throw new Error("Development migration URL is required.");
  const url = new URL(raw);
  url.searchParams.set("sslmode", "verify-full");
  pool = new Pool({
    connectionString: url.toString(),
    max: 1,
    options: `-c search_path=${testSchema}`,
  });
  await pool.query(`CREATE SCHEMA "${testSchema}"`);
  schemaCreated = true;
  await pool.query(`SET search_path TO "${testSchema}"`);
  const directory = new URL(
    "../../../../../packages/db/drizzle/",
    import.meta.url,
  );
  for (const file of (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    const sql = (await readFile(new URL(file, directory), "utf8")).replaceAll(
      '"public".',
      `"${testSchema}".`,
    );
    for (const statement of sql
      .split("--> statement-breakpoint")
      .filter((part) => part.trim()))
      await pool.query(statement);
  }
  db = drizzle(pool, { schema });
}, 30_000);
afterAll(async () => {
  if (!pool) return;
  if (schemaCreated) {
    await pool.query("SET search_path TO public");
    await pool.query(`DROP SCHEMA "${testSchema}" CASCADE`);
  }
  await pool.end();
});
const storage: ReceiptStorage = {
  uploadUrl: async () => "https://example.test/upload",
  validateAndCopy: async () => {},
  downloadUrl: async () => "https://example.test/download",
  remove: async () => {},
};
async function fixture() {
  const owner = randomUUID(),
    member = randomUUID(),
    manager = randomUUID(),
    outsider = randomUUID();
  await db.insert(schema.users).values(
    [owner, member, manager, outsider].map((id) => ({
      id,
      displayName: id === owner ? "Owner" : "Participant",
    })),
  );
  const [group] = await db
    .insert(schema.groups)
    .values({ name: "Isolated receipt test", createdByUserId: owner })
    .returning();
  await db.insert(schema.memberships).values([
    { groupId: group!.id, userId: owner, role: "owner" },
    { groupId: group!.id, userId: member, role: "member" },
    { groupId: group!.id, userId: manager, role: "manager" },
  ]);
  const order = await createSessionLogsRepository(db).save({
    request: {
      groupId: group!.id,
      state: "ordered",
      restaurantId: null,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      managerUserId: owner,
      deliveryAddress: null,
      participants: [owner, member, manager].map((userId) => ({
        userId,
        displayName: userId === owner ? "Owner" : "Participant",
        foodResponse: "pending",
        lines: [],
      })),
    },
    restaurant: null,
    now: new Date(),
  });
  const runner: ReceiptRunner = {
    run: (operation) =>
      withTransaction(db, (tx) => operation(createReceiptsRepository(tx))),
  };
  const execute = (
    userId: string,
    action: string,
    input: unknown = {},
    receiptId?: string,
  ) =>
    executeReceiptAction(
      {
        orderId: order.id,
        userId,
        action,
        input,
        ...(receiptId ? { receiptId } : {}),
      },
      runner,
      () => storage,
    );
  const settings = (
    mode: "group" | "individual",
    enabled = true,
    submitterIds = [member],
  ) => execute(owner, "settings", { enabled, mode, submitterIds });
  const attach = async (userId: string, participantUserId?: string) => {
    const prepared = (await execute(userId, "prepare", {
      contentType: "image/png",
      sizeBytes: 8,
      amountCentavos: 12500,
      note: "Lunch",
      ...(participantUserId ? { participantUserId } : {}),
    })) as { uploadId: string };
    return execute(userId, "finalize", prepared) as Promise<{
      receiptId: string;
    }>;
  };
  return {
    owner,
    member,
    manager,
    outsider,
    order,
    group: group!,
    runner,
    execute,
    settings,
    attach,
  };
}
describe("isolated development receipt persistence", () => {
  it("persists a manager-controlled total independently of multiple receipts and enforces database limits", async () => {
    const f = await fixture();
    await f.execute(f.manager, "total", { sessionTotalCentavos: 76543 });
    await f.settings("group");
    await f.attach(f.member);
    await f.attach(f.owner);
    const view = (await f.execute(f.member, "list")) as ReceiptView;
    expect(view.sessionTotalCentavos).toBe(76543);
    expect(view.receipts.map((receipt) => receipt.amountCentavos)).toEqual([
      12500, 12500,
    ]);
    await expect(
      f.execute(f.member, "total", { sessionTotalCentavos: 1 }),
    ).rejects.toThrow();
    await f.settings("group", false);
    await f.execute(f.owner, "total", { sessionTotalCentavos: null });
    expect(
      ((await f.execute(f.member, "list")) as ReceiptView).sessionTotalCentavos,
    ).toBeNull();
    await expect(
      db
        .update(schema.orders)
        .set({ sessionTotalCentavos: -1 })
        .where(eq(schema.orders.id, f.order.id)),
    ).rejects.toThrow();
    await db
      .update(schema.memberships)
      .set({ removedAt: new Date() })
      .where(eq(schema.memberships.userId, f.manager));
    await expect(
      f.execute(f.manager, "total", { sessionTotalCentavos: 1 }),
    ).rejects.toThrow();
  });

  it("supports multiple receipts, self-only reads, owner assignment, and idempotent finalization", async () => {
    const f = await fixture();
    await f.settings("individual");
    const first = await f.attach(f.member);
    await f.attach(f.owner, f.owner);
    await f.attach(f.owner, f.member);
    expect(
      ((await f.execute(f.member, "list")) as ReceiptView).receipts,
    ).toHaveLength(2);
    expect(
      ((await f.execute(f.manager, "list")) as ReceiptView).receipts,
    ).toHaveLength(3);
    await expect(f.execute(f.outsider, "list")).rejects.toThrow();
    await expect(f.attach(f.manager)).rejects.toThrow();
    const [saved] = await db
      .select()
      .from(schema.receipts)
      .where(eq(schema.receipts.id, first.receiptId));
    expect(
      await f.execute(f.member, "finalize", { uploadId: saved!.uploadId }),
    ).toEqual(first);
    await f.execute(f.member, "delete", { confirmed: true }, first.receiptId);
    await expect(
      f.execute(f.member, "finalize", { uploadId: saved!.uploadId }),
    ).rejects.toThrow("already removed");
  });
  it("keeps existing modes across switch changes and revokes writes immediately", async () => {
    const f = await fixture();
    await f.settings("group");
    const group = await f.attach(f.member);
    await f.settings("individual");
    await f.attach(f.owner, f.owner);
    expect(
      ((await f.execute(f.member, "list")) as ReceiptView).receipts.map(
        (receipt) => receipt.mode,
      ),
    ).toEqual(["group"]);
    await f.settings("individual", false);
    expect(
      ((await f.execute(f.member, "list")) as ReceiptView).receipts,
    ).toHaveLength(1);
    await expect(
      f.execute(
        f.member,
        "edit",
        { amountCentavos: 100, note: "" },
        group.receiptId,
      ),
    ).rejects.toThrow();
    await f.settings("individual", true, []);
    await expect(
      f.execute(f.member, "delete", { confirmed: true }, group.receiptId),
    ).rejects.toThrow();
  });
  it("retains receipts for audit after participant removal and queues all assets on group deletion", async () => {
    const f = await fixture();
    await f.settings("individual");
    await f.attach(f.member);
    await db
      .delete(schema.orderParticipants)
      .where(eq(schema.orderParticipants.userId, f.member));
    expect(
      ((await f.execute(f.owner, "list")) as ReceiptView).receipts,
    ).toHaveLength(1);
    await expect(f.execute(f.member, "list")).rejects.toThrow();
    await createSessionLogsRepository(db).deleteGroup(f.group.id);
    expect(
      await db
        .select()
        .from(schema.receipts)
        .where(eq(schema.receipts.orderId, f.order.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.receiptSettings)
        .where(eq(schema.receiptSettings.orderId, f.order.id)),
    ).toHaveLength(0);
    expect(
      (await db.select().from(schema.receiptObjectCleanup)).length,
    ).toBeGreaterThan(0);
    const result = await cleanupReceiptObjects(f.runner, storage);
    expect(result.processed).toBeGreaterThan(0);
  });
  it("expires abandoned uploads and retries failed object cleanup", async () => {
    const f = await fixture();
    await f.settings("group");
    const uploadId = randomUUID();
    await db.insert(schema.receiptUploads).values({
      id: uploadId,
      orderId: f.order.id,
      userId: f.member,
      mode: "group",
      amountCentavos: 100,
      contentType: "image/png",
      sizeBytes: 8,
      expiresAt: new Date(0),
    });
    await cleanupReceiptObjects(f.runner, {
      ...storage,
      remove: async () => {
        throw new Error("Temporary outage");
      },
    });
    expect(
      await db
        .select()
        .from(schema.receiptUploads)
        .where(eq(schema.receiptUploads.id, uploadId)),
    ).toHaveLength(0);
    const queued = await db
      .select()
      .from(schema.receiptObjectCleanup)
      .where(
        eq(
          schema.receiptObjectCleanup.objectKey,
          `receipts/pending/${uploadId}`,
        ),
      );
    expect(queued[0]?.attempts).toBe(1);
    await db
      .update(schema.receiptObjectCleanup)
      .set({ notBefore: new Date(0) });
    await cleanupReceiptObjects(f.runner, storage);
    expect(await db.select().from(schema.receiptObjectCleanup)).toHaveLength(0);
  });
});
