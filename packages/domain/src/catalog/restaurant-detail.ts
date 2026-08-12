import type { BranchId, RestaurantId } from "../types/ids.js";
import type { MenuItem } from "./menu.js";
import type { UtcTimestamp } from "../types/time.js";

/** A category section in the member restaurant detail page. */
export type RestaurantMenuCategory = Readonly<{
  name: string;
  items: readonly MenuItem[];
}>;

/** Full read model for the member restaurant detail page. */
export type RestaurantDetail = Readonly<{
  restaurantId: RestaurantId;
  restaurantName: string;
  cuisines: readonly string[];
  branchId: BranchId;
  branchName: string;
  grabUrl: string | null;
  menuVersionPublishedAt: UtcTimestamp;
  categories: readonly RestaurantMenuCategory[];
}>;
