import type {
  BranchId,
  MenuItemId,
  MenuModifierGroupId,
  MenuModifierOptionId,
  MenuVariantId,
  MenuVersionId,
  RestaurantId,
} from "../types/ids.js";
import type { Centavos } from "../types/money.js";
import type { UtcTimestamp } from "../types/time.js";

export const MENU_AVAILABILITY_STATES = ["available", "unavailable"] as const;

export type MenuAvailability = (typeof MENU_AVAILABILITY_STATES)[number];

export type CatalogRestaurant = Readonly<{
  id: RestaurantId;
  name: string;
  cuisines: readonly string[];
}>;

export type CatalogBranch = Readonly<{
  id: BranchId;
  restaurantId: RestaurantId;
  name: string;
  grabUrl: string | null;
}>;

export type MenuVariant = Readonly<{
  id: MenuVariantId;
  name: string;
  priceDeltaCentavos: Centavos;
}>;

export type MenuModifierOption = Readonly<{
  id: MenuModifierOptionId;
  name: string;
  priceDeltaCentavos: Centavos;
  availability: MenuAvailability;
}>;

export type MenuModifierGroup = Readonly<{
  id: MenuModifierGroupId;
  name: string;
  minimumSelections: number;
  maximumSelections: number;
  options: readonly MenuModifierOption[];
}>;

export type MenuItem = Readonly<{
  id: MenuItemId;
  name: string;
  description: string;
  priceCentavos: Centavos;
  availability: MenuAvailability;
  imageUrl: string | null;
  variants: readonly MenuVariant[];
  modifierGroups: readonly MenuModifierGroup[];
}>;

export type CatalogMenuVersion = Readonly<{
  id: MenuVersionId;
  branchId: BranchId;
  publishedAt: UtcTimestamp;
  stale: boolean;
  items: readonly MenuItem[];
}>;

export type CatalogReadModel = Readonly<{
  restaurant: CatalogRestaurant;
  branch: CatalogBranch;
  menuVersion: CatalogMenuVersion;
}>;
