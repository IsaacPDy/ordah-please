import type {
  CatalogRepository,
  GroupAccessRepository,
} from "@ordah-please/db";

type NewOrderPageDataDependencies = Pick<
  GroupAccessRepository,
  "findGroupAddress" | "findGroupSummary" | "listActiveMembers"
> &
  Pick<CatalogRepository, "listRestaurantPreviews">;

/** Loads independent New Order setup choices together with a bounded catalog read. */
export async function loadNewOrderPageData(
  groupId: string,
  dependencies: NewOrderPageDataDependencies,
) {
  const [members, address, restaurants, group] = await Promise.all([
    dependencies.listActiveMembers(groupId),
    dependencies.findGroupAddress(groupId),
    dependencies.listRestaurantPreviews({ limit: 100 }),
    dependencies.findGroupSummary(groupId),
  ]);

  return { address, group, members, restaurants };
}
