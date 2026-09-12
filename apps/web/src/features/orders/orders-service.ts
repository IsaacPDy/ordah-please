import {
  parseDeliveryAddress,
  PublicApiError,
  type FoodPickRequest,
  type OrderCreateRequest,
} from "@ordah-please/contracts";
import {
  parseCentavos,
  parseId,
  resolveFoodDeadline,
  transitionOrderState,
  type DeliveryAddress,
  type Centavos,
  type FavoriteId,
  type FoodDeadlineResponse,
  type FoodSelectionSnapshot,
  type MenuItemId,
  type OrderId,
  type OrderState,
  type UserId,
} from "@ordah-please/domain";

import { requireGroupRole } from "../../application/group-authorization";
import type { AppIdentity } from "../../auth/load-app-identity";

const FORBIDDEN_MESSAGE = "You do not have access to this action.";
const MINIMUM_STAGE_GAP_MS = 60_000;

export interface FoodResponseLineInput {
  readonly sourceMenuItemId: string;
  readonly itemNameSnapshot: string;
  readonly quantity: number;
  readonly unitPriceCentavos: number;
  readonly noteSnapshot: string;
  readonly lineSubtotalCentavos: number;
  readonly sortOrder: number;
}

export interface OrdersServiceRepositories {
  readonly auditEvents: {
    readonly append: (input: {
      actorUserId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      details?: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  readonly catalog: {
    readonly findMenuItemContext: (menuItemId: string) => Promise<
      | {
          readonly menuItemId: string;
          readonly name: string;
          readonly basePriceCentavos: number;
          readonly isAvailable: boolean;
          readonly branchId: string;
          readonly menuVersionId: string;
        }
      | undefined
    >;
    readonly findPublishedMenuVersion: (
      branchId: string,
    ) => Promise<{ readonly id: string } | undefined>;
    readonly getRestaurantDetail: (restaurantId: string) => Promise<{
      readonly branchId: string;
      readonly branchName: string;
      readonly restaurantName: string;
    } | null>;
    readonly listRestaurants: () => Promise<
      readonly { readonly restaurantId: string; readonly branchId: string }[]
    >;
  };
  readonly groupAccess: {
    readonly findGroupAddress: (groupId: string) => Promise<unknown>;
    readonly listActiveMembers: (groupId: string) => Promise<
      readonly {
        readonly displayName: string;
        readonly role: "owner" | "manager" | "member";
        readonly userId: string;
      }[]
    >;
    readonly upsertGroupAddress: (input: {
      groupId: string;
      recipientName: string;
      phoneNumber: string;
      lineOne: string;
      lineTwo: string | null;
      city: string;
      postalCode: string | null;
      notes: string | null;
      updatedByUserId: string;
      now: Date;
    }) => Promise<unknown>;
  };
  readonly favorites: {
    readonly listForUser: (userId: string) => Promise<
      readonly {
        readonly favoriteId: string;
        readonly rank: number;
        readonly name: string;
        readonly branchId: string;
        readonly menuItemId: string | null;
        readonly currentPriceCentavos: number | null;
        readonly isCurrentlyAvailable: boolean | null;
        readonly itemDescription: string | null;
      }[]
    >;
    readonly listForUserAndBranchWithItems: (
      userId: string,
      branchId: string,
    ) => Promise<
      readonly {
        readonly id: string;
        readonly branchId: string;
        readonly rank: number;
        readonly name: string;
        readonly items: readonly {
          readonly menuItemId: string;
          readonly quantity: number;
          readonly note: string;
        }[];
      }[]
    >;
  };
  readonly orders: {
    readonly createOrder: (input: {
      groupId: string;
      managerUserId: string;
      state: "restaurant_voting" | "food_confirmation";
      choiceMode: "voting_disabled" | "shortlist" | "global_catalog";
      initialRestaurantId: string;
      initialBranchId: string;
      selected: Readonly<{
        restaurantId: string;
        branchId: string;
        restaurantName: string;
        branchName: string;
        menuVersionId: string;
      }> | null;
      shortlistRestaurantIds: readonly string[];
      deliveryAddressSnapshot: Record<string, unknown>;
      restaurantDeadline: Date;
      foodDeadline: Date;
      now: Date;
      participants: readonly {
        userId: string;
        displayName: string;
        role: "manager" | "member";
        restaurantResponse: "pending" | "responded";
      }[];
    }) => Promise<{ readonly id: string }>;
    readonly findById: (orderId: string) => Promise<
      | {
          readonly groupId: string;
          readonly managerUserId: string;
          readonly state: OrderState;
        }
      | undefined
    >;
    readonly findOrderDetail: (orderId: string) => Promise<unknown>;
    readonly upsertFoodResponse: (input: {
      readonly orderId: string;
      readonly userId: string;
      readonly status: "confirmed" | "declined";
      readonly source: "saved_favorite" | "inline" | "declined";
      readonly favoriteId: string | null;
      readonly lines: readonly FoodResponseLineInput[];
      readonly now: Date;
    }) => Promise<unknown>;
    readonly clearFoodResponse: (
      orderId: string,
      userId: string,
    ) => Promise<unknown>;
    readonly listOrderLines: (orderId: string) => Promise<
      readonly {
        readonly userId: string;
        readonly sourceMenuItemId: string | null;
        readonly itemNameSnapshot: string;
        readonly quantity: number;
        readonly unitPriceCentavos: number;
        readonly noteSnapshot: string;
        readonly lineSubtotalCentavos: number;
        readonly sortOrder: number;
      }[]
    >;
    readonly listOrderLinesForOrders: (orderIds: readonly string[]) => Promise<
      readonly {
        readonly orderId: string;
        readonly userId: string;
        readonly sourceMenuItemId: string | null;
        readonly itemNameSnapshot: string;
        readonly quantity: number;
        readonly unitPriceCentavos: number;
        readonly noteSnapshot: string;
        readonly lineSubtotalCentavos: number;
        readonly sortOrder: number;
      }[]
    >;
    readonly listVisibleForUser: (userId: string) => Promise<
      readonly {
        readonly orderId: string;
        readonly groupId: string;
        readonly groupName: string;
        readonly state: OrderState;
        readonly managerUserId: string;
        readonly selectedRestaurantName: string | null;
        readonly initialRestaurantId: string;
        readonly restaurantDeadline: Date;
        readonly foodDeadline: Date;
        readonly createdAt: Date;
        readonly completedAt: Date | null;
        readonly participants: readonly {
          readonly userId: string;
          readonly displayName: string;
          readonly role: "manager" | "member";
          readonly restaurantResponse: "pending" | "responded";
          readonly foodResponse:
            "pending" | "confirmed" | "declined" | "resolved";
        }[];
      }[]
    >;
    readonly setState: (
      orderId: string,
      next: {
        readonly state: OrderState;
        readonly completedAt: Date | null;
        readonly updatedAt: Date;
      },
    ) => Promise<unknown>;
  };
}

export interface OrdersTransactionRunner {
  run<Result>(
    operation: (repositories: OrdersServiceRepositories) => Promise<Result>,
  ): Promise<Result>;
}

/** Creates a group order after full authorization and catalog validation. */
export async function createGroupOrder(
  command: Readonly<{
    identity: AppIdentity;
    request: OrderCreateRequest;
    now: Date;
  }>,
  runner: OrdersTransactionRunner,
): Promise<{ orderId: OrderId }> {
  return runner.run(async (repositories) => {
    requireGroupRole(command.identity, command.request.groupId, [
      "group-owner",
      "manager",
    ]);

    const activeMembers = await repositories.groupAccess.listActiveMembers(
      command.request.groupId,
    );
    const activeIds = new Set(activeMembers.map((member) => member.userId));
    for (const participantId of command.request.participantUserIds) {
      if (!activeIds.has(participantId)) {
        throw new PublicApiError(
          "INVALID_INPUT",
          "One of the selected participants is not an active member of this group.",
        );
      }
    }

    const detail = await repositories.catalog.getRestaurantDetail(
      command.request.initialRestaurantId,
    );
    if (detail === null) {
      throw new PublicApiError(
        "NOT_FOUND",
        "That restaurant is not available for orders right now.",
      );
    }
    if (detail.branchId !== command.request.initialBranchId) {
      throw new PublicApiError(
        "INVALID_INPUT",
        "The selected branch does not belong to that restaurant.",
      );
    }

    const nameByUserId = new Map(
      activeMembers.map((member) => [member.userId, member.displayName]),
    );
    const participants = [
      {
        displayName: command.identity.displayName,
        restaurantResponse: "responded",
        role: "manager",
        userId: command.identity.userId,
      } as const,
      ...[...new Set(command.request.participantUserIds)]
        .filter((userId) => userId !== command.identity.userId)
        .map(
          (userId) =>
            ({
              displayName: nameByUserId.get(userId) ?? "Group member",
              restaurantResponse: "pending",
              role: "member",
              userId,
            }) as const,
        ),
    ];

    const votingEnabled = command.request.votingMode !== "voting_disabled";
    const restaurantDeadline = votingEnabled
      ? new Date(command.request.restaurantDeadline as string)
      : command.now;
    const foodDeadline = new Date(command.request.foodDeadline);
    if (
      votingEnabled &&
      restaurantDeadline.getTime() <= command.now.getTime()
    ) {
      throw new PublicApiError(
        "INVALID_INPUT",
        "The voting deadline must be in the future.",
      );
    }
    if (
      foodDeadline.getTime() <= command.now.getTime() ||
      (votingEnabled &&
        foodDeadline.getTime() - restaurantDeadline.getTime() <
          MINIMUM_STAGE_GAP_MS)
    ) {
      throw new PublicApiError(
        "INVALID_INPUT",
        "Food picks must close after voting closes.",
      );
    }

    let shortlistRestaurantIds: readonly string[] = [];
    if (command.request.votingMode === "shortlist") {
      const ids = command.request.shortlistRestaurantIds;
      if (
        ids.length < 2 ||
        !ids.includes(command.request.initialRestaurantId)
      ) {
        throw new PublicApiError(
          "INVALID_INPUT",
          "The shortlist needs at least two restaurants and must include the fallback.",
        );
      }
      const available = new Set(
        (await repositories.catalog.listRestaurants()).map(
          (restaurant) => restaurant.restaurantId,
        ),
      );
      for (const id of ids) {
        if (!available.has(id)) {
          throw new PublicApiError(
            "INVALID_INPUT",
            "One of the shortlist restaurants is not available right now.",
          );
        }
      }
      shortlistRestaurantIds = ids;
    }

    let selected: Parameters<
      typeof repositories.orders.createOrder
    >[0]["selected"] = null;
    if (!votingEnabled) {
      const menuVersion = await repositories.catalog.findPublishedMenuVersion(
        command.request.initialBranchId,
      );
      if (menuVersion === undefined) {
        throw new PublicApiError(
          "NOT_FOUND",
          "That restaurant is not available for orders right now.",
        );
      }
      selected = {
        branchId: command.request.initialBranchId,
        branchName: detail.branchName,
        menuVersionId: menuVersion.id,
        restaurantId: command.request.initialRestaurantId,
        restaurantName: detail.restaurantName,
      };
    }

    if (command.request.saveAsGroupDefault) {
      await repositories.groupAccess.upsertGroupAddress({
        ...command.request.deliveryAddress,
        groupId: command.request.groupId,
        now: command.now,
        updatedByUserId: command.identity.userId,
      });
    }

    const created = await repositories.orders.createOrder({
      choiceMode: command.request.votingMode,
      deliveryAddressSnapshot: {
        ...command.request.deliveryAddress,
      },
      foodDeadline,
      groupId: command.request.groupId,
      initialBranchId: command.request.initialBranchId,
      initialRestaurantId: command.request.initialRestaurantId,
      managerUserId: command.identity.userId,
      now: command.now,
      participants,
      restaurantDeadline,
      selected,
      shortlistRestaurantIds,
      state: votingEnabled ? "restaurant_voting" : "food_confirmation",
    });

    await repositories.auditEvents.append({
      action: "order.created",
      actorUserId: command.identity.userId,
      details: {
        choiceMode: command.request.votingMode,
        groupId: command.request.groupId,
      },
      resourceId: created.id,
      resourceType: "order",
    });

    return { orderId: parseId<OrderId>(created.id) };
  });
}

/** Marks an order ordered or cancelled after checking management rights. */
export async function completeOrder(
  command: Readonly<{
    identity: AppIdentity;
    orderId: string;
    result: "ordered" | "cancelled";
    now: Date;
  }>,
  runner: OrdersTransactionRunner,
): Promise<Readonly<{ ok: true }>> {
  return runner.run(async (repositories) => {
    const order = await repositories.orders.findById(command.orderId);
    if (order === undefined) {
      throw new PublicApiError("NOT_FOUND", "Order not found.");
    }

    const membership = command.identity.memberships.find(
      (candidate) => candidate.groupId === order.groupId,
    );
    const canManage =
      order.managerUserId === command.identity.userId ||
      membership?.role === "group-owner";
    if (!canManage) {
      throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
    }

    let target: { state: OrderState; changed: boolean };
    try {
      target = transitionOrderState(order.state, command.result);
    } catch {
      throw new PublicApiError(
        "CONFLICT",
        command.result === "cancelled"
          ? "Only active orders can be cancelled."
          : "Only orders ready for handoff can be marked ordered.",
      );
    }
    if (!target.changed) {
      return { ok: true } as const;
    }

    await repositories.orders.setState(command.orderId, {
      completedAt: command.now,
      state: target.state,
      updatedAt: command.now,
    });
    await repositories.auditEvents.append({
      action:
        command.result === "cancelled" ? "order.cancelled" : "order.ordered",
      actorUserId: command.identity.userId,
      resourceId: command.orderId,
      resourceType: "order",
    });
    return { ok: true } as const;
  });
}

type FoodOrderRow = OrderDetailDatabaseRow & {
  readonly selectedBranchId: string;
  readonly selectedMenuVersionId: string;
};

/**
 * Loads one order for picking: visible to participants and the group Owner,
 * open in food_confirmation, and before the food deadline.
 */
async function loadOpenFoodOrder(
  identity: AppIdentity,
  orderId: string,
  now: Date,
  repositories: Pick<OrdersServiceRepositories, "orders">,
): Promise<FoodOrderRow> {
  const row = (await repositories.orders.findOrderDetail(orderId)) as
    OrderDetailDatabaseRow | undefined;
  if (row === undefined) {
    throw new PublicApiError("NOT_FOUND", "Order not found.");
  }

  const membership = identity.memberships.find(
    (candidate) => candidate.groupId === row.groupId,
  );
  const isParticipant = row.participants.some(
    (participant) => participant.userId === identity.userId,
  );
  const isOwner = membership?.role === "group-owner";
  if (!isParticipant && !isOwner) {
    throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
  }
  if (!isParticipant) {
    throw new PublicApiError(
      "FORBIDDEN",
      "Only participants can pick food for this order.",
    );
  }
  if (
    row.state !== "food_confirmation" ||
    row.selectedBranchId === null ||
    row.selectedMenuVersionId === null
  ) {
    throw new PublicApiError(
      "CONFLICT",
      "This order is not open for food picks.",
    );
  }
  if (now.getTime() >= row.foodDeadline.getTime()) {
    throw new PublicApiError(
      "CONFLICT",
      "Food picks have closed. Selections are locked in.",
    );
  }
  return row as FoodOrderRow;
}

/**
 * Expands one favorite into priced order lines against the pinned menu
 * version, or returns null when any item is missing, stale, or unavailable.
 */
async function expandFavoriteLines(
  favorite: {
    readonly items: readonly {
      readonly menuItemId: string;
      readonly quantity: number;
      readonly note: string;
    }[];
  },
  menuVersionId: string,
  repositories: Pick<OrdersServiceRepositories, "catalog">,
): Promise<readonly FoodResponseLineInput[] | null> {
  const lines: FoodResponseLineInput[] = [];
  for (const [index, item] of favorite.items.entries()) {
    const context = await repositories.catalog.findMenuItemContext(
      item.menuItemId,
    );
    if (
      context === undefined ||
      context.menuVersionId !== menuVersionId ||
      !context.isAvailable
    ) {
      return null;
    }
    lines.push({
      sourceMenuItemId: context.menuItemId,
      itemNameSnapshot: context.name,
      quantity: item.quantity,
      unitPriceCentavos: context.basePriceCentavos,
      noteSnapshot: item.note,
      lineSubtotalCentavos: context.basePriceCentavos * item.quantity,
      sortOrder: index,
    });
  }
  return lines;
}

/** Persists the participant's favorites-only food pick, decline, or reset. */
export async function submitFoodResponse(
  command: Readonly<{
    identity: AppIdentity;
    orderId: string;
    request: FoodPickRequest;
    now: Date;
  }>,
  runner: OrdersTransactionRunner,
): Promise<Readonly<{ ok: true }>> {
  return runner.run(async (repositories) => {
    const row = await loadOpenFoodOrder(
      command.identity,
      command.orderId,
      command.now,
      repositories,
    );
    const { request } = command;

    if (request.kind === "clear") {
      await repositories.orders.clearFoodResponse(
        row.orderId,
        command.identity.userId,
      );
      return { ok: true } as const;
    }

    if (request.kind === "declined") {
      await repositories.orders.upsertFoodResponse({
        favoriteId: null,
        lines: [],
        now: command.now,
        orderId: row.orderId,
        source: "declined",
        status: "declined",
        userId: command.identity.userId,
      });
      return { ok: true } as const;
    }

    const favorites =
      await repositories.favorites.listForUserAndBranchWithItems(
        command.identity.userId,
        row.selectedBranchId,
      );
    const favorite = favorites.find(
      (candidate) => candidate.id === request.favoriteId,
    );
    if (favorite === undefined) {
      throw new PublicApiError(
        "NOT_FOUND",
        "Pick one of your favorites for this restaurant.",
      );
    }
    const lines = await expandFavoriteLines(
      favorite,
      row.selectedMenuVersionId,
      repositories,
    );
    if (lines === null || lines.length === 0) {
      throw new PublicApiError(
        "CONFLICT",
        `${favorite.name} is no longer available at this restaurant. Pick another favorite or tap Not eating.`,
      );
    }

    await repositories.orders.upsertFoodResponse({
      favoriteId: favorite.id,
      lines,
      now: command.now,
      orderId: row.orderId,
      source: "saved_favorite",
      status: "confirmed",
      userId: command.identity.userId,
    });
    return { ok: true } as const;
  });
}

/** Collects expandable rank-1 favorites for the given pending participants. */
async function collectRankOneDefaults(
  pendingUserIds: readonly string[],
  selectedBranchId: string,
  selectedMenuVersionId: string,
  repositories: Pick<OrdersServiceRepositories, "catalog" | "favorites">,
): Promise<
  Map<string, { favoriteId: string; lines: readonly FoodResponseLineInput[] }>
> {
  const defaults = new Map<
    string,
    { favoriteId: string; lines: readonly FoodResponseLineInput[] }
  >();
  for (const userId of pendingUserIds) {
    const favorites =
      await repositories.favorites.listForUserAndBranchWithItems(
        userId,
        selectedBranchId,
      );
    const rankOne = favorites[0];
    if (rankOne === undefined || rankOne.items.length === 0) {
      continue;
    }
    const lines = await expandFavoriteLines(
      rankOne,
      selectedMenuVersionId,
      repositories,
    );
    if (lines === null || lines.length === 0) {
      continue;
    }
    defaults.set(userId, { favoriteId: rankOne.id, lines });
  }
  return defaults;
}

/**
 * Lazily closes food picks when the deadline has passed: materializes
 * rank-1 favorite defaults for still-pending participants and, once every
 * participant is confirmed / declined / resolved, moves to handoff.
 * Idempotent — safe to run on every read.
 */
export async function advanceFoodDeadline(
  command: Readonly<{
    identity: AppIdentity;
    orderId: string;
    now: Date;
  }>,
  runner: OrdersTransactionRunner,
): Promise<Readonly<{ advanced: boolean }>> {
  return runner.run(async (repositories) => {
    const row = (await repositories.orders.findOrderDetail(command.orderId)) as
      OrderDetailDatabaseRow | undefined;
    if (row === undefined) {
      throw new PublicApiError("NOT_FOUND", "Order not found.");
    }

    const membership = command.identity.memberships.find(
      (candidate) => candidate.groupId === row.groupId,
    );
    const isParticipant = row.participants.some(
      (participant) => participant.userId === command.identity.userId,
    );
    const isOwner = membership?.role === "group-owner";
    if (!isParticipant && !isOwner) {
      throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
    }

    if (
      row.state !== "food_confirmation" ||
      command.now.getTime() < row.foodDeadline.getTime() ||
      row.selectedBranchId === null ||
      row.selectedMenuVersionId === null
    ) {
      return { advanced: false } as const;
    }

    const pendingUserIds = row.participants
      .filter((participant) => participant.foodResponse === "pending")
      .map((participant) => participant.userId);
    const pendingByUser = new Set(pendingUserIds);

    const defaults = await collectRankOneDefaults(
      pendingUserIds,
      row.selectedBranchId,
      row.selectedMenuVersionId,
      repositories,
    );

    // The policy carries explicit selections opaquely; this engine consumes
    // only its classification (default / declined / unresolved), so already
    // persisted responses are represented with an empty inline selection.
    const emptySelection: FoodSelectionSnapshot = {
      items: [],
      source: { kind: "inline" },
    };
    const responses: readonly FoodDeadlineResponse[] = row.participants
      .filter((participant) => participant.foodResponse !== "pending")
      .map((participant) =>
        participant.foodResponse === "confirmed"
          ? {
              kind: "confirmed" as const,
              selection: emptySelection,
              userId: parseId<UserId>(participant.userId),
            }
          : {
              kind: "declined" as const,
              userId: parseId<UserId>(participant.userId),
            },
      );

    const resolution = resolveFoodDeadline({
      participants: row.participants.map((participant) => ({
        rankOneAvailable: defaults.has(participant.userId),
        rankOneSelection:
          defaults.get(participant.userId) === undefined
            ? null
            : {
                items:
                  defaults.get(participant.userId)?.lines.map((line) => ({
                    menuItemId: parseId<MenuItemId>(line.sourceMenuItemId),
                    name: line.itemNameSnapshot,
                    quantity: line.quantity,
                    unitPriceCentavos: parseCentavos(line.unitPriceCentavos),
                    variant: null,
                    modifiers: [],
                    note: line.noteSnapshot,
                  })) ?? [],
                source: {
                  favoriteId: parseId<FavoriteId>(
                    defaults.get(participant.userId)?.favoriteId ?? "",
                  ),
                  kind: "saved_favorite" as const,
                },
              },
        userId: parseId<UserId>(participant.userId),
      })),
      responses,
    });

    let materialized = 0;
    for (const selection of resolution.selections) {
      if (!pendingByUser.has(selection.userId)) {
        continue;
      }
      const fallback = defaults.get(selection.userId);
      if (fallback === undefined) {
        continue;
      }
      await repositories.orders.upsertFoodResponse({
        favoriteId: fallback.favoriteId,
        lines: fallback.lines,
        now: command.now,
        orderId: row.orderId,
        source: "saved_favorite",
        status: "confirmed",
        userId: selection.userId,
      });
      materialized += 1;
    }

    if (resolution.unresolvedUserIds.length === 0) {
      const target = transitionOrderState(row.state, "ready_for_handoff");
      if (target.changed) {
        await repositories.orders.setState(row.orderId, {
          completedAt: null,
          state: target.state,
          updatedAt: command.now,
        });
        return { advanced: true } as const;
      }
    }
    return { advanced: materialized > 0 } as const;
  });
}

/**
 * Finishes the order early at the manager's request: rank-1 favorites are
 * ordered for still-pending participants, no-favorite participants are left
 * empty, and the order moves straight to ordered (History).
 */
export async function finishOrder(
  command: Readonly<{
    identity: AppIdentity;
    orderId: string;
    now: Date;
  }>,
  runner: OrdersTransactionRunner,
): Promise<Readonly<{ ok: true }>> {
  return runner.run(async (repositories) => {
    const row = (await repositories.orders.findOrderDetail(command.orderId)) as
      OrderDetailDatabaseRow | undefined;
    if (row === undefined) {
      throw new PublicApiError("NOT_FOUND", "Order not found.");
    }

    const membership = command.identity.memberships.find(
      (candidate) => candidate.groupId === row.groupId,
    );
    const isParticipant = row.participants.some(
      (participant) => participant.userId === command.identity.userId,
    );
    const isOwner = membership?.role === "group-owner";
    if (!isParticipant && !isOwner) {
      throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
    }
    if (row.managerUserId !== command.identity.userId && !isOwner) {
      throw new PublicApiError(
        "FORBIDDEN",
        "Only the order manager can finish this order early.",
      );
    }

    if (
      row.state !== "food_confirmation" ||
      row.selectedBranchId === null ||
      row.selectedMenuVersionId === null
    ) {
      throw new PublicApiError(
        "CONFLICT",
        "Only orders in food picks can be finished early.",
      );
    }

    const pendingUserIds = row.participants
      .filter((participant) => participant.foodResponse === "pending")
      .map((participant) => participant.userId);
    const defaults = await collectRankOneDefaults(
      pendingUserIds,
      row.selectedBranchId,
      row.selectedMenuVersionId,
      repositories,
    );
    for (const userId of pendingUserIds) {
      const fallback = defaults.get(userId);
      if (fallback === undefined) {
        continue;
      }
      await repositories.orders.upsertFoodResponse({
        favoriteId: fallback.favoriteId,
        lines: fallback.lines,
        now: command.now,
        orderId: row.orderId,
        source: "saved_favorite",
        status: "confirmed",
        userId,
      });
    }

    const target = transitionOrderState(row.state, "ordered");
    await repositories.orders.setState(row.orderId, {
      completedAt: command.now,
      state: target.state,
      updatedAt: command.now,
    });
    await repositories.auditEvents.append({
      action: "order.ordered",
      actorUserId: command.identity.userId,
      details: { finishedEarly: true },
      resourceId: row.orderId,
      resourceType: "order",
    });
    return { ok: true } as const;
  });
}

export type OrderViewerRole = Readonly<{
  readonly kind: "participant" | "group-leader";
  readonly canManage: boolean;
}>;

export interface ViewerFavoriteRow {
  readonly favoriteId: string;
  readonly rank: number;
  readonly name: string;
  readonly description: string | null;
  readonly menuItemId: string | null;
  readonly priceCentavos: number | null;
  readonly available: boolean;
}

export interface OrderLineViewRow {
  readonly userId: string;
  readonly itemName: string;
  readonly quantity: number;
  readonly unitPriceCentavos: number;
  readonly note: string;
  readonly lineSubtotalCentavos: number;
}

export interface OrderDetailView {
  readonly order: {
    readonly orderId: string;
    readonly groupId: string;
    readonly groupName: string;
    readonly state: OrderState;
    readonly choiceMode: "voting_disabled" | "shortlist" | "global_catalog";
    readonly restaurantName: string | null;
    readonly selectedRestaurantId: string | null;
    readonly selectedBranchId: string | null;
    readonly selectedBranchName: string | null;
    readonly initialRestaurantId: string;
    readonly initialRestaurantName: string;
    readonly initialBranchName: string;
    readonly deliveryAddress: DeliveryAddress;
    readonly restaurantDeadline: Date;
    readonly foodDeadline: Date;
    readonly createdAt: Date;
    readonly completedAt: Date | null;
  };
  readonly participants: readonly {
    readonly userId: string;
    readonly displayName: string;
    readonly role: "manager" | "member";
    readonly restaurantResponse: "pending" | "responded";
    readonly foodResponse: "pending" | "confirmed" | "declined" | "resolved";
  }[];
  readonly viewerFavorites: readonly ViewerFavoriteRow[];
  readonly lines: readonly OrderLineViewRow[];
  readonly viewer: OrderViewerRole;
}

interface OrderDetailDatabaseRow {
  readonly orderId: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly managerUserId: string;
  readonly state: OrderState;
  readonly choiceMode: "voting_disabled" | "shortlist" | "global_catalog";
  readonly initialRestaurantName: string;
  readonly initialBranchName: string;
  readonly selectedRestaurantName: string | null;
  readonly selectedRestaurantId: string | null;
  readonly selectedBranchId: string | null;
  readonly selectedBranchName: string | null;
  readonly selectedMenuVersionId: string | null;
  readonly initialRestaurantId: string;
  readonly deliveryAddressSnapshot: unknown;
  readonly restaurantDeadline: Date;
  readonly foodDeadline: Date;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly participants: readonly {
    readonly userId: string;
    readonly displayName: string;
    readonly role: "manager" | "member";
    readonly restaurantResponse: "pending" | "responded";
    readonly foodResponse: "pending" | "confirmed" | "declined" | "resolved";
  }[];
}

/**
 * Loads one order for a viewer after lazily advancing deadline-driven state.
 * Stage 1 advance is intentionally a no-op seam; Stage 2 resolves voting here.
 */
export async function loadOrderDetail(
  command: Readonly<{
    identity: AppIdentity;
    orderId: string;
    now: Date;
  }>,
  repositories: Pick<OrdersServiceRepositories, "favorites" | "orders">,
): Promise<OrderDetailView> {
  const row = (await repositories.orders.findOrderDetail(command.orderId)) as
    OrderDetailDatabaseRow | undefined;
  if (row === undefined) {
    throw new PublicApiError("NOT_FOUND", "Order not found.");
  }

  const membership = command.identity.memberships.find(
    (candidate) => candidate.groupId === row.groupId,
  );
  const isParticipant = row.participants.some(
    (participant) => participant.userId === command.identity.userId,
  );
  const isOwner = membership?.role === "group-owner";
  const isTerminal = row.state === "ordered" || row.state === "cancelled";
  const isGroupLeader = isOwner || membership?.role === "manager";
  const canView = isTerminal
    ? membership !== undefined && (isParticipant || isGroupLeader)
    : isParticipant || isOwner;
  if (!canView) {
    throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
  }

  let deliveryAddress: DeliveryAddress;
  try {
    deliveryAddress = parseDeliveryAddress(
      row.deliveryAddressSnapshot,
      "Saved order address",
    );
  } catch {
    // Invariant: address snapshots are validated on write, so a parse failure
    // here means the persisted row is corrupt — a server-side data fault.
    throw new PublicApiError(
      "INTERNAL_FAILURE",
      "This order's saved address could not be read.",
    );
  }

  const isFoodStage = row.state !== "restaurant_voting";

  let viewerFavorites: readonly ViewerFavoriteRow[] = [];
  if (
    row.state === "food_confirmation" &&
    row.selectedBranchId !== null &&
    row.participants.some(
      (participant) => participant.userId === command.identity.userId,
    )
  ) {
    const favoriteRows = await repositories.favorites.listForUser(
      command.identity.userId,
    );
    viewerFavorites = favoriteRows
      .filter(
        (favorite) =>
          favorite.branchId === row.selectedBranchId &&
          favorite.menuItemId !== null,
      )
      .map((favorite) => ({
        available: favorite.isCurrentlyAvailable === true,
        description: favorite.itemDescription,
        favoriteId: favorite.favoriteId,
        menuItemId: favorite.menuItemId,
        name: favorite.name,
        priceCentavos: favorite.currentPriceCentavos,
        rank: favorite.rank,
      }))
      .sort((left, right) => left.rank - right.rank);
  }

  const lineRows = isFoodStage
    ? await repositories.orders.listOrderLines(row.orderId)
    : [];
  const allLines: readonly OrderLineViewRow[] = lineRows.map((line) => ({
    userId: line.userId,
    itemName: line.itemNameSnapshot,
    quantity: line.quantity,
    unitPriceCentavos: line.unitPriceCentavos,
    note: line.noteSnapshot,
    lineSubtotalCentavos: line.lineSubtotalCentavos,
  }));
  const participants =
    isTerminal && !isGroupLeader
      ? row.participants.filter(
          (participant) => participant.userId === command.identity.userId,
        )
      : row.participants;
  const lines =
    isTerminal && !isGroupLeader
      ? allLines.filter((line) => line.userId === command.identity.userId)
      : allLines;

  return {
    lines,
    order: {
      orderId: row.orderId,
      groupId: row.groupId,
      groupName: row.groupName,
      state: row.state,
      choiceMode: row.choiceMode,
      restaurantName: row.selectedRestaurantName,
      selectedRestaurantId: row.selectedRestaurantId,
      selectedBranchId: row.selectedBranchId,
      selectedBranchName: row.selectedBranchName,
      initialRestaurantId: row.initialRestaurantId,
      initialRestaurantName: row.initialRestaurantName,
      initialBranchName: row.initialBranchName,
      deliveryAddress,
      restaurantDeadline: row.restaurantDeadline,
      foodDeadline: row.foodDeadline,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    },
    participants,
    viewer: {
      kind: isParticipant ? "participant" : "group-leader",
      canManage: isTerminal
        ? isGroupLeader
        : row.managerUserId === command.identity.userId || isOwner,
    },
    viewerFavorites,
  };
}

export interface HistoryParticipantSummary {
  readonly displayName: string;
  readonly foodResponse: "pending" | "confirmed" | "declined" | "resolved";
  readonly itemCount: number;
  readonly subtotalCentavos: Centavos;
  readonly userId: string;
}

export interface OrderSummary {
  readonly orderId: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly state: OrderState;
  readonly restaurantName: string | null;
  readonly deadline: Date | null;
  readonly participantsVoted: number;
  readonly participantsTotal: number;
  readonly completedAt: Date | null;
  readonly participants: readonly HistoryParticipantSummary[];
}

/** Returns whether the viewer may inspect every person's terminal-order log. */
function canViewGroupHistory(identity: AppIdentity, groupId: string): boolean {
  const role = identity.memberships.find(
    (membership) => membership.groupId === groupId,
  )?.role;
  return role === "group-owner" || role === "manager";
}

/** Lists the viewer's active and historical order summaries. */
export async function listOrderSummaries(
  command: Readonly<{ identity: AppIdentity }>,
  repositories: Pick<OrdersServiceRepositories, "orders">,
): Promise<
  Readonly<{
    active: readonly OrderSummary[];
    history: readonly OrderSummary[];
  }>
> {
  const rows = (
    await repositories.orders.listVisibleForUser(command.identity.userId)
  ).filter((row) =>
    command.identity.memberships.some(
      (membership) => membership.groupId === row.groupId,
    ),
  );
  const terminalOrderIds = rows
    .filter((row) => row.state === "ordered" || row.state === "cancelled")
    .map((row) => row.orderId);
  const lineRows =
    terminalOrderIds.length === 0
      ? []
      : await repositories.orders.listOrderLinesForOrders(terminalOrderIds);
  const linesByParticipant = new Map<string, typeof lineRows>();
  for (const line of lineRows) {
    const key = `${line.orderId}:${line.userId}`;
    linesByParticipant.set(key, [...(linesByParticipant.get(key) ?? []), line]);
  }

  const summaries: OrderSummary[] = rows.map((row) => {
    const isTerminal = row.state === "ordered" || row.state === "cancelled";
    const visibleParticipants = !isTerminal
      ? []
      : canViewGroupHistory(command.identity, row.groupId)
        ? row.participants
        : row.participants.filter(
            (participant) => participant.userId === command.identity.userId,
          );
    return {
      completedAt: row.completedAt,
      deadline:
        row.state === "restaurant_voting"
          ? row.restaurantDeadline
          : row.state === "food_confirmation"
            ? row.foodDeadline
            : null,
      groupId: row.groupId,
      groupName: row.groupName,
      orderId: row.orderId,
      participants: visibleParticipants.map((participant) => {
        const lines =
          linesByParticipant.get(`${row.orderId}:${participant.userId}`) ?? [];
        return {
          displayName: participant.displayName,
          foodResponse: participant.foodResponse,
          itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
          subtotalCentavos: parseCentavos(
            lines.reduce((sum, line) => sum + line.lineSubtotalCentavos, 0),
          ),
          userId: participant.userId,
        };
      }),
      participantsTotal: row.participants.length,
      participantsVoted: row.participants.filter(
        (participant) => participant.restaurantResponse === "responded",
      ).length,
      restaurantName: row.selectedRestaurantName,
      state: row.state,
    };
  });

  const active = summaries
    .filter(
      (summary) => summary.state !== "ordered" && summary.state !== "cancelled",
    )
    .sort((left, right) => {
      const leftTime = left.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  const history = summaries
    .filter(
      (summary) => summary.state === "ordered" || summary.state === "cancelled",
    )
    .sort(
      (left, right) =>
        (right.completedAt?.getTime() ?? 0) -
        (left.completedAt?.getTime() ?? 0),
    );

  return { active, history };
}
