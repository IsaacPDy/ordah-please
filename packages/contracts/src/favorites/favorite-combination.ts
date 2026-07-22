import type {
  BranchId,
  FavoriteCombination,
  FavoriteId,
  FavoriteItemSelection,
  FavoriteModifierSelection,
  FavoriteRank,
  FavoriteVariantSelection,
  MenuItemId,
  MenuModifierOptionId,
  MenuVariantId,
  MenuVersionId,
  UserId,
} from "@ordah-please/domain";

import {
  parseArray,
  parseCentavosValue,
  parseEnum,
  parsePositiveInteger,
  parseRecordId,
  parseStrictObject,
  parseString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

const availabilityStates = ["available", "unavailable"] as const;

/** Parses the chosen variant captured inside a favorite. */
function parseFavoriteVariant(value: unknown): FavoriteVariantSelection {
  const object = parseStrictObject(value, "Favorite variant");
  rejectUnknownFields(
    object,
    ["menuVariantId", "name", "priceDeltaCentavos"],
    "Favorite variant",
  );

  return {
    menuVariantId: parseRecordId<MenuVariantId>(
      object.menuVariantId,
      "Favorite menu variant id",
    ),
    name: parseString(object.name, "Favorite variant name"),
    priceDeltaCentavos: parseCentavosValue(
      object.priceDeltaCentavos,
      "Favorite variant price delta",
    ),
  };
}

/** Parses one selected modifier captured inside a favorite. */
function parseFavoriteModifier(value: unknown): FavoriteModifierSelection {
  const object = parseStrictObject(value, "Favorite modifier");
  rejectUnknownFields(
    object,
    ["menuModifierOptionId", "name", "quantity", "priceDeltaCentavos"],
    "Favorite modifier",
  );

  return {
    menuModifierOptionId: parseRecordId<MenuModifierOptionId>(
      object.menuModifierOptionId,
      "Favorite modifier option id",
    ),
    name: parseString(object.name, "Favorite modifier name"),
    quantity: parsePositiveInteger(
      object.quantity,
      "Favorite modifier quantity",
    ),
    priceDeltaCentavos: parseCentavosValue(
      object.priceDeltaCentavos,
      "Favorite modifier price delta",
    ),
  };
}

/** Parses one fully configured item inside a favorite combination. */
function parseFavoriteItem(value: unknown): FavoriteItemSelection {
  const object = parseStrictObject(value, "Favorite item");
  rejectUnknownFields(
    object,
    [
      "menuItemId",
      "name",
      "quantity",
      "unitPriceCentavos",
      "variant",
      "modifiers",
      "note",
      "availability",
    ],
    "Favorite item",
  );

  return {
    menuItemId: parseRecordId<MenuItemId>(
      object.menuItemId,
      "Favorite menu item id",
    ),
    name: parseString(object.name, "Favorite item name"),
    quantity: parsePositiveInteger(object.quantity, "Favorite item quantity"),
    unitPriceCentavos: parseCentavosValue(
      object.unitPriceCentavos,
      "Favorite item unit price",
    ),
    variant:
      object.variant === null ? null : parseFavoriteVariant(object.variant),
    modifiers: parseArray(
      object.modifiers,
      "Favorite modifiers",
      parseFavoriteModifier,
    ),
    note:
      typeof object.note === "string"
        ? object.note
        : parseString(object.note, "Favorite note"),
    availability: parseEnum(
      object.availability,
      availabilityStates,
      "Favorite item availability",
    ),
  };
}

/** Validates a complete ranked favorite before it crosses the API boundary. */
export function parseFavoriteCombination(value: unknown): FavoriteCombination {
  const object = parseStrictObject(value, "Favorite combination");
  rejectUnknownFields(
    object,
    [
      "id",
      "userId",
      "branchId",
      "menuVersionId",
      "rank",
      "availability",
      "items",
    ],
    "Favorite combination",
  );
  const rank = parsePositiveInteger(object.rank, "Favorite rank");
  const items = parseArray(object.items, "Favorite items", parseFavoriteItem);

  if (![1, 2, 3].includes(rank)) {
    throw new TypeError("Favorite rank must be 1, 2, or 3.");
  }

  if (items.length === 0) {
    throw new TypeError("Favorite combination must contain at least one item.");
  }

  return {
    id: parseRecordId<FavoriteId>(object.id, "Favorite id"),
    userId: parseRecordId<UserId>(object.userId, "Favorite user id"),
    branchId: parseRecordId<BranchId>(object.branchId, "Favorite branch id"),
    menuVersionId: parseRecordId<MenuVersionId>(
      object.menuVersionId,
      "Favorite menu version id",
    ),
    rank: rank as FavoriteRank,
    availability: parseEnum(
      object.availability,
      availabilityStates,
      "Favorite availability",
    ),
    items,
  };
}
