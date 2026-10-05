import type { RestaurantSummaryRow } from "@ordah-please/db";

import type { AppIdentity } from "../../src/auth/load-app-identity";
import type { OrderSummaryPage } from "../../src/features/orders/orders-service";

interface MemberHomeDataDependencies {
  readonly listOrderSummaryPage: (
    identity: AppIdentity,
  ) => Promise<OrderSummaryPage>;
  readonly listRestaurantPreviews: (options: {
    readonly limit: number;
  }) => Promise<readonly RestaurantSummaryRow[]>;
}

/** Starts the independent Home reads together and limits restaurant preview work. */
export async function loadMemberHomeData(
  identity: AppIdentity,
  dependencies: MemberHomeDataDependencies,
) {
  const [restaurantsResult, ordersResult] = await Promise.allSettled([
    dependencies.listRestaurantPreviews({ limit: 6 }),
    identity.memberships.length > 0
      ? dependencies.listOrderSummaryPage(identity)
      : Promise.resolve({ active: [], history: [], nextCursor: null }),
  ]);

  return {
    errors: {
      orders: ordersResult.status === "rejected",
      restaurants: restaurantsResult.status === "rejected",
    },
    orderSummaries:
      ordersResult.status === "fulfilled"
        ? ordersResult.value
        : { active: [], history: [], nextCursor: null },
    restaurants:
      restaurantsResult.status === "fulfilled" ? restaurantsResult.value : [],
  };
}
