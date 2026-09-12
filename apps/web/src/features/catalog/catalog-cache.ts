import { cacheLife, cacheTag, revalidateTag } from "next/cache";

import { catalogRuntime } from "./catalog-runtime";

/** Reuses one bounded published restaurant page across signed-in requests. */
export async function listCachedRestaurantPreviews(options: {
  readonly limit: number;
  readonly offset?: number;
}) {
  "use cache";
  cacheLife("hours");
  cacheTag("published-catalog");
  return catalogRuntime.catalog.listRestaurantPreviews(options);
}

/** Reuses public published menu detail without caching identity or favorites. */
export async function getCachedRestaurantDetail(restaurantId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("published-catalog", `restaurant-${restaurantId}`);
  return catalogRuntime.catalog.getRestaurantDetail(restaurantId);
}

/** Expires shared catalog reads after a committed import or edit. */
export function invalidatePublishedCatalog(restaurantId?: string): void {
  revalidateTag("published-catalog", { expire: 0 });
  if (restaurantId !== undefined) {
    revalidateTag(`restaurant-${restaurantId}`, { expire: 0 });
  }
}
