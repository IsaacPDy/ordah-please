import { describe, expect, it, vi } from "vitest";

import { parseOrderCreateRequest } from "@ordah-please/contracts";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";
import {
  completeOrder,
  createGroupOrder,
  loadOrderDetail,
  listOrderSummaries,
} from "./orders-service";
import type { OrdersServiceRepositories } from "./orders-service";

const managerId = parseId<UserId>("11111111-1111-4111-8111-111111111111");
const memberId = parseId<UserId>("22222222-2222-4222-8222-222222222222");
const outsiderId = parseId<UserId>("33333333-3333-4333-8333-333333333333");
const ownerId = parseId<UserId>("44444444-4444-4444-8444-444444444444");
const groupId = parseId<GroupId>("55555555-5555-4555-8555-555555555555");
const restaurantId = "66666666-6666-4666-8666-666666666666";
const branchId = "77777777-7777-4777-8777-777777777777";
const menuVersionId = "88888888-8888-4888-8888-888888888888";
const orderId = "99999999-9999-4999-8999-999999999999";
const votingOrderId = "aaaaaaa1-0000-4000-8000-000000000001";
const foodOrderId = "aaaaaaa1-0000-4000-8000-000000000002";
const handoffOrderId = "aaaaaaa1-0000-4000-8000-000000000003";
const orderedOrderId = "aaaaaaa1-0000-4000-8000-000000000004";
const cancelledOrderId = "aaaaaaa1-0000-4000-8000-000000000005";

const now = new Date("2026-08-18T08:00:00.000Z");

function identityFor(
  userId: typeof managerId,
  role: "group-owner" | "manager" | "member",
): AppIdentity {
  return {
    authUserId: "auth-1",
    displayName: "Test User",
    email: "test@example.com",
    imageUrl: null,
    isPlatformAdmin: false,
    memberships: [{ groupId, role }],
    userId,
  };
}

function createRepositories(overrides: Partial<OrdersServiceRepositories> = {}): OrdersServiceRepositories {
  return {
    auditEvents: { append: vi.fn(() => Promise.resolve(({}))) },
    catalog: {
      findPublishedMenuVersion: vi.fn(() => Promise.resolve(({ id: menuVersionId }))),
      getRestaurantDetail: vi.fn(() => Promise.resolve(({
        branchId,
        branchName: "Main Branch",
        restaurantName: "Test Restaurant",
      }))),
      listRestaurants: vi.fn(() => Promise.resolve([
        { branchId, restaurantId },
        { branchId: "aaaaaaaa-0000-4000-8000-000000000003", restaurantId: "aaaaaaaa-0000-4000-8000-000000000001" },
        { branchId: "aaaaaaaa-0000-4000-8000-000000000004", restaurantId: "aaaaaaaa-0000-4000-8000-000000000002" },
      ])),
    },
    groupAccess: {
      findGroupAddress: vi.fn(() => Promise.resolve(undefined)),
      listActiveMembers: vi.fn(() => Promise.resolve([
        { displayName: "Order Manager", role: "owner", userId: managerId },
        { displayName: "Order Member", role: "member", userId: memberId },
        { displayName: "Group Owner", role: "owner", userId: ownerId },
      ])),
      upsertGroupAddress: vi.fn(() => Promise.resolve(({ id: "address-1" }))),
    },
    orders: {
      createOrder: vi.fn(() => Promise.resolve(({ id: orderId }))),
      findOrderDetail: vi.fn(),
      findById: vi.fn(),
      listVisibleForUser: vi.fn(() => Promise.resolve([])),
      setState: vi.fn(() => Promise.resolve(({}))),
    },
    ...overrides,
  } as OrdersServiceRepositories;
}

function runnerFor(repositories: OrdersServiceRepositories) {
  return {
    run: <Result>(
      operation: (repos: OrdersServiceRepositories) => Promise<Result>,
    ) => operation(repositories),
  };
}

function votingRequest(overrides: Record<string, unknown> = {}) {
  return parseOrderCreateRequest({
    deliveryAddress: {
      city: "Naga",
      lineOne: "12 Sample Street",
      lineTwo: null,
      notes: null,
      phoneNumber: "+63 900 000 0000",
      postalCode: null,
      recipientName: "Mia Tan",
    },
    foodDeadline: "2026-08-18T10:00:00.000Z",
    groupId,
    initialBranchId: branchId,
    initialRestaurantId: restaurantId,
    participantUserIds: [memberId],
    restaurantDeadline: "2026-08-18T09:00:00.000Z",
    saveAsGroupDefault: false,
    shortlistRestaurantIds: [],
    votingMode: "global_catalog",
    ...overrides,
  });
}

describe("createGroupOrder", () => {
  it("creates a voting order with the manager auto-enrolled", async () => {
    const repositories = createRepositories();
    const result = await createGroupOrder(
      {
        identity: identityFor(managerId, "manager"),
        now,
        request: votingRequest(),
      },
      runnerFor(repositories),
    );
    expect(result.orderId).toBe(orderId);
    expect(repositories.orders.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        choiceMode: "global_catalog",
        managerUserId: managerId,
        participants: [
          expect.objectContaining({ role: "manager", userId: managerId }),
          expect.objectContaining({ role: "member", userId: memberId }),
        ],
        state: "restaurant_voting",
      }),
    );
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.created", resourceId: orderId }),
    );
  });

  it("creates a voting-disabled order with the fallback pinned", async () => {
    const repositories = createRepositories();
    const request = votingRequest({
      restaurantDeadline: null,
      votingMode: "voting_disabled",
    });
    await createGroupOrder(
      { identity: identityFor(managerId, "manager"), now, request },
      runnerFor(repositories),
    );
    expect(repositories.orders.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantDeadline: now,
        selected: expect.objectContaining({ menuVersionId }) as Record<string, unknown>,
        state: "food_confirmation",
      }),
    );
  });

  it("rejects creation by a plain member", async () => {
    const repositories = createRepositories();
    await expect(
      createGroupOrder(
        {
          identity: identityFor(memberId, "member"),
          now,
          request: votingRequest(),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects participants outside the group", async () => {
    const repositories = createRepositories();
    await expect(
      createGroupOrder(
        {
          identity: identityFor(managerId, "manager"),
          now,
          request: votingRequest({ participantUserIds: [outsiderId] }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects an unknown fallback restaurant", async () => {
    const repositories = createRepositories({
      catalog: {
        ...createRepositories().catalog,
        getRestaurantDetail: vi.fn(() => Promise.resolve(null)),
      },
    });
    await expect(
      createGroupOrder(
        { identity: identityFor(managerId, "manager"), now, request: votingRequest() },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects deadlines that are past or too close together", async () => {
    const repositories = createRepositories();
    await expect(
      createGroupOrder(
        {
          identity: identityFor(managerId, "manager"),
          now,
          request: votingRequest({
            restaurantDeadline: "2026-08-18T07:30:00.000Z",
          }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    await expect(
      createGroupOrder(
        {
          identity: identityFor(managerId, "manager"),
          now,
          request: votingRequest({
            foodDeadline: "2026-08-18T09:00:30.000Z",
          }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("enforces shortlist size and fallback membership", async () => {
    const repositories = createRepositories();
    await expect(
      createGroupOrder(
        {
          identity: identityFor(managerId, "manager"),
          now,
          request: votingRequest({
            shortlistRestaurantIds: [restaurantId],
            votingMode: "shortlist",
          }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });

    await expect(
      createGroupOrder(
        {
          identity: identityFor(managerId, "manager"),
          now,
          request: votingRequest({
            shortlistRestaurantIds: [
              "aaaaaaaa-0000-4000-8000-000000000001",
              "aaaaaaaa-0000-4000-8000-000000000002",
            ],
            votingMode: "shortlist",
          }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("saves the address as the group default when asked", async () => {
    const repositories = createRepositories();
    await createGroupOrder(
      {
        identity: identityFor(managerId, "manager"),
        now,
        request: votingRequest({ saveAsGroupDefault: true }),
      },
      runnerFor(repositories),
    );
    expect(repositories.groupAccess.upsertGroupAddress).toHaveBeenCalled();
  });
});

describe("completeOrder", () => {
  it("lets the order manager cancel an active order", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findById: vi.fn(() => Promise.resolve(({
          completedAt: null,
          groupId,
          managerUserId: managerId,
          state: "restaurant_voting" as const,
        }))),
      },
    });
    await completeOrder(
      {
        identity: identityFor(managerId, "manager"),
        now,
        orderId,
        result: "cancelled",
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.setState).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ state: "cancelled" }),
    );
  });

  it("lets the group owner cancel without being a participant", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findById: vi.fn(() => Promise.resolve(({
          completedAt: null,
          groupId,
          managerUserId: managerId,
          state: "food_confirmation" as const,
        }))),
      },
    });
    await completeOrder(
      {
        identity: identityFor(ownerId, "group-owner"),
        now,
        orderId,
        result: "cancelled",
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.setState).toHaveBeenCalled();
  });

  it("rejects cancellation by a plain participant", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findById: vi.fn(() => Promise.resolve(({
          completedAt: null,
          groupId,
          managerUserId: managerId,
          state: "restaurant_voting" as const,
        }))),
      },
    });
    await expect(
      completeOrder(
        {
          identity: identityFor(memberId, "member"),
          now,
          orderId,
          result: "cancelled",
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("marks an order ordered only from handoff state", async () => {
    const handoffRepos = createRepositories({
      orders: {
        ...createRepositories().orders,
        findById: vi.fn(() => Promise.resolve(({
          completedAt: null,
          groupId,
          managerUserId: managerId,
          state: "ready_for_handoff" as const,
        }))),
      },
    });
    await completeOrder(
      {
        identity: identityFor(managerId, "manager"),
        now,
        orderId,
        result: "ordered",
      },
      runnerFor(handoffRepos),
    );
    expect(handoffRepos.orders.setState).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ state: "ordered" }),
    );

    const votingRepos = createRepositories({
      orders: {
        ...createRepositories().orders,
        findById: vi.fn(() => Promise.resolve(({
          completedAt: null,
          groupId,
          managerUserId: managerId,
          state: "restaurant_voting" as const,
        }))),
      },
    });
    await expect(
      completeOrder(
        {
          identity: identityFor(managerId, "manager"),
          now,
          orderId,
          result: "ordered",
        },
        runnerFor(votingRepos),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("listOrderSummaries", () => {
  const summaryRow = (overrides: Record<string, unknown>) => ({
    completedAt: null,
    createdAt: now,
    foodDeadline: new Date("2026-08-18T10:00:00.000Z"),
    groupId,
    groupName: "Test Group",
    initialRestaurantId: restaurantId,
    managerUserId: managerId,
    orderId,
    participants: [
      { displayName: "Order Manager", foodResponse: "pending", restaurantResponse: "responded", role: "manager", userId: managerId } as const,
      { displayName: "Order Member", foodResponse: "pending", restaurantResponse: "pending", role: "member", userId: memberId } as const,
    ],
    restaurantDeadline: new Date("2026-08-18T09:00:00.000Z"),
    selectedRestaurantName: null,
    state: "restaurant_voting" as const,
    ...overrides,
  });

  it("splits active and history buckets with correct ordering, deadlines, and counts", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        listVisibleForUser: vi.fn(() => Promise.resolve([
          summaryRow({
            orderId: orderedOrderId,
            participants: [
              { displayName: "Order Manager", foodResponse: "resolved", restaurantResponse: "responded", role: "manager", userId: managerId },
              { displayName: "Order Member", foodResponse: "resolved", restaurantResponse: "responded", role: "member", userId: memberId },
            ] as const,
            state: "ordered" as const,
            completedAt: new Date("2026-08-18T12:00:00.000Z"),
          }),
          summaryRow({
            orderId: foodOrderId,
            participants: [
              { displayName: "Order Manager", foodResponse: "confirmed", restaurantResponse: "responded", role: "manager", userId: managerId },
              { displayName: "Order Member", foodResponse: "pending", restaurantResponse: "pending", role: "member", userId: memberId } as const,
              { displayName: "Group Owner", foodResponse: "pending", restaurantResponse: "responded", role: "member", userId: ownerId } as const,
            ] as const,
            state: "food_confirmation" as const,
          }),
          summaryRow({
            orderId: cancelledOrderId,
            completedAt: new Date("2026-08-17T09:00:00.000Z"),
            state: "cancelled" as const,
          }),
          summaryRow({
            orderId: votingOrderId,
            state: "restaurant_voting" as const,
          }),
          summaryRow({
            orderId: handoffOrderId,
            state: "ready_for_handoff" as const,
          }),
        ])),
      },
    });

    const result = await listOrderSummaries({ userId: memberId }, repositories);

    expect(result.active.map((summary) => summary.orderId)).toEqual([
      votingOrderId,
      foodOrderId,
      handoffOrderId,
    ]);
    expect(result.history.map((summary) => summary.orderId)).toEqual([
      orderedOrderId,
      cancelledOrderId,
    ]);

    const voting = result.active[0]!;
    const food = result.active[1]!;
    const handoff = result.active[2]!;
    expect(voting.deadline).toEqual(new Date("2026-08-18T09:00:00.000Z"));
    expect(voting.participantsVoted).toBe(1);
    expect(voting.participantsTotal).toBe(2);
    expect(food.deadline).toEqual(new Date("2026-08-18T10:00:00.000Z"));
    expect(food.participantsVoted).toBe(2);
    expect(food.participantsTotal).toBe(3);
    expect(handoff.deadline).toBeNull();
    expect(handoff.participantsVoted).toBe(1);
    expect(handoff.participantsTotal).toBe(2);
  });
});

describe("loadOrderDetail visibility", () => {
  const detailRow = () => ({
    choiceMode: "global_catalog",
    completedAt: null,
    createdAt: now,
    deliveryAddressSnapshot: {
      city: "Naga",
      lineOne: "12 Sample Street",
      lineTwo: null,
      notes: null,
      phoneNumber: "+63 900 000 0000",
      postalCode: null,
      recipientName: "Mia Tan",
    },
    foodDeadline: new Date("2026-08-18T10:00:00.000Z"),
    groupId,
    groupName: "Test Group",
    initialBranchGrabUrl: null,
    initialBranchId: branchId,
    initialBranchName: "Main Branch",
    initialRestaurantId: restaurantId,
    initialRestaurantName: "Test Restaurant",
    managerUserId: managerId,
    orderId,
    restaurantDeadline: new Date("2026-08-18T09:00:00.000Z"),
    selectedBranchId: null,
    selectedBranchName: null,
    selectedMenuVersionId: null,
    selectedRestaurantId: null,
    selectedRestaurantName: null,
    state: "restaurant_voting",
    participants: [
      { displayName: "Order Manager", foodResponse: "pending", restaurantResponse: "responded", role: "manager", userId: managerId },
      { displayName: "Order Member", foodResponse: "pending", restaurantResponse: "pending", role: "member", userId: memberId },
    ],
  });

  it("serves a participant", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() => Promise.resolve(detailRow())),
      },
    });
    const view = await loadOrderDetail(
      { identity: identityFor(memberId, "member"), now, orderId },
      repositories,
    );
    expect(view.order.orderId).toBe(orderId);
    expect(view.viewer.kind).toBe("participant");
  });

  it("serves the group owner with management rights", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() => Promise.resolve(detailRow())),
      },
    });
    const view = await loadOrderDetail(
      { identity: identityFor(ownerId, "group-owner"), now, orderId },
      repositories,
    );
    expect(view.viewer.canManage).toBe(true);
  });

  it("hides the order from everyone else", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() => Promise.resolve(detailRow())),
      },
    });
    await expect(
      loadOrderDetail(
        { identity: { ...identityFor(outsiderId, "member"), memberships: [] }, now, orderId },
        repositories,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("maps a malformed stored address snapshot to a public error", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() => Promise.resolve(({
          ...detailRow(),
          deliveryAddressSnapshot: { city: 42 },
        }))),
      },
    });
    await expect(
      loadOrderDetail(
        { identity: identityFor(memberId, "member"), now, orderId },
        repositories,
      ),
    ).rejects.toMatchObject({
      code: "INTERNAL_FAILURE",
      message: "This order's saved address could not be read.",
    });
  });
});
