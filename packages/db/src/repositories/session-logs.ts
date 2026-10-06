import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../client.js";
import type { DatabaseTransaction } from "../transaction.js";
import {
  adminAccessRequests,
  groupInviteLinks,
  groupAddresses,
  groups,
  invitations,
  memberships,
  orders,
  orderParticipants,
  orderShortlistRestaurants,
  restaurantVotes,
  foodSelections,
  orderLines,
  orderLineModifiers,
  receipts,
  notifications,
  jobs,
} from "../schema/index.js";

export interface SessionLogWrite {
  readonly groupId: string;
  readonly state: "draft" | "ordered" | "cancelled";
  readonly restaurantId: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly managerUserId: string;
  readonly deliveryAddress: Record<string, unknown> | null;
  readonly participants: readonly {
    readonly userId: string;
    readonly displayName: string;
    readonly foodResponse: "pending" | "confirmed" | "declined" | "resolved";
    readonly lines: readonly {
      readonly originalLineId?: string;
      readonly itemName: string;
      readonly quantity: number;
      readonly unitPriceCentavos: number;
      readonly note: string;
      readonly lineSubtotalCentavos: number;
    }[];
  }[];
}
export interface SessionRestaurant {
  readonly restaurantId: string;
  readonly restaurantName: string;
  readonly branchId: string;
  readonly branchName: string;
  readonly menuVersionId: string | null;
}
export function createSessionLogsRepository(
  database: Database | DatabaseTransaction,
) {
  async function clearPicks(tx: DatabaseTransaction, orderId: string) {
    const lines = await tx
      .select({ id: orderLines.id })
      .from(orderLines)
      .where(eq(orderLines.orderId, orderId));
    if (lines.length)
      await tx.delete(orderLineModifiers).where(
        inArray(
          orderLineModifiers.orderLineId,
          lines.map((line) => line.id),
        ),
      );
    await tx.delete(orderLines).where(eq(orderLines.orderId, orderId));
    await tx.delete(foodSelections).where(eq(foodSelections.orderId, orderId));
    await tx
      .delete(restaurantVotes)
      .where(eq(restaurantVotes.orderId, orderId));
    await tx
      .delete(orderShortlistRestaurants)
      .where(eq(orderShortlistRestaurants.orderId, orderId));
    await tx
      .delete(orderParticipants)
      .where(eq(orderParticipants.orderId, orderId));
  }
  async function removeOrder(tx: DatabaseTransaction, orderId: string) {
    await clearPicks(tx, orderId);
    await tx.delete(receipts).where(eq(receipts.orderId, orderId));
    await tx.delete(notifications).where(eq(notifications.orderId, orderId));
    await tx.delete(jobs).where(eq(jobs.orderId, orderId));
    const removed = await tx
      .delete(orders)
      .where(eq(orders.id, orderId))
      .returning({ id: orders.id });
    return removed.length > 0;
  }
  return {
    lockGroup: async (groupId: string) => {
      const [row] = await database
        .select({ archivedAt: groups.archivedAt })
        .from(groups)
        .where(eq(groups.id, groupId))
        .for("update");
      return row;
    },
    lockOrder: async (orderId: string) => {
      const [row] = await database
        .select({ groupId: orders.groupId })
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update");
      if (!row) return undefined;
      const people = await database
        .select({ userId: orderParticipants.userId })
        .from(orderParticipants)
        .where(eq(orderParticipants.orderId, orderId));
      return { ...row, participantIds: people.map((person) => person.userId) };
    },
    save: async (input: {
      readonly request: SessionLogWrite;
      readonly orderId?: string;
      readonly restaurant: SessionRestaurant | null;
      readonly now: Date;
    }) =>
      database.transaction(async (tx) => {
        const { request: log, restaurant } = input;
        const originalLines = input.orderId
          ? await tx
              .select()
              .from(orderLines)
              .where(eq(orderLines.orderId, input.orderId))
          : [];
        const originalIds = originalLines.map((line) => line.id);
        const originalModifiers = originalIds.length
          ? await tx
              .select()
              .from(orderLineModifiers)
              .where(inArray(orderLineModifiers.orderLineId, originalIds))
          : [];

        const values = {
          groupId: log.groupId,
          managerUserId: log.managerUserId,
          state: log.state,
          choiceMode: "voting_disabled" as const,
          initialRestaurantId: restaurant?.restaurantId ?? null,
          initialBranchId: restaurant?.branchId ?? null,
          selectedRestaurantId: restaurant?.restaurantId ?? null,
          selectedBranchId: restaurant?.branchId ?? null,
          selectedRestaurantNameSnapshot: restaurant?.restaurantName ?? null,
          selectedBranchNameSnapshot: restaurant?.branchName ?? null,
          selectedMenuVersionId: restaurant?.menuVersionId ?? null,
          deliveryAddressSnapshot: log.deliveryAddress ?? {},
          createdAt: new Date(log.createdAt),
          updatedAt: input.now,
          completedAt:
            log.state === "draft"
              ? null
              : new Date(log.completedAt ?? input.now.toISOString()),
          restaurantDeadline: input.now,
          foodDeadline: new Date(input.now.getTime() + 60_000),
        };
        const [saved] = input.orderId
          ? await tx
              .update(orders)
              .set(values)
              .where(
                and(
                  eq(orders.id, input.orderId),
                  eq(orders.groupId, log.groupId),
                ),
              )
              .returning({ id: orders.id })
          : await tx.insert(orders).values(values).returning({ id: orders.id });
        if (!saved) throw new Error("Session no longer exists.");
        if (input.orderId) await clearPicks(tx, saved.id);
        if (log.participants.length)
          await tx
            .insert(orderParticipants)
            .values(
              log.participants.map((person) => ({
                orderId: saved.id,
                userId: person.userId,
                displayNameSnapshot: person.displayName,
                role:
                  person.userId === log.managerUserId
                    ? ("manager" as const)
                    : ("member" as const),
                foodResponse: person.foodResponse,
                restaurantResponse: "responded" as const,
                selectedAt: input.now,
              })),
            );
        for (const person of log.participants) {
          if (person.foodResponse !== "pending")
            await tx
              .insert(foodSelections)
              .values({
                orderId: saved.id,
                userId: person.userId,
                source:
                  person.foodResponse === "declined" ? "declined" : "inline",
                submittedAt: input.now,
              });
          for (const [sortOrder, line] of person.lines.entries()) {
            const original = line.originalLineId
              ? originalLines.find(
                  (saved) =>
                    saved.id === line.originalLineId &&
                    saved.userId === person.userId,
                )
              : undefined;
            if (line.originalLineId && !original)
              throw new Error("Invalid saved line.");
            const [savedLine] = await tx
              .insert(orderLines)
              .values({
                orderId: saved.id,
                userId: person.userId,
                itemNameSnapshot: line.itemName,
                quantity: line.quantity,
                unitPriceCentavos: line.unitPriceCentavos,
                noteSnapshot: line.note,
                lineSubtotalCentavos: line.lineSubtotalCentavos,
                sortOrder,
                sourceMenuItemId: original?.sourceMenuItemId ?? null,
                variantNameSnapshot: original?.variantNameSnapshot ?? null,
              })
              .returning({ id: orderLines.id });
            const modifiers = originalModifiers.filter(
              (modifier) => modifier.orderLineId === original?.id,
            );
            if (savedLine && modifiers.length)
              await tx
                .insert(orderLineModifiers)
                .values(
                  modifiers.map((modifier) => ({
                    orderLineId: savedLine.id,
                    modifierNameSnapshot: modifier.modifierNameSnapshot,
                    quantity: modifier.quantity,
                    priceDeltaCentavos: modifier.priceDeltaCentavos,
                  })),
                );
          }
        }
        // Edited logs use manual completion; old scheduled work must not overwrite them.
        await tx.delete(jobs).where(eq(jobs.orderId, saved.id));
        return saved;
      }),
    deleteOrder: (orderId: string) =>
      database.transaction((tx) => removeOrder(tx, orderId)),
    deleteGroup: (groupId: string) =>
      database.transaction(async (tx) => {
        const groupOrders = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.groupId, groupId))
          .for("update");
        for (const order of groupOrders) await removeOrder(tx, order.id);
        await tx
          .delete(adminAccessRequests)
          .where(eq(adminAccessRequests.groupId, groupId));
        await tx.delete(invitations).where(eq(invitations.groupId, groupId));
        await tx
          .delete(groupInviteLinks)
          .where(eq(groupInviteLinks.groupId, groupId));
        await tx
          .delete(groupAddresses)
          .where(eq(groupAddresses.groupId, groupId));
        await tx.delete(memberships).where(eq(memberships.groupId, groupId));
        const deleted = await tx
          .delete(groups)
          .where(eq(groups.id, groupId))
          .returning({ id: groups.id });
        return deleted.length > 0;
      }),
  };
}
export type SessionLogsRepository = ReturnType<
  typeof createSessionLogsRepository
>;
