import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import type { DatabaseTransaction } from "../transaction.js";
import {
  orders,
  groups,
  users,
  memberships,
  orderParticipants,
  receipts,
  fileRecords,
  receiptSettings,
  receiptUploads,
  receiptObjectCleanup,
} from "../schema/index.js";
type DB = Database | DatabaseTransaction;
export const stagedReceiptKey = (id: string) => `receipts/pending/${id}`;
export const finalReceiptKey = (id: string) => `receipts/final/${id}`;

/** Queues deletions in the same transaction that removes a receipt association. */
export async function queueSessionReceiptCleanup(db: DB, orderId: string) {
  const files = await db
    .select({ id: fileRecords.id, key: fileRecords.objectKey })
    .from(receipts)
    .innerJoin(fileRecords, eq(fileRecords.id, receipts.fileId))
    .where(eq(receipts.orderId, orderId));
  const uploads = await db
    .select()
    .from(receiptUploads)
    .where(eq(receiptUploads.orderId, orderId));
  const entries = [
    ...files.map((file) => ({ objectKey: file.key, notBefore: new Date() })),
    ...uploads.flatMap((upload) => [
      { objectKey: stagedReceiptKey(upload.id), notBefore: upload.expiresAt },
      { objectKey: finalReceiptKey(upload.id), notBefore: upload.expiresAt },
    ]),
  ];
  if (entries.length)
    await db.insert(receiptObjectCleanup).values(entries).onConflictDoNothing();
  await db.delete(receipts).where(eq(receipts.orderId, orderId));
  if (files.length)
    await db.delete(fileRecords).where(
      inArray(
        fileRecords.id,
        files.map((file) => file.id),
      ),
    );
}
export function createReceiptsRepository(db: DB) {
  return {
    loadContext: async (orderId: string, userId: string) => {
      const [found] = await db
        .select({ groupId: orders.groupId })
        .from(orders)
        .where(eq(orders.id, orderId));
      if (!found) return null;
      // Same group -> order lock sequence as session edit/delete.
      const [group] = await db
        .select()
        .from(groups)
        .where(eq(groups.id, found.groupId))
        .for("update");
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");
      if (!group || group.archivedAt || !order) return null;
      const [member] = await db
        .select({ role: memberships.role })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(
            eq(memberships.groupId, group.id),
            eq(memberships.userId, userId),
            isNull(memberships.removedAt),
            isNull(users.archivedAt),
          ),
        );
      const people = await db
        .select({
          userId: orderParticipants.userId,
          displayName: orderParticipants.displayNameSnapshot,
        })
        .from(orderParticipants)
        .where(eq(orderParticipants.orderId, orderId));
      const active = await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(
            eq(memberships.groupId, group.id),
            isNull(memberships.removedAt),
            isNull(users.archivedAt),
          ),
        );
      const [settings] = await db
        .select()
        .from(receiptSettings)
        .where(eq(receiptSettings.orderId, orderId));
      return {
        groupId: group.id,
        state: order.state,
        sessionTotalCentavos: order.sessionTotalCentavos,
        role: member?.role ?? null,
        userId,
        participants: people,
        participantIds: people.map((person) => person.userId),
        activeMemberIds: active.map((person) => person.userId),
        enabled: settings?.enabled ?? false,
        mode: (settings?.mode ?? "group") as "group" | "individual",
        submitterIds: settings?.submitterIds ?? [],
      };
    },
    list: (orderId: string) =>
      db
        .select({
          receipt: receipts,
          file: fileRecords,
          submitterName: users.displayName,
        })
        .from(receipts)
        .innerJoin(fileRecords, eq(fileRecords.id, receipts.fileId))
        .innerJoin(users, eq(users.id, receipts.uploadedByUserId))
        .where(eq(receipts.orderId, orderId))
        .orderBy(receipts.createdAt),
    saveSessionTotal: async (
      orderId: string,
      sessionTotalCentavos: number | null,
    ) => {
      await db
        .update(orders)
        .set({ sessionTotalCentavos, updatedAt: new Date() })
        .where(eq(orders.id, orderId));
    },
    saveSettings: async (
      orderId: string,
      input: { enabled: boolean; mode: string; submitterIds: string[] },
    ) => {
      await db
        .insert(receiptSettings)
        .values({ orderId, ...input })
        .onConflictDoUpdate({ target: receiptSettings.orderId, set: input });
    },
    createUpload: async (input: typeof receiptUploads.$inferInsert) => {
      const [row] = await db.insert(receiptUploads).values(input).returning();
      return row!;
    },
    findUpload: async (id: string) => {
      const [row] = await db
        .select()
        .from(receiptUploads)
        .where(eq(receiptUploads.id, id))
        .for("update");
      return row;
    },
    findByUpload: async (uploadId: string) => {
      const [row] = await db
        .select()
        .from(receipts)
        .where(eq(receipts.uploadId, uploadId));
      return row;
    },
    finalize: async (
      upload: typeof receiptUploads.$inferSelect,
      participantName: string | null,
    ) => {
      const [file] = await db
        .insert(fileRecords)
        .values({
          purpose: "receipt",
          status: "ready",
          ownerUserId: upload.userId,
          objectKey: finalReceiptKey(upload.id),
          contentType: upload.contentType,
          sizeBytes: upload.sizeBytes,
          finalizedAt: new Date(),
        })
        .returning();
      const [receipt] = await db
        .insert(receipts)
        .values({
          orderId: upload.orderId,
          fileId: file!.id,
          uploadId: upload.id,
          uploadedByUserId: upload.userId,
          mode: upload.mode,
          participantUserId: upload.participantUserId,
          participantName,
          amountCentavos: upload.amountCentavos,
          note: upload.note,
        })
        .returning();
      await db
        .insert(receiptObjectCleanup)
        .values({
          objectKey: stagedReceiptKey(upload.id),
          notBefore: upload.expiresAt,
        })
        .onConflictDoNothing();
      await db
        .update(receiptUploads)
        .set({ finalizedAt: new Date() })
        .where(eq(receiptUploads.id, upload.id));
      return receipt!;
    },
    update: async (
      id: string,
      details: { amountCentavos: number; note: string },
    ) => {
      await db
        .update(receipts)
        .set({ ...details, updatedAt: new Date() })
        .where(eq(receipts.id, id));
    },
    remove: async (id: string, fileId: string, objectKey: string) => {
      await db
        .insert(receiptObjectCleanup)
        .values({ objectKey })
        .onConflictDoNothing();
      await db.delete(receipts).where(eq(receipts.id, id));
      await db.delete(fileRecords).where(eq(fileRecords.id, fileId));
    },
    expireUploads: async (now: Date) => {
      const uploads = await db
        .select()
        .from(receiptUploads)
        .where(lte(receiptUploads.expiresAt, now))
        .limit(50)
        .for("update", { skipLocked: true });
      for (const upload of uploads) {
        const [attached] = await db
          .select({ id: receipts.id })
          .from(receipts)
          .where(eq(receipts.uploadId, upload.id));
        await db
          .insert(receiptObjectCleanup)
          .values([
            { objectKey: stagedReceiptKey(upload.id) },
            ...(!attached ? [{ objectKey: finalReceiptKey(upload.id) }] : []),
          ])
          .onConflictDoNothing();
        await db.delete(receiptUploads).where(eq(receiptUploads.id, upload.id));
      }
    },
    cleanupEntries: (now: Date) =>
      db
        .select()
        .from(receiptObjectCleanup)
        .where(lte(receiptObjectCleanup.notBefore, now))
        .limit(25)
        .for("update", { skipLocked: true }),
    cleanupDone: async (objectKey: string) => {
      await db
        .delete(receiptObjectCleanup)
        .where(eq(receiptObjectCleanup.objectKey, objectKey));
    },
    cleanupFailed: async (objectKey: string) => {
      await db
        .update(receiptObjectCleanup)
        .set({
          attempts: sql`${receiptObjectCleanup.attempts} + 1`,
          notBefore: new Date(Date.now() + 60 * 60_000),
        })
        .where(eq(receiptObjectCleanup.objectKey, objectKey));
    },
  };
}
export type ReceiptsRepository = ReturnType<typeof createReceiptsRepository>;
