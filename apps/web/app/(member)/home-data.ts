import type { RestaurantSummaryRow } from "@ordah-please/db";

import type { AppIdentity } from "../../src/auth/load-app-identity";
import type { OrderSummary } from "../../src/features/orders/orders-service";

interface MemberHomeDataDependencies {
  readonly listActiveOrderSummaries: (
    identity: AppIdentity,
  ) => Promise<readonly OrderSummary[]>;
  readonly listRestaurantPreviews: (options: {
    readonly limit: number;
  }) => Promise<readonly RestaurantSummaryRow[]>;
}

/** Starts the independent Home reads together and limits restaurant preview work. */
export async function loadMemberHomeData(
  identity: AppIdentity,
  dependencies: MemberHomeDataDependencies,
) {
  const [restaurantsResult, activeOrdersResult] = await Promise.allSettled([
    dependencies.listRestaurantPreviews({ limit: 6 }),
    identity.memberships.length > 0
      ? dependencies.listActiveOrderSummaries(identity)
      : Promise.resolve([]),
  ]);

  return {
    errors: {
      orders: activeOrdersResult.status === "rejected",
      restaurants: restaurantsResult.status === "rejected",
    },
    orderSummaries: {
      active:
        activeOrdersResult.status === "fulfilled"
          ? activeOrdersResult.value
          : [],
      history: [],
    },
    restaurants:
      restaurantsResult.status === "fulfilled" ? restaurantsResult.value : [],
  };
}
