import { and, desc, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import {
  branches,
  groups,
  memberships,
  orderParticipants,
  orderShortlistRestaurants,
  orders,
  restaurants,
} from "../schema/index.js";
import type { Database } from "../client.js";
import type { DatabaseTransaction } from "../transaction.js";
import { requireWrittenRow } from "./rows.js";

export interface PersistedOrderState {
  readonly completedAt: Date | null;
  readonly state: typeof orders.$inferSelect.state;
  readonly updatedAt: Date;
}

export interface CreateOrderParticipantRow {
  readonly userId: string;
  readonly displayName: string;
  readonly role: "manager" | "member";
  readonly restaurantResponse: "pending" | "responded";
}

export interface CreateOrderRow {
  readonly groupId: string;
  readonly managerUserId: string;
  readonly state: "restaurant_voting" | "food_confirmation";
  readonly choiceMode: "voting_disabled" | "shortlist" | "global_catalog";
  readonly initialRestaurantId: string;
  readonly initialBranchId: string;
  readonly selected: Readonly<{
    restaurantId: string;
    branchId: string;
    restaurantName: string;
    branchName: string;
    menuVersionId: string;
  }> | null;
  readonly shortlistRestaurantIds: readonly string[];
  readonly deliveryAddressSnapshot: Record<string, unknown>;
  readonly restaurantDeadline: Date;
  readonly foodDeadline: Date;
  readonly now: Date;
  readonly participants: readonly CreateOrderParticipantRow[];
}

export interface OrderParticipantRow {
  readonly userId: string;
  readonly displayName: string;
  readonly role: "manager" | "member";
  readonly restaurantResponse: "pending" | "responded";
  readonly foodResponse: "pending" | "confirmed" | "declined" | "resolved";
}

export interface OrderListItemRow {
  readonly orderId: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly state: typeof orders.$inferSelect.state;
  readonly managerUserId: string;
  readonly selectedRestaurantName: string | null;
  readonly initialRestaurantId: string;
  readonly restaurantDeadline: Date;
  readonly foodDeadline: Date;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly participants: readonly OrderParticipantRow[];
}

export interface OrderDetailRow {
  readonly orderId: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly managerUserId: string;
  readonly state: typeof orders.$inferSelect.state;
  readonly choiceMode: "voting_disabled" | "shortlist" | "global_catalog";
  readonly initialRestaurantId: string;
  readonly initialRestaurantName: string;
  readonly initialBranchId: string;
  readonly initialBranchName: string;
  readonly initialBranchGrabUrl: string | null;
  readonly selectedRestaurantId: string | null;
  readonly selectedRestaurantName: string | null;
  readonly selectedBranchId: string | null;
  readonly selectedBranchName: string | null;
  readonly selectedMenuVersionId: string | null;
  readonly deliveryAddressSnapshot: unknown;
  readonly restaurantDeadline: Date;
  readonly foodDeadline: Date;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly participants: readonly OrderParticipantRow[];
}

export interface OrdersRepository {
  findById(id: string): Promise<typeof orders.$inferSelect | undefined>;
  setState(
    id: string,
    next: PersistedOrderState,
  ): Promise<typeof orders.$inferSelect>;
  createOrder(input: CreateOrderRow): Promise<{ readonly id: string }>;
  listVisibleForUser(userId: string): Promise<readonly OrderListItemRow[]>;
  findOrderDetail(orderId: string): Promise<OrderDetailRow | undefined>;
}

/** Creates order persistence operations that apply already-authorized domain outcomes. */
export function createOrdersRepository(
  database: Database | DatabaseTransaction,
): OrdersRepository {
  return {
    findById: async (id) => {
      const [order] = await database
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);
      return order;
    },
    setState: async (id, next) =>
      requireWrittenRow(
        await database
          .update(orders)
          .set(next)
          .where(eq(orders.id, id))
          .returning(),
      ),
    createOrder: async (input) =>
      database.transaction(async (tx) => {
        const created = requireWrittenRow(
          await tx
            .insert(orders)
            .values({
            choiceMode: input.choiceMode,
            completedAt: null,
            createdAt: input.now,
            deliveryAddressSnapshot: input.deliveryAddressSnapshot,
            foodDeadline: input.foodDeadline,
            groupId: input.groupId,
            initialBranchId: input.initialBranchId,
            initialRestaurantId: input.initialRestaurantId,
            managerUserId: input.managerUserId,
            restaurantDeadline: input.restaurantDeadline,
            selectedBranchId: input.selected?.branchId ?? null,
            selectedBranchNameSnapshot: input.selected?.branchName ?? null,
            selectedMenuVersionId: input.selected?.menuVersionId ?? null,
            selectedRestaurantId: input.selected?.restaurantId ?? null,
            selectedRestaurantNameSnapshot:
              input.selected?.restaurantName ?? null,
            state: input.state,
            updatedAt: input.now,
          })
            .returning({ id: orders.id }),
        );

        await tx.insert(orderParticipants).values(
          input.participants.map((participant) => ({
            displayNameSnapshot: participant.displayName,
            orderId: created.id,
            restaurantResponse: participant.restaurantResponse,
            role: participant.role,
            selectedAt: input.now,
            userId: participant.userId,
          })),
        );

        if (input.shortlistRestaurantIds.length > 0) {
          await tx.insert(orderShortlistRestaurants).values(
            input.shortlistRestaurantIds.map((restaurantId) => ({
              orderId: created.id,
              restaurantId,
            })),
          );
        }

        return created;
      }),
    listVisibleForUser: async (userId) => {
      const orderRows = await database
        .select({
          completedAt: orders.completedAt,
          createdAt: orders.createdAt,
          foodDeadline: orders.foodDeadline,
          groupId: orders.groupId,
          groupName: groups.name,
          initialRestaurantId: orders.initialRestaurantId,
          managerUserId: orders.managerUserId,
          orderId: orders.id,
          restaurantDeadline: orders.restaurantDeadline,
          selectedRestaurantName: orders.selectedRestaurantNameSnapshot,
          state: orders.state,
        })
        .from(orders)
        .innerJoin(groups, eq(groups.id, orders.groupId))
        .where(
          or(
            exists(
              database
                .select({ one: sql`1` })
                .from(orderParticipants)
                .where(
                  and(
                    eq(orderParticipants.orderId, orders.id),
                    eq(orderParticipants.userId, userId),
                  ),
                ),
            ),
            exists(
              database
                .select({ one: sql`1` })
                .from(memberships)
                .where(
                  and(
                    eq(memberships.groupId, orders.groupId),
                    eq(memberships.userId, userId),
                    eq(memberships.role, "owner"),
                    isNull(memberships.removedAt),
                  ),
                ),
            ),
          ),
        )
        .orderBy(desc(orders.createdAt));

      if (orderRows.length === 0) {
        return [];
      }

      const participantRows = await database
        .select({
          displayName: orderParticipants.displayNameSnapshot,
          foodResponse: orderParticipants.foodResponse,
          orderId: orderParticipants.orderId,
          restaurantResponse: orderParticipants.restaurantResponse,
          role: orderParticipants.role,
          userId: orderParticipants.userId,
        })
        .from(orderParticipants)
        .where(
          inArray(
            orderParticipants.orderId,
            orderRows.map((row) => row.orderId),
          ),
        );

      return orderRows.map((row) => ({
        ...row,
        participants: participantRows.filter(
          (participant) => participant.orderId === row.orderId,
        ),
      }));
    },
    findOrderDetail: async (orderId) => {
      const [row] = await database
        .select({
          choiceMode: orders.choiceMode,
          completedAt: orders.completedAt,
          createdAt: orders.createdAt,
          deliveryAddressSnapshot: orders.deliveryAddressSnapshot,
          foodDeadline: orders.foodDeadline,
          groupId: orders.groupId,
          groupName: groups.name,
          initialBranchGrabUrl: branches.grabUrl,
          initialBranchId: orders.initialBranchId,
          initialBranchName: branches.name,
          initialRestaurantId: orders.initialRestaurantId,
          initialRestaurantName: restaurants.name,
          managerUserId: orders.managerUserId,
          orderId: orders.id,
          restaurantDeadline: orders.restaurantDeadline,
          selectedBranchId: orders.selectedBranchId,
          selectedBranchName: orders.selectedBranchNameSnapshot,
          selectedMenuVersionId: orders.selectedMenuVersionId,
          selectedRestaurantId: orders.selectedRestaurantId,
          selectedRestaurantName: orders.selectedRestaurantNameSnapshot,
          state: orders.state,
        })
        .from(orders)
        .innerJoin(groups, eq(groups.id, orders.groupId))
        .innerJoin(restaurants, eq(restaurants.id, orders.initialRestaurantId))
        .innerJoin(branches, eq(branches.id, orders.initialBranchId))
        .where(eq(orders.id, orderId))
        .limit(1);
      if (row === undefined) {
        return undefined;
      }

      const participants = await database
        .select({
          displayName: orderParticipants.displayNameSnapshot,
          foodResponse: orderParticipants.foodResponse,
          restaurantResponse: orderParticipants.restaurantResponse,
          role: orderParticipants.role,
          userId: orderParticipants.userId,
        })
        .from(orderParticipants)
        .where(eq(orderParticipants.orderId, orderId));

      return { ...row, participants };
    },
  };
}
