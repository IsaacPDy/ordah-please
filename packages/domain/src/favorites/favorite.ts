import type { MenuAvailability } from "../catalog/menu.js";
import type {
  FavoriteId,
  BranchId,
  MenuItemId,
  MenuModifierOptionId,
  MenuVariantId,
  MenuVersionId,
  UserId,
} from "../types/ids.js";
import type { Centavos } from "../types/money.js";

export const FAVORITE_RANKS = [1, 2, 3] as const;

export type FavoriteRank = (typeof FAVORITE_RANKS)[number];

export type FavoriteVariantSelection = Readonly<{
  menuVariantId: MenuVariantId;
  name: string;
  priceDeltaCentavos: Centavos;
}>;

export type FavoriteModifierSelection = Readonly<{
  menuModifierOptionId: MenuModifierOptionId;
  name: string;
  quantity: number;
  priceDeltaCentavos: Centavos;
}>;

export type FavoriteItemSelection = Readonly<{
  menuItemId: MenuItemId;
  name: string;
  quantity: number;
  unitPriceCentavos: Centavos;
  variant: FavoriteVariantSelection | null;
  modifiers: readonly FavoriteModifierSelection[];
  note: string;
  availability: MenuAvailability;
}>;

export type FavoriteCombination = Readonly<{
  id: FavoriteId;
  userId: UserId;
  branchId: BranchId;
  menuVersionId: MenuVersionId;
  rank: FavoriteRank;
  availability: MenuAvailability;
  items: readonly FavoriteItemSelection[];
}>;
