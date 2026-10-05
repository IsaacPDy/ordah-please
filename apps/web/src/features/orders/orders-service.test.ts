import { describe, expect, it, vi } from "vitest";

import {
  parseFoodPickRequest,
  parseOrderCreateRequest,
} from "@ordah-please/contracts";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";
import {
  advanceFoodDeadline,
  completeOrder,
  createGroupOrder,
  finishOrder,
  loadOrderDetail,
  listActiveOrderSummaries,
  encodeOrderHistoryCursor,
  listOrderSummaryPage,
  loadOrderHistoryDetail,
  listOrderSummaries,
  parseOrderHistoryCursor,
  submitFoodResponse,
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
const favoriteId = "bbbbbbb1-0000-4000-8000-000000000001";
const menuItemId = "bbbbbbb1-0000-4000-8000-000000000003";
const orderId = "99999999-9999-4999-8999-999999999999";
const votingOrderId = "aaaaaaa1-0000-4000-8000-000000000001";
const foodOrderId = "aaaaaaa1-0000-4000-8000-000000000002";
const handoffOrderId = "aaaaaaa1-0000-4000-8000-000000000003";
const orderedOrderId = "aaaaaaa1-0000-4000-8000-000000000004";
const cancelledOrderId = "aaaaaaa1-0000-4000-8000-000000000005";

const now = new Date("2026-08-18T08:00:00.000Z");

describe("order history cursors", () => {
  it("round-trips a stable terminal history cursor", () => {
    const cursor = {
      orderId,
      sortTime: new Date("2026-09-10T16:30:00.000Z"),
    };

    expect(parseOrderHistoryCursor(encodeOrderHistoryCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("rejects malformed terminal history cursors", () => {
    expect(() => parseOrderHistoryCursor("not-a-cursor")).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });
});

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

function createRepositories(
  overrides: Partial<OrdersServiceRepositories> = {},
): OrdersServiceRepositories {
  return {
    auditEvents: { append: vi.fn(() => Promise.resolve({})) },
    catalog: {
      findMenuItemContext: vi.fn(() =>
        Promise.resolve({
          branchId,
          basePriceCentavos: 22500,
          isAvailable: true,
          menuItemId,
          menuVersionId,
          name: "Zinger Combo",
        }),
      ),
      findPublishedMenuVersion: vi.fn(() =>
        Promise.resolve({ id: menuVersionId }),
      ),
      getRestaurantDetail: vi.fn(() =>
        Promise.resolve({
          branchId,
          branchName: "Main Branch",
          restaurantName: "Test Restaurant",
        }),
      ),
      listRestaurants: vi.fn(() =>
        Promise.resolve([
          { branchId, restaurantId },
          {
            branchId: "aaaaaaaa-0000-4000-8000-000000000003",
            restaurantId: "aaaaaaaa-0000-4000-8000-000000000001",
          },
          {
            branchId: "aaaaaaaa-0000-4000-8000-000000000004",
            restaurantId: "aaaaaaaa-0000-4000-8000-000000000002",
          },
        ]),
      ),
    },
    groupAccess: {
      findGroupAddress: vi.fn(() => Promise.resolve(undefined)),
      listActiveMembers: vi.fn(() =>
        Promise.resolve([
          { displayName: "Order Manager", role: "owner", userId: managerId },
          { displayName: "Order Member", role: "member", userId: memberId },
          { displayName: "Group Owner", role: "owner", userId: ownerId },
        ]),
      ),
      upsertGroupAddress: vi.fn(() => Promise.resolve({ id: "address-1" })),
    },
    favorites: {
      listForUser: vi.fn(() => Promise.resolve([])),
      listForUserAndBranchWithItems: vi.fn(() => Promise.resolve([])),
    },
    orders: {
      createOrder: vi.fn(() => Promise.resolve({ id: orderId })),
      findOrderDetail: vi.fn(),
      findById: vi.fn(),
      listVisibleForUser: vi.fn(() => Promise.resolve([])),
      setState: vi.fn(() => Promise.resolve({})),
      upsertFoodResponse: vi.fn(() => Promise.resolve(undefined)),
      clearFoodResponse: vi.fn(() => Promise.resolve(undefined)),
      listOrderLines: vi.fn(() => Promise.resolve([])),
      listOrderLinesForOrders: vi.fn(() => Promise.resolve([])),
      listActiveVisibleForUser: vi.fn(() => Promise.resolve([])),
      listTerminalVisibleForUser: vi.fn(() =>
        Promise.resolve({ nextCursorRow: null, rows: [] }),
      ),
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

function foodOrderDetail(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    orderId: foodOrderId,
    groupId,
    groupName: "Alpha group",
    managerUserId: managerId,
    state: "food_confirmation",
    choiceMode: "voting_disabled",
    initialRestaurantId: restaurantId,
    initialRestaurantName: "Test Restaurant",
    initialBranchId: branchId,
    initialBranchName: "Main Branch",
    initialBranchGrabUrl: null,
    selectedRestaurantId: restaurantId,
    selectedRestaurantName: "Test Restaurant",
    selectedBranchId: branchId,
    selectedBranchName: "Main Branch",
    selectedMenuVersionId: menuVersionId,
    deliveryAddressSnapshot: {
      city: "Naga",
      lineOne: "12 Sample Street",
      lineTwo: null,
      notes: null,
      phoneNumber: "+63 900 000 0000",
      postalCode: null,
      recipientName: "Mia Tan",
    },
    restaurantDeadline: new Date("2026-08-18T08:00:00.000Z"),
    foodDeadline: new Date("2026-08-18T09:00:00.000Z"),
    createdAt: now,
    completedAt: null,
    participants: [
      {
        userId: managerId,
        displayName: "Order Manager",
        role: "manager",
        restaurantResponse: "responded",
        foodResponse: "pending",
      },
      {
        userId: memberId,
        displayName: "Order Member",
        role: "member",
        restaurantResponse: "pending",
        foodResponse: "pending",
      },
    ],
    ...overrides,
  };
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
        selected: expect.objectContaining({ menuVersionId }) as Record<
          string,
          unknown
        >,
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
        {
          identity: identityFor(managerId, "manager"),
          now,
          request: votingRequest(),
        },
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
        findById: vi.fn(() =>
          Promise.resolve({
            completedAt: null,
            groupId,
            managerUserId: managerId,
            state: "restaurant_voting" as const,
          }),
        ),
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
        findById: vi.fn(() =>
          Promise.resolve({
            completedAt: null,
            groupId,
            managerUserId: managerId,
            state: "food_confirmation" as const,
          }),
        ),
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
        findById: vi.fn(() =>
          Promise.resolve({
            completedAt: null,
            groupId,
            managerUserId: managerId,
            state: "restaurant_voting" as const,
          }),
        ),
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
        findById: vi.fn(() =>
          Promise.resolve({
            completedAt: null,
            groupId,
            managerUserId: managerId,
            state: "ready_for_handoff" as const,
          }),
        ),
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
        findById: vi.fn(() =>
          Promise.resolve({
            completedAt: null,
            groupId,
            managerUserId: managerId,
            state: "restaurant_voting" as const,
          }),
        ),
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
      {
        displayName: "Order Manager",
        foodResponse: "pending",
        restaurantResponse: "responded",
        role: "manager",
        userId: managerId,
      } as const,
      {
        displayName: "Order Member",
        foodResponse: "pending",
        restaurantResponse: "pending",
        role: "member",
        userId: memberId,
      } as const,
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
        listVisibleForUser: vi.fn(() =>
          Promise.resolve([
            summaryRow({
              orderId: orderedOrderId,
              participants: [
                {
                  displayName: "Order Manager",
                  foodResponse: "resolved",
                  restaurantResponse: "responded",
                  role: "manager",
                  userId: managerId,
                },
                {
                  displayName: "Order Member",
                  foodResponse: "resolved",
                  restaurantResponse: "responded",
                  role: "member",
                  userId: memberId,
                },
              ] as const,
              state: "ordered" as const,
              completedAt: new Date("2026-08-18T12:00:00.000Z"),
            }),
            summaryRow({
              orderId: foodOrderId,
              participants: [
                {
                  displayName: "Order Manager",
                  foodResponse: "confirmed",
                  restaurantResponse: "responded",
                  role: "manager",
                  userId: managerId,
                },
                {
                  displayName: "Order Member",
                  foodResponse: "pending",
                  restaurantResponse: "pending",
                  role: "member",
                  userId: memberId,
                } as const,
                {
                  displayName: "Group Owner",
                  foodResponse: "pending",
                  restaurantResponse: "responded",
                  role: "member",
                  userId: ownerId,
                } as const,
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
          ]),
        ),
      },
    });

    const result = await listOrderSummaries(
      { identity: identityFor(memberId, "member") },
      repositories,
    );

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

  it("builds the complete History read model for current group leaders", async () => {
    const orders = {
      ...createRepositories().orders,
      listOrderLinesForOrders: vi.fn(() =>
        Promise.resolve([
          {
            itemNameSnapshot: "Chicken meal",
            lineSubtotalCentavos: 42000,
            noteSnapshot: "Extra gravy",
            orderId: orderedOrderId,
            quantity: 2,
            sortOrder: 0,
            sourceMenuItemId: menuItemId,
            unitPriceCentavos: 21000,
            userId: managerId,
          },
        ]),
      ),
      listVisibleForUser: vi.fn(() =>
        Promise.resolve([
          summaryRow({
            completedAt: new Date("2026-08-18T12:00:00.000Z"),
            orderId: orderedOrderId,
            participants: [
              {
                displayName: "Order Manager",
                foodResponse: "confirmed",
                restaurantResponse: "responded",
                role: "manager",
                userId: managerId,
              },
              {
                displayName: "Order Member",
                foodResponse: "declined",
                restaurantResponse: "responded",
                role: "member",
                userId: memberId,
              },
            ],
            selectedRestaurantName: "KFC",
            state: "ordered",
          }),
        ]),
      ),
    };
    const repositories = createRepositories({ orders });

    const result = await listOrderSummaries(
      { identity: identityFor(ownerId, "manager") },
      repositories,
    );

    expect(result.history[0]?.participants).toEqual([
      {
        displayName: "Order Manager",
        foodResponse: "confirmed",
        itemCount: 2,
        subtotalCentavos: 42000,
        userId: managerId,
      },
      {
        displayName: "Order Member",
        foodResponse: "declined",
        itemCount: 0,
        subtotalCentavos: 0,
        userId: memberId,
      },
    ]);
    expect(orders.listOrderLinesForOrders).toHaveBeenCalledOnce();
    expect(orders.listOrderLinesForOrders).toHaveBeenCalledWith([
      orderedOrderId,
    ]);
  });

  it("returns only the Member's own History row", async () => {
    const orders = {
      ...createRepositories().orders,
      listOrderLinesForOrders: vi.fn(() => Promise.resolve([])),
      listVisibleForUser: vi.fn(() =>
        Promise.resolve([
          summaryRow({
            completedAt: new Date("2026-08-18T12:00:00.000Z"),
            orderId: orderedOrderId,
            participants: [
              {
                displayName: "Order Manager",
                foodResponse: "confirmed",
                restaurantResponse: "responded",
                role: "manager",
                userId: managerId,
              },
              {
                displayName: "Order Member",
                foodResponse: "pending",
                restaurantResponse: "responded",
                role: "member",
                userId: memberId,
              },
            ],
            state: "ordered",
          }),
        ]),
      ),
    };
    const repositories = createRepositories({ orders });

    const result = await listOrderSummaries(
      { identity: identityFor(memberId, "member") },
      repositories,
    );

    expect(
      result.history[0]?.participants.map((person) => person.userId),
    ).toEqual([memberId]);
  });

  it("omits History returned for a group outside the current identity", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        listVisibleForUser: vi.fn(() =>
          Promise.resolve([
            summaryRow({
              completedAt: new Date("2026-08-18T12:00:00.000Z"),
              orderId: orderedOrderId,
              state: "ordered",
            }),
          ]),
        ),
      },
    });

    const result = await listOrderSummaries(
      {
        identity: {
          ...identityFor(memberId, "member"),
          memberships: [],
        },
      },
      repositories,
    );

    expect(result.history).toEqual([]);
  });
});

describe("progressive order history", () => {
  const activeRow = () => ({
    completedAt: null,
    createdAt: now,
    foodDeadline: new Date("2026-08-18T10:00:00.000Z"),
    groupId,
    groupName: "Test Group",
    initialRestaurantId: restaurantId,
    managerUserId: managerId,
    orderId: foodOrderId,
    participants: [
      {
        displayName: "Order Member",
        foodResponse: "pending" as const,
        restaurantResponse: "responded" as const,
        role: "member" as const,
        userId: memberId,
      },
    ],
    restaurantDeadline: new Date("2026-08-18T09:00:00.000Z"),
    selectedRestaurantName: "KFC",
    state: "food_confirmation" as const,
  });
  const terminalRow = () => ({
    completedAt: new Date("2026-08-18T12:00:00.000Z"),
    createdAt: now,
    foodDeadline: new Date("2026-08-18T10:00:00.000Z"),
    groupId,
    groupName: "Test Group",
    initialRestaurantId: restaurantId,
    managerUserId: managerId,
    orderId: orderedOrderId,
    participantCount: 2,
    restaurantDeadline: new Date("2026-08-18T09:00:00.000Z"),
    selectedRestaurantName: "KFC",
    state: "ordered" as const,
  });

  it("loads active orders and only one compact terminal page", async () => {
    const nextCursorRow = terminalRow();
    const orders = {
      ...createRepositories().orders,
      listActiveVisibleForUser: vi.fn(() => Promise.resolve([activeRow()])),
      listTerminalVisibleForUser: vi.fn(() =>
        Promise.resolve({ nextCursorRow, rows: [terminalRow()] }),
      ),
    };

    const result = await listOrderSummaryPage(
      { cursor: null, identity: identityFor(memberId, "member"), limit: 10 },
      { orders },
    );

    expect(orders.listActiveVisibleForUser).toHaveBeenCalledWith(memberId);
    expect(orders.listTerminalVisibleForUser).toHaveBeenCalledWith(memberId, {
      cursor: null,
      limit: 10,
    });
    expect(orders.listOrderLinesForOrders).not.toHaveBeenCalled();
    expect(result.active[0]?.participantsTotal).toBe(1);
    expect(result.history[0]?.participants).toEqual([]);
    expect(result.nextCursor).toEqual(expect.any(String));
  });

  it("loads only the Member's own terminal participant detail", async () => {
    const orders = {
      ...createRepositories().orders,
      findOrderDetail: vi.fn(() =>
        Promise.resolve(
          foodOrderDetail({
            completedAt: new Date("2026-08-18T12:00:00.000Z"),
            state: "ordered",
          }),
        ),
      ),
      listOrderLines: vi.fn(() =>
        Promise.resolve([
          {
            itemNameSnapshot: "Chicken meal",
            lineSubtotalCentavos: 22500,
            noteSnapshot: "",
            quantity: 1,
            sortOrder: 0,
            sourceMenuItemId: menuItemId,
            unitPriceCentavos: 22500,
            userId: memberId,
          },
        ]),
      ),
    };

    const result = await loadOrderHistoryDetail(
      { identity: identityFor(memberId, "member"), orderId: foodOrderId },
      { orders },
    );

    expect(result.participants).toEqual([
      expect.objectContaining({ itemCount: 1, userId: memberId }),
    ]);
  });

  it.each(["group-owner", "manager"] as const)(
    "loads every terminal participant for a %s",
    async (role) => {
      const orders = {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() =>
          Promise.resolve(
            foodOrderDetail({
              completedAt: new Date("2026-08-18T12:00:00.000Z"),
              state: "ordered",
            }),
          ),
        ),
      };

      const result = await loadOrderHistoryDetail(
        { identity: identityFor(ownerId, role), orderId: foodOrderId },
        { orders },
      );

      expect(result.participants).toHaveLength(2);
    },
  );

  it("rejects a missing terminal order", async () => {
    const orders = {
      ...createRepositories().orders,
      findOrderDetail: vi.fn(() => Promise.resolve(undefined)),
    };

    await expect(
      loadOrderHistoryDetail(
        { identity: identityFor(memberId, "member"), orderId: foodOrderId },
        { orders },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(orders.listOrderLines).not.toHaveBeenCalled();
  });

  it("rejects detail while the order is still active", async () => {
    const orders = {
      ...createRepositories().orders,
      findOrderDetail: vi.fn(() => Promise.resolve(foodOrderDetail())),
    };

    await expect(
      loadOrderHistoryDetail(
        { identity: identityFor(memberId, "member"), orderId: foodOrderId },
        { orders },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(orders.listOrderLines).not.toHaveBeenCalled();
  });

  it("rejects terminal detail after the Member loses group access", async () => {
    const identity = { ...identityFor(memberId, "member"), memberships: [] };
    const orders = {
      ...createRepositories().orders,
      findOrderDetail: vi.fn(() =>
        Promise.resolve(
          foodOrderDetail({
            completedAt: new Date("2026-08-18T12:00:00.000Z"),
            state: "ordered",
          }),
        ),
      ),
    };

    await expect(
      loadOrderHistoryDetail({ identity, orderId: foodOrderId }, { orders }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(orders.listOrderLines).not.toHaveBeenCalled();
  });

  it("loads active summaries without touching terminal history", async () => {
    const orders = {
      ...createRepositories().orders,
      listActiveVisibleForUser: vi.fn(() => Promise.resolve([activeRow()])),
    };

    const result = await listActiveOrderSummaries(
      { identity: identityFor(memberId, "member") },
      { orders },
    );

    expect(result).toHaveLength(1);
    expect(orders.listTerminalVisibleForUser).not.toHaveBeenCalled();
  });

  it("carries the selected menu photo into compact cards without loading food lines", async () => {
    const orders = {
      ...createRepositories().orders,
      listActiveVisibleForUser: vi.fn(() =>
        Promise.resolve([
          {
            ...activeRow(),
            restaurantImageUrl: "https://example.test/food.jpg",
          },
        ]),
      ),
    };
    const result = await listActiveOrderSummaries(
      { identity: identityFor(memberId, "member") },
      { orders },
    );
    expect(result[0]).toMatchObject({
      restaurantImageUrl: "https://example.test/food.jpg",
    });
    expect(orders.listOrderLines).not.toHaveBeenCalled();
  });
});

describe("loadOrderDetail visibility", () => {
  const detailRow = (overrides: Record<string, unknown> = {}) => ({
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
      {
        displayName: "Order Manager",
        foodResponse: "pending",
        restaurantResponse: "responded",
        role: "manager",
        userId: managerId,
      },
      {
        displayName: "Order Member",
        foodResponse: "pending",
        restaurantResponse: "pending",
        role: "member",
        userId: memberId,
      },
    ],
    ...overrides,
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
        {
          identity: { ...identityFor(outsiderId, "member"), memberships: [] },
          now,
          orderId,
        },
        repositories,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("serves a terminal order to a current non-participant Manager", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() =>
          Promise.resolve(detailRow({ completedAt: now, state: "ordered" })),
        ),
      },
    });

    const view = await loadOrderDetail(
      { identity: identityFor(ownerId, "manager"), now, orderId },
      repositories,
    );

    expect(view.participants).toHaveLength(2);
    expect(view.viewer).toEqual({ canManage: true, kind: "group-leader" });
  });

  it("keeps a non-participant Manager out of active orders", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() => Promise.resolve(detailRow())),
      },
    });

    await expect(
      loadOrderDetail(
        { identity: identityFor(ownerId, "manager"), now, orderId },
        repositories,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns only a Member's own terminal row and lines", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() =>
          Promise.resolve(detailRow({ completedAt: now, state: "cancelled" })),
        ),
        listOrderLines: vi.fn(() =>
          Promise.resolve([
            {
              itemNameSnapshot: "Manager meal",
              lineSubtotalCentavos: 20000,
              noteSnapshot: "",
              quantity: 1,
              sortOrder: 0,
              sourceMenuItemId: menuItemId,
              unitPriceCentavos: 20000,
              userId: managerId,
            },
            {
              itemNameSnapshot: "Member meal",
              lineSubtotalCentavos: 22500,
              noteSnapshot: "Extra gravy",
              quantity: 1,
              sortOrder: 0,
              sourceMenuItemId: menuItemId,
              unitPriceCentavos: 22500,
              userId: memberId,
            },
          ]),
        ),
      },
    });

    const view = await loadOrderDetail(
      { identity: identityFor(memberId, "member"), now, orderId },
      repositories,
    );

    expect(view.participants.map((person) => person.userId)).toEqual([
      memberId,
    ]);
    expect(view.lines.map((line) => line.userId)).toEqual([memberId]);
  });

  it("hides terminal History after the viewer leaves the group", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() =>
          Promise.resolve(detailRow({ completedAt: now, state: "ordered" })),
        ),
      },
    });

    await expect(
      loadOrderDetail(
        {
          identity: { ...identityFor(memberId, "member"), memberships: [] },
          now,
          orderId,
        },
        repositories,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("maps a malformed stored address snapshot to a public error", async () => {
    const repositories = createRepositories({
      orders: {
        ...createRepositories().orders,
        findOrderDetail: vi.fn(() =>
          Promise.resolve({
            ...detailRow(),
            deliveryAddressSnapshot: { city: 42 },
          }),
        ),
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

describe("submitFoodResponse", () => {
  function foodRepositories(
    overrides: Partial<OrdersServiceRepositories> = {},
  ) {
    const repositories = createRepositories();
    vi.mocked(repositories.orders.findOrderDetail).mockResolvedValue(
      foodOrderDetail(),
    );
    vi.mocked(
      repositories.favorites.listForUserAndBranchWithItems,
    ).mockResolvedValue([
      {
        branchId,
        id: favoriteId,
        items: [{ menuItemId, note: "Extra gravy", quantity: 1 }],
        name: "Zinger Combo",
        rank: 1,
      },
    ] as never);
    return { ...repositories, ...overrides };
  }

  it("confirms a favorite pick with server-expanded lines", async () => {
    const repositories = foodRepositories();
    await submitFoodResponse(
      {
        identity: identityFor(memberId, "member"),
        now,
        orderId: foodOrderId,
        request: parseFoodPickRequest({ kind: "favorite", favoriteId }),
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.upsertFoodResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        favoriteId,
        lines: [
          {
            itemNameSnapshot: "Zinger Combo",
            lineSubtotalCentavos: 22500,
            noteSnapshot: "Extra gravy",
            quantity: 1,
            sortOrder: 0,
            sourceMenuItemId: menuItemId,
            unitPriceCentavos: 22500,
          },
        ],
        source: "saved_favorite",
        status: "confirmed",
        userId: memberId,
      }),
    );
  });

  it("rejects a viewer who is not a participant", async () => {
    const repositories = foodRepositories();
    // ownerId is the group owner but was not selected into this order.
    vi.mocked(repositories.orders.findOrderDetail).mockResolvedValue(
      foodOrderDetail({
        participants: [
          {
            userId: managerId,
            displayName: "Order Manager",
            role: "manager",
            restaurantResponse: "responded",
            foodResponse: "pending",
          },
        ],
      }),
    );
    await expect(
      submitFoodResponse(
        {
          identity: identityFor(ownerId, "group-owner"),
          now,
          orderId: foodOrderId,
          request: parseFoodPickRequest({ kind: "declined" }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects picks after the food deadline", async () => {
    const repositories = foodRepositories();
    await expect(
      submitFoodResponse(
        {
          identity: identityFor(memberId, "member"),
          now: new Date("2026-08-18T09:00:01.000Z"),
          orderId: foodOrderId,
          request: parseFoodPickRequest({ kind: "favorite", favoriteId }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a favorite that is not one of the member's favorites for the branch", async () => {
    const repositories = foodRepositories();
    vi.mocked(
      repositories.favorites.listForUserAndBranchWithItems,
    ).mockResolvedValue([] as never);
    await expect(
      submitFoodResponse(
        {
          identity: identityFor(memberId, "member"),
          now,
          orderId: foodOrderId,
          request: parseFoodPickRequest({ kind: "favorite", favoriteId }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a favorite whose item left the pinned menu version", async () => {
    const repositories = foodRepositories();
    vi.mocked(repositories.catalog.findMenuItemContext).mockResolvedValue({
      branchId,
      basePriceCentavos: 22500,
      isAvailable: true,
      menuItemId,
      menuVersionId: "ccccccc1-0000-4000-8000-000000000001",
      name: "Zinger Combo",
    });
    await expect(
      submitFoodResponse(
        {
          identity: identityFor(memberId, "member"),
          now,
          orderId: foodOrderId,
          request: parseFoodPickRequest({ kind: "favorite", favoriteId }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a favorite whose item is unavailable", async () => {
    const repositories = foodRepositories();
    vi.mocked(repositories.catalog.findMenuItemContext).mockResolvedValue({
      branchId,
      basePriceCentavos: 22500,
      isAvailable: false,
      menuItemId,
      menuVersionId,
      name: "Zinger Combo",
    });
    await expect(
      submitFoodResponse(
        {
          identity: identityFor(memberId, "member"),
          now,
          orderId: foodOrderId,
          request: parseFoodPickRequest({ kind: "favorite", favoriteId }),
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("records a decline without lines", async () => {
    const repositories = foodRepositories();
    await submitFoodResponse(
      {
        identity: identityFor(memberId, "member"),
        now,
        orderId: foodOrderId,
        request: parseFoodPickRequest({ kind: "declined" }),
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.upsertFoodResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        favoriteId: null,
        lines: [],
        source: "declined",
        status: "declined",
      }),
    );
  });

  it("clears a previous pick back to pending", async () => {
    const repositories = foodRepositories();
    await submitFoodResponse(
      {
        identity: identityFor(memberId, "member"),
        now,
        orderId: foodOrderId,
        request: parseFoodPickRequest({ kind: "clear" }),
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.clearFoodResponse).toHaveBeenCalledWith(
      foodOrderId,
      memberId,
    );
  });
});

describe("advanceFoodDeadline", () => {
  const afterDeadline = new Date("2026-08-18T09:30:00.000Z");

  function advanceRepositories(detail: Record<string, unknown>) {
    const repositories = createRepositories();
    vi.mocked(repositories.orders.findOrderDetail).mockResolvedValue(detail);
    vi.mocked(
      repositories.favorites.listForUserAndBranchWithItems,
    ).mockImplementation((userId: string) =>
      Promise.resolve(
        userId === memberId
          ? [
              {
                branchId,
                id: favoriteId,
                items: [{ menuItemId, note: "", quantity: 1 }],
                name: "Zinger Combo",
                rank: 1,
              },
            ]
          : [],
      ),
    );
    return repositories;
  }

  it("does nothing before the food deadline", async () => {
    const repositories = advanceRepositories(foodOrderDetail());
    const result = await advanceFoodDeadline(
      { identity: identityFor(memberId, "member"), now, orderId: foodOrderId },
      runnerFor(repositories),
    );
    expect(result).toEqual({ advanced: false });
    expect(repositories.orders.upsertFoodResponse).not.toHaveBeenCalled();
    expect(repositories.orders.setState).not.toHaveBeenCalled();
  });

  it("materializes the rank-1 default for a pending member after the deadline", async () => {
    const repositories = advanceRepositories(foodOrderDetail());
    await advanceFoodDeadline(
      {
        identity: identityFor(memberId, "member"),
        now: afterDeadline,
        orderId: foodOrderId,
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.upsertFoodResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        favoriteId,
        source: "saved_favorite",
        status: "confirmed",
        userId: memberId,
      }),
    );
  });

  it("leaves a member without a usable favorite pending", async () => {
    const repositories = advanceRepositories(foodOrderDetail());
    vi.mocked(
      repositories.favorites.listForUserAndBranchWithItems,
    ).mockResolvedValue([] as never);
    await advanceFoodDeadline(
      {
        identity: identityFor(managerId, "manager"),
        now: afterDeadline,
        orderId: foodOrderId,
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.upsertFoodResponse).not.toHaveBeenCalled();
    expect(repositories.orders.setState).not.toHaveBeenCalled();
  });

  it("transitions to ready_for_handoff once everyone is accounted for", async () => {
    const repositories = advanceRepositories(
      foodOrderDetail({
        participants: [
          {
            userId: managerId,
            displayName: "Order Manager",
            role: "manager",
            restaurantResponse: "responded",
            foodResponse: "declined",
          },
          {
            userId: memberId,
            displayName: "Order Member",
            role: "member",
            restaurantResponse: "pending",
            foodResponse: "pending",
          },
        ],
      }),
    );
    await advanceFoodDeadline(
      {
        identity: identityFor(managerId, "manager"),
        now: afterDeadline,
        orderId: foodOrderId,
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.setState).toHaveBeenCalledWith(
      foodOrderId,
      expect.objectContaining({ state: "ready_for_handoff" }),
    );
  });

  it("is idempotent once the order has moved on", async () => {
    const repositories = advanceRepositories(
      foodOrderDetail({ state: "ready_for_handoff" }),
    );
    const result = await advanceFoodDeadline(
      {
        identity: identityFor(memberId, "member"),
        now: afterDeadline,
        orderId: foodOrderId,
      },
      runnerFor(repositories),
    );
    expect(result).toEqual({ advanced: false });
    expect(repositories.orders.upsertFoodResponse).not.toHaveBeenCalled();
  });

  it("rejects a viewer who cannot see the order", async () => {
    const repositories = advanceRepositories(foodOrderDetail());
    await expect(
      advanceFoodDeadline(
        {
          identity: identityFor(outsiderId, "member"),
          now: afterDeadline,
          orderId: foodOrderId,
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("loadOrderDetail food view", () => {
  it("returns the viewer's branch favorites and order lines", async () => {
    const repositories = createRepositories();
    vi.mocked(repositories.orders.findOrderDetail).mockResolvedValue(
      foodOrderDetail(),
    );
    vi.mocked(repositories.orders.listOrderLines).mockResolvedValue([
      {
        itemNameSnapshot: "Zinger Combo",
        lineSubtotalCentavos: 22500,
        noteSnapshot: "Extra gravy",
        quantity: 1,
        sortOrder: 0,
        sourceMenuItemId: menuItemId,
        unitPriceCentavos: 22500,
        userId: memberId,
      },
    ] as never);
    vi.mocked(repositories.favorites.listForUser).mockResolvedValue([
      {
        branchId,
        currentPriceCentavos: 22500,
        favoriteId,
        isCurrentlyAvailable: true,
        itemDescription: "Burger, fries, and drink",
        menuItemId,
        name: "Zinger Combo",
        rank: 1,
      },
      {
        branchId: "aaaaaaaa-0000-4000-8000-00000000000b",
        currentPriceCentavos: 9900,
        favoriteId: "bbbbbbb1-0000-4000-8000-000000000002",
        isCurrentlyAvailable: false,
        itemDescription: null,
        menuItemId: "bbbbbbb1-0000-4000-8000-000000000004",
        name: "Other Branch Favorite",
        rank: 1,
      },
    ] as never);

    const view = await loadOrderDetail(
      { identity: identityFor(memberId, "member"), now, orderId: foodOrderId },
      repositories,
    );
    expect(view.order.selectedBranchName).toBe("Main Branch");
    expect(view.viewerFavorites).toHaveLength(1);
    expect(view.viewerFavorites[0]).toMatchObject({
      available: true,
      favoriteId,
      priceCentavos: 22500,
      rank: 1,
    });
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]).toMatchObject({
      itemName: "Zinger Combo",
      userId: memberId,
    });
  });
});

describe("finishOrder", () => {
  function finishRepositories(
    overrides: Partial<OrdersServiceRepositories> = {},
  ) {
    const repositories = createRepositories();
    vi.mocked(repositories.orders.findOrderDetail).mockResolvedValue(
      foodOrderDetail(),
    );
    vi.mocked(
      repositories.favorites.listForUserAndBranchWithItems,
    ).mockImplementation((userId: string) =>
      Promise.resolve(
        userId === memberId
          ? [
              {
                branchId,
                id: favoriteId,
                items: [{ menuItemId, note: "", quantity: 1 }],
                name: "Zinger Combo",
                rank: 1,
              },
            ]
          : [],
      ),
    );
    return { ...repositories, ...overrides };
  }

  it("orders rank-1 defaults for pending participants and moves the order to history", async () => {
    const repositories = finishRepositories();
    await finishOrder(
      {
        identity: identityFor(managerId, "manager"),
        now,
        orderId: foodOrderId,
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.upsertFoodResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        favoriteId,
        lines: [expect.objectContaining({ itemNameSnapshot: "Zinger Combo" })],
        source: "saved_favorite",
        status: "confirmed",
        userId: memberId,
      }),
    );
    expect(repositories.orders.upsertFoodResponse).toHaveBeenCalledTimes(1);
    expect(repositories.orders.setState).toHaveBeenCalledWith(
      foodOrderId,
      expect.objectContaining({ completedAt: now, state: "ordered" }),
    );
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "order.ordered" }),
    );
  });

  it("finishes even when a pending participant has no usable favorite", async () => {
    const repositories = finishRepositories();
    vi.mocked(
      repositories.favorites.listForUserAndBranchWithItems,
    ).mockResolvedValue([] as never);
    await finishOrder(
      {
        identity: identityFor(managerId, "manager"),
        now,
        orderId: foodOrderId,
      },
      runnerFor(repositories),
    );
    expect(repositories.orders.upsertFoodResponse).not.toHaveBeenCalled();
    expect(repositories.orders.setState).toHaveBeenCalledWith(
      foodOrderId,
      expect.objectContaining({ state: "ordered" }),
    );
  });

  it("rejects a plain participant", async () => {
    const repositories = finishRepositories();
    await expect(
      finishOrder(
        {
          identity: identityFor(memberId, "member"),
          now,
          orderId: foodOrderId,
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repositories.orders.setState).not.toHaveBeenCalled();
  });

  it("rejects orders outside the food-picks stage", async () => {
    const repositories = finishRepositories();
    vi.mocked(repositories.orders.findOrderDetail).mockResolvedValue(
      foodOrderDetail({ state: "ready_for_handoff" }),
    );
    await expect(
      finishOrder(
        {
          identity: identityFor(managerId, "manager"),
          now,
          orderId: foodOrderId,
        },
        runnerFor(repositories),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(repositories.orders.setState).not.toHaveBeenCalled();
  });
});
