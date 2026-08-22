import {
  parseDeliveryAddress,
  PublicApiError,
  type OrderCreateRequest,
} from "@ordah-please/contracts";
import {
  parseId,
  transitionOrderState,
  type DeliveryAddress,
  type OrderId,
  type OrderState,
} from "@ordah-please/domain";

import { requireGroupRole } from "../../application/group-authorization";
import type { AppIdentity } from "../../auth/load-app-identity";

const FORBIDDEN_MESSAGE = "You do not have access to this action.";
const MINIMUM_STAGE_GAP_MS = 60_000;

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
    readonly findPublishedMenuVersion: (
      branchId: string,
    ) => Promise<{ readonly id: string } | undefined>;
    readonly getRestaurantDetail: (
      restaurantId: string,
    ) => Promise<{
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
          readonly foodResponse: "pending" | "confirmed" | "declined" | "resolved";
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
    if (votingEnabled && restaurantDeadline.getTime() <= command.now.getTime()) {
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
      if (ids.length < 2 || !ids.includes(command.request.initialRestaurantId)) {
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

    let selected: Parameters<typeof repositories.orders.createOrder>[0]["selected"] =
      null;
    if (!votingEnabled) {
      const menuVersion =
        await repositories.catalog.findPublishedMenuVersion(
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
      action: command.result === "cancelled" ? "order.cancelled" : "order.ordered",
      actorUserId: command.identity.userId,
      resourceId: command.orderId,
      resourceType: "order",
    });
    return { ok: true } as const;
  });
}

export type OrderViewerRole = Readonly<{
  readonly kind: "participant" | "owner";
  readonly canManage: boolean;
}>;

export interface OrderDetailView {
  readonly order: {
    readonly orderId: string;
    readonly groupId: string;
    readonly groupName: string;
    readonly state: OrderState;
    readonly choiceMode: "voting_disabled" | "shortlist" | "global_catalog";
    readonly restaurantName: string | null;
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
  repositories: Pick<OrdersServiceRepositories, "orders">,
): Promise<OrderDetailView> {
  const row = (await repositories.orders.findOrderDetail(
    command.orderId,
  )) as OrderDetailDatabaseRow | undefined;
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

  return {
    order: {
      orderId: row.orderId,
      groupId: row.groupId,
      groupName: row.groupName,
      state: row.state,
      choiceMode: row.choiceMode,
      restaurantName: row.selectedRestaurantName,
      initialRestaurantName: row.initialRestaurantName,
      initialBranchName: row.initialBranchName,
      deliveryAddress,
      restaurantDeadline: row.restaurantDeadline,
      foodDeadline: row.foodDeadline,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    },
    participants: row.participants,
    viewer: {
      kind: isOwner && !isParticipant ? "owner" : "participant",
      canManage: row.managerUserId === command.identity.userId || isOwner,
    },
  };
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
}

/** Lists the viewer's active and historical order summaries. */
export async function listOrderSummaries(
  command: Readonly<{ userId: string }>,
  repositories: Pick<OrdersServiceRepositories, "orders">,
): Promise<Readonly<{ active: readonly OrderSummary[]; history: readonly OrderSummary[] }>> {
  const rows = await repositories.orders.listVisibleForUser(command.userId);
  const summaries = rows.map((row) => ({
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
    participantsTotal: row.participants.length,
    participantsVoted: row.participants.filter(
      (participant) => participant.restaurantResponse === "responded",
    ).length,
    restaurantName: row.selectedRestaurantName,
    state: row.state,
  }));

  const active = summaries
    .filter((summary) => summary.state !== "ordered" && summary.state !== "cancelled")
    .sort((left, right) => {
      const leftTime = left.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  const history = summaries
    .filter(
      (summary) => summary.state === "ordered" || summary.state === "cancelled",
    )
    .sort((left, right) =>
      (right.completedAt?.getTime() ?? 0) - (left.completedAt?.getTime() ?? 0),
    );

  return { active, history };
}
