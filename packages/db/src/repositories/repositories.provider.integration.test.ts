import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../client.js";
import {
  authUsers,
  branches,
  catalogImports,
  favorites,
  groups,
  menuVersions,
  orders,
  restaurants,
  users,
} from "../schema/index.js";
import * as schema from "../schema/index.js";
import { withTransaction } from "../transaction.js";
import { createRepositories } from "./index.js";

const migrationDirectory = fileURLToPath(
  new URL("../../drizzle/", import.meta.url),
);

let database: Database;
let pool: Pool;
let schemaCreated = false;
let testSchema = "";

/** Restricts and quotes the temporary schema identifier before it reaches SQL. */
function quoteTestSchema(identifier: string): string {
  if (!/^[a-z0-9_]+$/u.test(identifier)) {
    throw new TypeError("Test schema name contains unsupported characters.");
  }

  return `"${identifier}"`;
}

/** Enables full certificate verification without changing the stored pooled credential. */
function secureConnectionString(connectionString: string): string {
  const connectionUrl = new URL(connectionString);
  connectionUrl.searchParams.set("sslmode", "verify-full");
  return connectionUrl.toString();
}

/** Loads generated migration statements and redirects explicit public references to the temporary schema. */
async function readMigrationStatements(schemaName: string): Promise<string[]> {
  const fileNames = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const quotedSchema = quoteTestSchema(schemaName);
  const statements: string[] = [];

  for (const fileName of fileNames) {
    const migration = await readFile(
      new URL(`../../drizzle/${fileName}`, import.meta.url),
      "utf8",
    );
    statements.push(
      ...migration
        .replaceAll('"public".', `${quotedSchema}.`)
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement !== ""),
    );
  }

  return statements;
}

beforeAll(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim() === "") {
    throw new Error("DATABASE_URL is required for repository provider tests.");
  }

  testSchema = `repository_test_${randomUUID().replaceAll("-", "")}`;
  pool = new Pool({
    connectionString: secureConnectionString(connectionString),
    max: 1,
  });
  const quotedSchema = quoteTestSchema(testSchema);
  await pool.query(`CREATE SCHEMA ${quotedSchema}`);
  schemaCreated = true;
  await pool.query(`SET search_path TO ${quotedSchema}`);

  for (const statement of await readMigrationStatements(testSchema)) {
    await pool.query(statement);
  }

  database = drizzle(pool, { schema });
}, 30_000);

afterAll(async () => {
  if (pool === undefined) {
    return;
  }

  if (schemaCreated) {
    await pool.query("SET search_path TO public");
    await pool.query(`DROP SCHEMA ${quoteTestSchema(testSchema)} CASCADE`);
  }
  await pool.end();
});

describe("focused repositories", () => {
  it("persists and reads each owned record shape without applying workflow policy", async () => {
    const repositories = createRepositories(database);
    const authUserId = randomUUID();
    await database.insert(authUsers).values({
      email: `repository-${authUserId}@example.test`,
      emailVerified: true,
      id: authUserId,
      name: "Repository User",
    });
    const user = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId,
      displayName: "Repository User",
    });
    expect(
      await repositories.identityAccess.findUserByAuthUserId(authUserId),
    ).toMatchObject({ id: user.id, displayName: "Repository User" });

    const [group] = await database
      .insert(groups)
      .values({ createdByUserId: user.id, name: "Repository Group" })
      .returning();
    if (group === undefined) {
      throw new Error("Expected the repository test group to be created.");
    }

    await repositories.identityAccess.addMembership({
      groupId: group.id,
      role: "owner",
      userId: user.id,
    });
    expect(
      await repositories.identityAccess.listActiveMemberships(user.id),
    ).toHaveLength(1);

    const [restaurant] = await database
      .insert(restaurants)
      .values({ name: "Repository Restaurant" })
      .returning();
    if (restaurant === undefined) {
      throw new Error("Expected the repository test restaurant to be created.");
    }
    const [branch] = await database
      .insert(branches)
      .values({ name: "Main Branch", restaurantId: restaurant.id })
      .returning();
    if (branch === undefined) {
      throw new Error("Expected the repository test branch to be created.");
    }
    const [catalogImport] = await database
      .insert(catalogImports)
      .values({ createdByUserId: user.id, status: "published" })
      .returning();
    if (catalogImport === undefined) {
      throw new Error("Expected the repository test import to be created.");
    }
    const [menuVersion] = await database
      .insert(menuVersions)
      .values({
        branchId: branch.id,
        sourceImportId: catalogImport.id,
        status: "published",
        versionNumber: 1,
      })
      .returning();
    if (menuVersion === undefined) {
      throw new Error("Expected the repository test menu to be created.");
    }
    expect(
      await repositories.catalog.findPublishedMenuVersion(branch.id),
    ).toMatchObject({ id: menuVersion.id, status: "published" });

    await database.insert(favorites).values({
      branchId: branch.id,
      menuVersionId: menuVersion.id,
      name: "Rank One",
      rank: 1,
      userId: user.id,
    });
    expect(
      await repositories.favorites.listForUserAndBranch(user.id, branch.id),
    ).toMatchObject([{ name: "Rank One", rank: 1 }]);

    const [order] = await database
      .insert(orders)
      .values({
        choiceMode: "shortlist",
        deliveryAddressSnapshot: { city: "Manila", line1: "Example" },
        foodDeadline: new Date("2026-07-24T12:00:00.000Z"),
        groupId: group.id,
        initialBranchId: branch.id,
        initialRestaurantId: restaurant.id,
        organizerUserId: user.id,
        restaurantDeadline: new Date("2026-07-24T11:00:00.000Z"),
      })
      .returning();
    if (order === undefined) {
      throw new Error("Expected the repository test order to be created.");
    }
    expect(await repositories.orders.findById(order.id)).toMatchObject({
      id: order.id,
      state: "draft",
    });

    const file = await repositories.files.create({
      contentType: "application/json",
      objectKey: `imports/${randomUUID()}.json`,
      ownerUserId: user.id,
      purpose: "import_source",
      sizeBytes: 128,
    });
    expect(file.status).toBe("pending");

    const notification = await repositories.notifications.create({
      eventType: "order.created",
      orderId: order.id,
      recipientUserId: user.id,
    });
    expect(notification.status).toBe("pending");

    const idempotencyKey = `order-created:${order.id}`;
    await repositories.jobs.create({
      idempotencyKey,
      kind: "order.created",
      orderId: order.id,
      scheduledFor: new Date("2026-07-24T10:00:00.000Z"),
    });
    expect(
      await repositories.jobs.findByIdempotencyKey(idempotencyKey),
    ).toMatchObject({ idempotencyKey, status: "pending" });

    await repositories.auditEvents.append({
      action: "order.created",
      actorUserId: user.id,
      resourceId: order.id,
      resourceType: "order",
    });
    expect(
      await repositories.auditEvents.listForResource("order", order.id),
    ).toHaveLength(1);
  });

  it("commits an order change and audit together and rolls both back on failure", async () => {
    const repositories = createRepositories(database);
    const user = await repositories.identityAccess.createUser({
      displayName: "Transaction User",
    });
    const [group] = await database
      .insert(groups)
      .values({ createdByUserId: user.id, name: "Transaction Group" })
      .returning();
    const [restaurant] = await database
      .insert(restaurants)
      .values({ name: "Transaction Restaurant" })
      .returning();
    if (group === undefined || restaurant === undefined) {
      throw new Error("Expected transaction prerequisites to be created.");
    }
    const [branch] = await database
      .insert(branches)
      .values({ name: "Transaction Branch", restaurantId: restaurant.id })
      .returning();
    if (branch === undefined) {
      throw new Error("Expected the transaction branch to be created.");
    }
    const [order] = await database
      .insert(orders)
      .values({
        choiceMode: "shortlist",
        deliveryAddressSnapshot: { city: "Manila", line1: "Example" },
        foodDeadline: new Date("2026-07-25T12:00:00.000Z"),
        groupId: group.id,
        initialBranchId: branch.id,
        initialRestaurantId: restaurant.id,
        organizerUserId: user.id,
        restaurantDeadline: new Date("2026-07-25T11:00:00.000Z"),
      })
      .returning();
    if (order === undefined) {
      throw new Error("Expected the transaction order to be created.");
    }

    await withTransaction(database, async (transaction) => {
      const transactional = createRepositories(transaction);
      await transactional.orders.setState(order.id, {
        completedAt: null,
        state: "restaurant_voting",
        updatedAt: new Date("2026-07-23T10:00:00.000Z"),
      });
      await transactional.auditEvents.append({
        action: "order.restaurant_voting_started",
        actorUserId: user.id,
        resourceId: order.id,
        resourceType: "order",
      });
    });

    await expect(
      withTransaction(database, async (transaction) => {
        const transactional = createRepositories(transaction);
        await transactional.orders.setState(order.id, {
          completedAt: null,
          state: "food_confirmation",
          updatedAt: new Date("2026-07-23T10:05:00.000Z"),
        });
        await transactional.auditEvents.append({
          action: "order.food_confirmation_started",
          actorUserId: user.id,
          resourceId: order.id,
          resourceType: "order",
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrowError("force rollback");

    expect(await repositories.orders.findById(order.id)).toMatchObject({
      state: "restaurant_voting",
    });
    expect(
      await repositories.auditEvents.listForResource("order", order.id),
    ).toMatchObject([{ action: "order.restaurant_voting_started" }]);
  });

  it("reuses one product user under concurrent first authenticated requests", async () => {
    const repositories = createRepositories(database);
    const authUserId = randomUUID();
    await database.insert(authUsers).values({
      email: `concurrent-${authUserId}@example.test`,
      emailVerified: true,
      id: authUserId,
      name: "Concurrent member",
    });
    const provisionedUsers = await Promise.all(
      Array.from({ length: 5 }, () =>
        repositories.identityAccess.ensureUserForAuthIdentity({
          authUserId,
          displayName: "Concurrent member",
        }),
      ),
    );

    expect(new Set(provisionedUsers.map((user) => user.id))).toHaveLength(1);
    await expect(
      database.select().from(users).where(eq(users.authUserId, authUserId)),
    ).resolves.toHaveLength(1);
  });

  it("does not reactivate an archived product user during identity provisioning", async () => {
    const repositories = createRepositories(database);
    const authUserId = randomUUID();
    await database.insert(authUsers).values({
      email: `archived-${authUserId}@example.test`,
      emailVerified: true,
      id: authUserId,
      name: "Active member",
    });
    const user = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId,
      displayName: "Active member",
    });
    const archivedAt = new Date("2026-07-29T04:00:00.000Z");
    await database
      .update(users)
      .set({ archivedAt })
      .where(eq(users.id, user.id));

    await expect(
      repositories.identityAccess.ensureUserForAuthIdentity({
        authUserId,
        displayName: "Renamed archived member",
      }),
    ).resolves.toMatchObject({ archivedAt, id: user.id });
  });
});
