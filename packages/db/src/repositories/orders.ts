import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import {
  branches,
  foodSelections,
  groups,
  memberships,
  menuItems,
  menuCategories,
  orderLines,
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
  readonly initialRestaurantId: string | null;
  readonly initialBranchId: string | null;
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
  readonly restaurantImageUrl?: string | null;
  readonly initialRestaurantId: string | null;
  readonly restaurantDeadline: Date;
  readonly foodDeadline: Date;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly participants: readonly OrderParticipantRow[];
}

export interface TerminalOrderSummaryRow extends Omit<
  OrderListItemRow,
  "participants"
> {
  readonly participantCount: number;
}

export interface ActiveOrderCountRow {
  readonly activeOrderCount: number;
  readonly groupId: string;
}

export interface OrderDetailRow {
  readonly orderId: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly managerUserId: string;
  readonly state: typeof orders.$inferSelect.state;
  readonly choiceMode: "voting_disabled" | "shortlist" | "global_catalog";
  readonly initialRestaurantId: string | null;
  readonly initialRestaurantName: string | null;
  readonly initialBranchId: string | null;
  readonly initialBranchName: string | null;
  readonly initialBranchGrabUrl: string | null;
  readonly selectedRestaurantId: string | null;
  readonly selectedRestaurantName: string | null;
  readonly restaurantImageUrl?: string | null;
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

export interface FoodResponseLineInput {
  readonly sourceMenuItemId: string;
  readonly itemNameSnapshot: string;
  readonly quantity: number;
  readonly unitPriceCentavos: number;
  readonly noteSnapshot: string;
  readonly lineSubtotalCentavos: number;
  readonly sortOrder: number;
}

export interface UpsertFoodResponseInput {
  readonly orderId: string;
  readonly userId: string;
  readonly status: "confirmed" | "declined";
  readonly source: "saved_favorite" | "inline" | "declined";
  readonly favoriteId: string | null;
  readonly lines: readonly FoodResponseLineInput[];
  readonly now: Date;
}

export interface OrderLineRow {
  readonly id?: string;
  readonly userId: string;
  readonly sourceMenuItemId: string | null;
  readonly itemNameSnapshot: string;
  readonly quantity: number;
  readonly unitPriceCentavos: number;
  readonly noteSnapshot: string;
  readonly lineSubtotalCentavos: number;
  readonly sortOrder: number;
}

export interface OrderLineForOrderRow extends OrderLineRow {
  readonly orderId: string;
}

export interface OrdersRepository {
  findById(id: string): Promise<typeof orders.$inferSelect | undefined>;
  setState(
    id: string,
    next: PersistedOrderState,
  ): Promise<typeof orders.$inferSelect>;
  createOrder(input: CreateOrderRow): Promise<{ readonly id: string }>;
  listActiveVisibleForUser(
    userId: string,
  ): Promise<readonly OrderListItemRow[]>;
  listActiveCountsForGroups(
    groupIds: readonly string[],
  ): Promise<readonly ActiveOrderCountRow[]>;
  listTerminalVisibleForUser(
    userId: string,
    options: Readonly<{
      cursor: Readonly<{ sortTime: Date; orderId: string }> | null;
      limit: number;
    }>,
  ): Promise<
    Readonly<{
      rows: readonly TerminalOrderSummaryRow[];
      nextCursorRow: TerminalOrderSummaryRow | null;
    }>
  >;
  listVisibleForUser(userId: string): Promise<readonly OrderListItemRow[]>;
  findOrderDetail(orderId: string): Promise<OrderDetailRow | undefined>;
  upsertFoodResponse(input: UpsertFoodResponseInput): Promise<void>;
  clearFoodResponse(orderId: string, userId: string): Promise<void>;
  listOrderLines(orderId: string): Promise<readonly OrderLineRow[]>;
  listOrderLinesForOrders(
    orderIds: readonly string[],
  ): Promise<readonly OrderLineForOrderRow[]>;
}

/** Creates order persistence operations that apply already-authorized domain outcomes. */
export function createOrdersRepository(
  database: Database | DatabaseTransaction,
): OrdersRepository {
  /** Keeps every order list read behind the same participant and current-role rules. */
  const visibleOrderPredicate = (userId: string) =>
    or(
      and(
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
                isNull(memberships.removedAt),
              ),
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
              inArray(memberships.role, ["owner", "manager"]),
              isNull(memberships.removedAt),
            ),
          ),
      ),
    );

  // A single image from the selected immutable menu keeps compact order cards visual.
  const restaurantImageUrl = sql<string | null>`(
    select ${menuItems.imageUrl}
    from ${menuItems}
    inner join ${menuCategories} on ${menuCategories.id} = ${menuItems.categoryId}
    where ${menuCategories.menuVersionId} = ${orders.selectedMenuVersionId}
      and ${menuItems.imageUrl} is not null
    order by ${menuCategories.sortOrder}, ${menuItems.sortOrder}
    limit 1
  )`;

  const orderListSelection = {
    completedAt: orders.completedAt,
    createdAt: orders.createdAt,
    foodDeadline: orders.foodDeadline,
    groupId: orders.groupId,
    groupName: groups.name,
    initialRestaurantId: orders.initialRestaurantId,
    managerUserId: orders.managerUserId,
    orderId: orders.id,
    restaurantDeadline: orders.restaurantDeadline,
    restaurantImageUrl,
    selectedRestaurantName: orders.selectedRestaurantNameSnapshot,
    state: orders.state,
  } as const;

  /** Attaches participant response rows only to the active orders that need them. */
  async function attachParticipants(
    orderRows: readonly Omit<OrderListItemRow, "participants">[],
  ): Promise<readonly OrderListItemRow[]> {
    if (orderRows.length === 0) return [];
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
    const participantsByOrderId = new Map<string, OrderParticipantRow[]>();
    for (const participant of participantRows) {
      const current = participantsByOrderId.get(participant.orderId) ?? [];
      current.push(participant);
      participantsByOrderId.set(participant.orderId, current);
    }
    return orderRows.map((row) => ({
      ...row,
      participants: participantsByOrderId.get(row.orderId) ?? [],
    }));
  }

  return {
    /** Counts every non-terminal order for several admin group rows in one query. */
    listActiveCountsForGroups: async (groupIds) =>
      groupIds.length === 0
        ? []
        : database
            .select({
              activeOrderCount: sql<number>`count(*)`.mapWith(Number),
              groupId: orders.groupId,
            })
            .from(orders)
            .where(
              and(
                inArray(orders.groupId, [...groupIds]),
                notInArray(orders.state, ["ordered", "cancelled"]),
              ),
            )
            .groupBy(orders.groupId)
            .orderBy(asc(orders.groupId)),
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
    /** Lists only non-terminal orders and their response counts for the first screen. */
    listActiveVisibleForUser: async (userId) => {
      const orderRows = await database
        .select(orderListSelection)
        .from(orders)
        .innerJoin(groups, eq(groups.id, orders.groupId))
        .where(
          and(
            visibleOrderPredicate(userId),
            notInArray(orders.state, ["draft", "ordered", "cancelled"]),
          ),
        )
        .orderBy(asc(orders.restaurantDeadline), asc(orders.id));
      return attachParticipants(orderRows);
    },
    /** Lists one compact terminal page without loading participant or food rows. */
    listTerminalVisibleForUser: async (userId, { cursor, limit }) => {
      if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
        throw new Error("Terminal order limit must be between 1 and 25.");
      }
      const sortTime = orders.createdAt;
      const participantCount = sql<number>`(
        select count(*)
        from ${orderParticipants}
        where ${orderParticipants.orderId} = ${orders.id}
      )`.mapWith(Number);
      const rows = await database
        .select({ ...orderListSelection, participantCount })
        .from(orders)
        .innerJoin(groups, eq(groups.id, orders.groupId))
        .where(
          and(
            visibleOrderPredicate(userId),
            cursor === null
              ? undefined
              : or(
                  lt(sortTime, cursor.sortTime),
                  and(
                    eq(sortTime, cursor.sortTime),
                    lt(orders.id, cursor.orderId),
                  ),
                ),
          ),
        )
        .orderBy(desc(sortTime), desc(orders.id))
        .limit(limit + 1);
      return {
        nextCursorRow: rows.length > limit ? (rows[limit - 1] ?? null) : null,
        rows: rows.slice(0, limit),
      };
    },
    listVisibleForUser: async (userId) => {
      const orderRows = await database
        .select(orderListSelection)
        .from(orders)
        .innerJoin(groups, eq(groups.id, orders.groupId))
        .where(visibleOrderPredicate(userId))
        .orderBy(desc(orders.createdAt));
      return attachParticipants(orderRows);
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
          restaurantImageUrl,
          state: orders.state,
        })
        .from(orders)
        .innerJoin(groups, eq(groups.id, orders.groupId))
        .leftJoin(restaurants, eq(restaurants.id, orders.initialRestaurantId))
        .leftJoin(branches, eq(branches.id, orders.initialBranchId))
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
    upsertFoodResponse: async (input) => {
      await database
        .update(orderParticipants)
        .set({ foodResponse: input.status })
        .where(
          and(
            eq(orderParticipants.orderId, input.orderId),
            eq(orderParticipants.userId, input.userId),
          ),
        );

      await database
        .insert(foodSelections)
        .values({
          favoriteId: input.favoriteId,
          orderId: input.orderId,
          resolvedByUserId: null,
          source: input.source,
          submittedAt: input.now,
          userId: input.userId,
        })
        .onConflictDoUpdate({
          target: [foodSelections.orderId, foodSelections.userId],
          set: {
            favoriteId: input.favoriteId,
            resolvedByUserId: null,
            source: input.source,
            submittedAt: input.now,
          },
        });

      await database
        .delete(orderLines)
        .where(
          and(
            eq(orderLines.orderId, input.orderId),
            eq(orderLines.userId, input.userId),
          ),
        );
      if (input.lines.length > 0) {
        await database.insert(orderLines).values(
          input.lines.map((line) => ({
            lineSubtotalCentavos: line.lineSubtotalCentavos,
            itemNameSnapshot: line.itemNameSnapshot,
            noteSnapshot: line.noteSnapshot,
            orderId: input.orderId,
            quantity: line.quantity,
            sortOrder: line.sortOrder,
            sourceMenuItemId: line.sourceMenuItemId,
            unitPriceCentavos: line.unitPriceCentavos,
            userId: input.userId,
          })),
        );
      }
    },
    clearFoodResponse: async (orderId, userId) => {
      await database
        .delete(foodSelections)
        .where(
          and(
            eq(foodSelections.orderId, orderId),
            eq(foodSelections.userId, userId),
          ),
        );
      await database
        .delete(orderLines)
        .where(
          and(eq(orderLines.orderId, orderId), eq(orderLines.userId, userId)),
        );
      await database
        .update(orderParticipants)
        .set({ foodResponse: "pending" })
        .where(
          and(
            eq(orderParticipants.orderId, orderId),
            eq(orderParticipants.userId, userId),
          ),
        );
    },
    listOrderLines: async (orderId) =>
      database
        .select({
          id: orderLines.id,
          itemNameSnapshot: orderLines.itemNameSnapshot,
          lineSubtotalCentavos: orderLines.lineSubtotalCentavos,
          noteSnapshot: orderLines.noteSnapshot,
          quantity: orderLines.quantity,
          sortOrder: orderLines.sortOrder,
          sourceMenuItemId: orderLines.sourceMenuItemId,
          unitPriceCentavos: orderLines.unitPriceCentavos,
          userId: orderLines.userId,
        })
        .from(orderLines)
        .where(eq(orderLines.orderId, orderId))
        .orderBy(asc(orderLines.userId), asc(orderLines.sortOrder)),
    /** Loads immutable food lines for several orders in one database query. */
    listOrderLinesForOrders: async (orderIds) =>
      orderIds.length === 0
        ? []
        : database
            .select({
              itemNameSnapshot: orderLines.itemNameSnapshot,
              lineSubtotalCentavos: orderLines.lineSubtotalCentavos,
              noteSnapshot: orderLines.noteSnapshot,
              orderId: orderLines.orderId,
              quantity: orderLines.quantity,
              sortOrder: orderLines.sortOrder,
              sourceMenuItemId: orderLines.sourceMenuItemId,
              unitPriceCentavos: orderLines.unitPriceCentavos,
              userId: orderLines.userId,
            })
            .from(orderLines)
            .where(inArray(orderLines.orderId, [...orderIds]))
            .orderBy(
              asc(orderLines.orderId),
              asc(orderLines.userId),
              asc(orderLines.sortOrder),
            ),
  };
}
