import type { RestaurantSummaryRow } from "@ordah-please/db";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";
import { describe, expect, it, vi } from "vitest";

import type { AppIdentity } from "../../src/auth/load-app-identity";
import type { OrderSummaryPage } from "../../src/features/orders/orders-service";
import { loadMemberHomeData } from "./home-data";

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("member Home data", () => {
  it("starts bounded restaurant and order reads together", async () => {
    const catalog = deferred<readonly RestaurantSummaryRow[]>();
    const orders = deferred<OrderSummaryPage>();
    const identity = {
      authUserId: "auth-user-1",
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [{ groupId: parseId<GroupId>("group-1"), role: "member" }],
      userId: parseId<UserId>("user-1"),
    } satisfies AppIdentity;
    const dependencies = {
      listOrderSummaryPage: vi.fn(() => orders.promise),
      listRestaurantPreviews: vi.fn(() => catalog.promise),
    };

    const resultPromise = loadMemberHomeData(identity, dependencies);

    expect(dependencies.listRestaurantPreviews).toHaveBeenCalledWith({
      limit: 6,
    });
    expect(dependencies.listOrderSummaryPage).toHaveBeenCalledWith(identity);

    catalog.resolve([]);
    orders.resolve({ active: [], history: [], nextCursor: null });
    await expect(resultPromise).resolves.toEqual({
      errors: { orders: false, restaurants: false },
      orderSummaries: { active: [], history: [], nextCursor: null },
      restaurants: [],
    });
  });

  it("preserves active orders when the optional catalog read fails", async () => {
    const identity = {
      authUserId: "auth-user-1",
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [{ groupId: parseId<GroupId>("group-1"), role: "member" }],
      userId: parseId<UserId>("user-1"),
    } satisfies AppIdentity;
    const summaries: OrderSummaryPage = {
      active: [],
      history: [],
      nextCursor: null,
    };

    await expect(
      loadMemberHomeData(identity, {
        listOrderSummaryPage: () => Promise.resolve(summaries),
        listRestaurantPreviews: () => Promise.reject(new Error("catalog")),
      }),
    ).resolves.toEqual({
      errors: { orders: false, restaurants: true },
      orderSummaries: summaries,
      restaurants: [],
    });
  });
});
