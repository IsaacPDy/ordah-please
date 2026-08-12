import type { RestaurantDetail } from "@ordah-please/domain";

import { parseStringArray } from "../common/parse-string-array.js";
import {
  parseArray,
  parseCentavosValue,
  parseEnum,
  parseNullableString,
  parseRecordId,
  parseStrictObject,
  parseString,
  parseUtcString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

const availabilityStates = ["available", "unavailable"] as const;

/** Validates the member restaurant detail response. */
export function parseRestaurantDetailResponse(value: unknown): RestaurantDetail {
  const object = parseStrictObject(value, "Restaurant detail");
  rejectUnknownFields(
    object,
    [
      "restaurantId",
      "restaurantName",
      "cuisines",
      "branchId",
      "branchName",
      "grabUrl",
      "menuVersionPublishedAt",
      "categories",
    ],
    "Restaurant detail",
  );
  return {
    restaurantId: parseRecordId(object.restaurantId, "Restaurant id"),
    restaurantName: parseString(object.restaurantName, "Restaurant name"),
    cuisines: parseStringArray(object.cuisines, "Restaurant cuisines"),
    branchId: parseRecordId(object.branchId, "Branch id"),
    branchName: parseString(object.branchName, "Branch name"),
    grabUrl: parseNullableString(object.grabUrl, "Branch grab URL"),
    menuVersionPublishedAt: parseUtcString(
      object.menuVersionPublishedAt,
      "Menu version published at",
    ),
    categories: parseArray(object.categories, "Categories", parseCategory),
  };
}

function parseCategory(value: unknown): RestaurantDetail["categories"][number] {
  const object = parseStrictObject(value, "Restaurant menu category");
  rejectUnknownFields(object, ["name", "items"], "Restaurant menu category");
  return {
    name: parseString(object.name, "Category name"),
    items: parseArray(object.items, "Category items", parseItem),
  };
}

function parseItem(
  value: unknown,
): RestaurantDetail["categories"][number]["items"][number] {
  const object = parseStrictObject(value, "Menu item");
  rejectUnknownFields(
    object,
    [
      "id",
      "name",
      "description",
      "priceCentavos",
      "availability",
      "imageUrl",
      "variants",
      "modifierGroups",
    ],
    "Menu item",
  );
  const variants = parseArray(object.variants, "Menu item variants", (v) => v);
  const modifierGroups = parseArray(
    object.modifierGroups,
    "Menu item modifier groups",
    (v) => v,
  );
  if (variants.length > 0 || modifierGroups.length > 0) {
    throw new TypeError(
      "Variants and modifier groups are not supported in V1.",
    );
  }
  return {
    id: parseRecordId(object.id, "Menu item id"),
    name: parseString(object.name, "Menu item name"),
    description: parseString(object.description, "Menu item description"),
    priceCentavos: parseCentavosValue(object.priceCentavos, "Menu item price"),
    availability: parseEnum(
      object.availability,
      availabilityStates,
      "Menu item availability",
    ),
    imageUrl: parseNullableString(object.imageUrl, "Menu item image url"),
    variants: [],
    modifierGroups: [],
  };
}
