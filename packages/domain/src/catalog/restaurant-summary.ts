import type { BranchId, RestaurantId } from "../types/ids.js";

/** One row in the member browse list. Hero image is the first item's photo for V1. */
export type RestaurantSummary = Readonly<{
  id: RestaurantId;
  name: string;
  cuisines: readonly string[];
  branchId: BranchId;
  branchName: string;
  heroImageUrl: string | null;
}>;
