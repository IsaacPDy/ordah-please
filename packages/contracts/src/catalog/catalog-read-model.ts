import type {
  BranchId,
  CatalogBranch,
  CatalogMenuVersion,
  CatalogReadModel,
  CatalogRestaurant,
  MenuItem,
  MenuItemId,
  MenuModifierGroup,
  MenuModifierGroupId,
  MenuModifierOption,
  MenuModifierOptionId,
  MenuVariant,
  MenuVariantId,
  MenuVersionId,
  RestaurantId,
} from "@ordah-please/domain";

import {
  parseArray,
  parseBoolean,
  parseCentavosValue,
  parseEnum,
  parseNonNegativeInteger,
  parseNullableString,
  parseRecordId,
  parseStrictObject,
  parseString,
  parseUtcString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

const availabilityStates = ["available", "unavailable"] as const;

/** Parses one menu variant while preserving its imported name. */
function parseVariant(value: unknown): MenuVariant {
  const object = parseStrictObject(value, "Menu variant");
  rejectUnknownFields(
    object,
    ["id", "name", "priceDeltaCentavos"],
    "Menu variant",
  );

  return {
    id: parseRecordId<MenuVariantId>(object.id, "Menu variant id"),
    name: parseString(object.name, "Menu variant name"),
    priceDeltaCentavos: parseCentavosValue(
      object.priceDeltaCentavos,
      "Menu variant price delta",
    ),
  };
}

/** Parses one modifier option while preserving its imported name. */
function parseModifierOption(value: unknown): MenuModifierOption {
  const object = parseStrictObject(value, "Menu modifier option");
  rejectUnknownFields(
    object,
    ["id", "name", "priceDeltaCentavos", "availability"],
    "Menu modifier option",
  );

  return {
    id: parseRecordId<MenuModifierOptionId>(
      object.id,
      "Menu modifier option id",
    ),
    name: parseString(object.name, "Menu modifier option name"),
    priceDeltaCentavos: parseCentavosValue(
      object.priceDeltaCentavos,
      "Menu modifier option price delta",
    ),
    availability: parseEnum(
      object.availability,
      availabilityStates,
      "Menu modifier availability",
    ),
  };
}

/** Parses one modifier group and its exact selection bounds. */
function parseModifierGroup(value: unknown): MenuModifierGroup {
  const object = parseStrictObject(value, "Menu modifier group");
  rejectUnknownFields(
    object,
    ["id", "name", "minimumSelections", "maximumSelections", "options"],
    "Menu modifier group",
  );
  const minimumSelections = parseNonNegativeInteger(
    object.minimumSelections,
    "Minimum modifier selections",
  );
  const maximumSelections = parseNonNegativeInteger(
    object.maximumSelections,
    "Maximum modifier selections",
  );

  if (minimumSelections > maximumSelections) {
    throw new TypeError(
      "Minimum modifier selections cannot exceed the maximum.",
    );
  }

  return {
    id: parseRecordId<MenuModifierGroupId>(object.id, "Menu modifier group id"),
    name: parseString(object.name, "Menu modifier group name"),
    minimumSelections,
    maximumSelections,
    options: parseArray(
      object.options,
      "Menu modifier options",
      parseModifierOption,
    ),
  };
}

/** Parses one immutable published menu item. */
function parseMenuItem(value: unknown): MenuItem {
  const object = parseStrictObject(value, "Menu item");
  rejectUnknownFields(
    object,
    [
      "id",
      "name",
      "description",
      "priceCentavos",
      "availability",
      "variants",
      "modifierGroups",
    ],
    "Menu item",
  );

  return {
    id: parseRecordId<MenuItemId>(object.id, "Menu item id"),
    name: parseString(object.name, "Menu item name"),
    description: parseString(object.description, "Menu item description"),
    priceCentavos: parseCentavosValue(object.priceCentavos, "Menu item price"),
    availability: parseEnum(
      object.availability,
      availabilityStates,
      "Menu item availability",
    ),
    variants: parseArray(object.variants, "Menu variants", parseVariant),
    modifierGroups: parseArray(
      object.modifierGroups,
      "Menu modifier groups",
      parseModifierGroup,
    ),
  };
}

/** Validates an immutable catalog response and rejects API fields the clients do not know. */
export function parseCatalogReadModel(value: unknown): CatalogReadModel {
  const object = parseStrictObject(value, "Catalog read model");
  rejectUnknownFields(
    object,
    ["restaurant", "branch", "menuVersion"],
    "Catalog read model",
  );
  const restaurant = parseStrictObject(object.restaurant, "Catalog restaurant");
  const branch = parseStrictObject(object.branch, "Catalog branch");
  const menuVersion = parseStrictObject(
    object.menuVersion,
    "Catalog menu version",
  );
  rejectUnknownFields(restaurant, ["id", "name"], "Catalog restaurant");
  rejectUnknownFields(
    branch,
    ["id", "restaurantId", "name", "grabUrl"],
    "Catalog branch",
  );
  rejectUnknownFields(
    menuVersion,
    ["id", "branchId", "publishedAt", "stale", "items"],
    "Catalog menu version",
  );

  const parsedRestaurant: CatalogRestaurant = {
    id: parseRecordId<RestaurantId>(restaurant.id, "Restaurant id"),
    name: parseString(restaurant.name, "Restaurant name"),
  };
  const parsedBranch: CatalogBranch = {
    id: parseRecordId<BranchId>(branch.id, "Branch id"),
    restaurantId: parseRecordId<RestaurantId>(
      branch.restaurantId,
      "Branch restaurant id",
    ),
    name: parseString(branch.name, "Branch name"),
    grabUrl: parseNullableString(branch.grabUrl, "Branch Grab URL"),
  };
  const parsedMenuVersion: CatalogMenuVersion = {
    id: parseRecordId<MenuVersionId>(menuVersion.id, "Menu version id"),
    branchId: parseRecordId<BranchId>(
      menuVersion.branchId,
      "Menu version branch id",
    ),
    publishedAt: parseUtcString(
      menuVersion.publishedAt,
      "Menu publication time",
    ),
    stale: parseBoolean(menuVersion.stale, "Menu stale flag"),
    items: parseArray(menuVersion.items, "Menu items", parseMenuItem),
  };

  return {
    restaurant: parsedRestaurant,
    branch: parsedBranch,
    menuVersion: parsedMenuVersion,
  };
}
