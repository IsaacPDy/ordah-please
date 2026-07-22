import type {
  FavoriteId,
  FoodSelectionSnapshot,
  MenuItemId,
  MenuModifierOptionId,
  MenuVariantId,
  SelectedItemSnapshot,
  SelectedModifierSnapshot,
  SelectedVariantSnapshot,
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

/** Parses an immutable selected variant with its captured name and price. */
function parseSelectedVariant(value: unknown): SelectedVariantSnapshot {
  const object = parseStrictObject(value, "Selected variant");
  rejectUnknownFields(
    object,
    ["menuVariantId", "name", "priceDeltaCentavos"],
    "Selected variant",
  );

  return {
    menuVariantId: parseRecordId<MenuVariantId>(
      object.menuVariantId,
      "Selected variant id",
    ),
    name: parseString(object.name, "Selected variant name"),
    priceDeltaCentavos: parseCentavosValue(
      object.priceDeltaCentavos,
      "Selected variant price delta",
    ),
  };
}

/** Parses an immutable selected modifier with quantity and captured price. */
function parseSelectedModifier(value: unknown): SelectedModifierSnapshot {
  const object = parseStrictObject(value, "Selected modifier");
  rejectUnknownFields(
    object,
    ["menuModifierOptionId", "name", "quantity", "priceDeltaCentavos"],
    "Selected modifier",
  );

  return {
    menuModifierOptionId: parseRecordId<MenuModifierOptionId>(
      object.menuModifierOptionId,
      "Selected modifier id",
    ),
    name: parseString(object.name, "Selected modifier name"),
    quantity: parsePositiveInteger(
      object.quantity,
      "Selected modifier quantity",
    ),
    priceDeltaCentavos: parseCentavosValue(
      object.priceDeltaCentavos,
      "Selected modifier price delta",
    ),
  };
}

/** Parses one complete selected item that remains meaningful after menu refreshes. */
function parseSelectedItem(value: unknown): SelectedItemSnapshot {
  const object = parseStrictObject(value, "Selected item");
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
    ],
    "Selected item",
  );

  return {
    menuItemId: parseRecordId<MenuItemId>(
      object.menuItemId,
      "Selected item id",
    ),
    name: parseString(object.name, "Selected item name"),
    quantity: parsePositiveInteger(object.quantity, "Selected item quantity"),
    unitPriceCentavos: parseCentavosValue(
      object.unitPriceCentavos,
      "Selected item unit price",
    ),
    variant:
      object.variant === null ? null : parseSelectedVariant(object.variant),
    modifiers: parseArray(
      object.modifiers,
      "Selected modifiers",
      parseSelectedModifier,
    ),
    note:
      typeof object.note === "string"
        ? object.note
        : parseString(object.note, "Selected item note"),
  };
}

/** Validates a saved-favorite or inline food selection with immutable item snapshots. */
export function parseFoodSelectionSnapshot(
  value: unknown,
): FoodSelectionSnapshot {
  const object = parseStrictObject(value, "Food selection");
  rejectUnknownFields(object, ["source", "items"], "Food selection");
  const source = parseStrictObject(object.source, "Food selection source");
  const kind = parseEnum(
    source.kind,
    ["saved_favorite", "inline"] as const,
    "Food selection source",
  );
  rejectUnknownFields(
    source,
    kind === "saved_favorite" ? ["kind", "favoriteId"] : ["kind"],
    "Food selection source",
  );
  const items = parseArray(object.items, "Selected items", parseSelectedItem);

  if (items.length === 0) {
    throw new TypeError("Food selection must contain at least one item.");
  }

  return {
    source:
      kind === "saved_favorite"
        ? {
            kind,
            favoriteId: parseRecordId<FavoriteId>(
              source.favoriteId,
              "Food selection favorite id",
            ),
          }
        : { kind },
    items,
  };
}
