import type { RestaurantSummary } from "@ordah-please/domain";

import { parseStringArray } from "../common/parse-string-array.js";
import {
  parseArray,
  parseNullableString,
  parseRecordId,
  parseStrictObject,
  parseString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

/** Validates the member-facing restaurant list response. */
export function parseRestaurantListResponse(
  value: unknown,
): readonly RestaurantSummary[] {
  return parseArray(value, "Restaurant list", parseRestaurantSummary);
}

function parseRestaurantSummary(value: unknown): RestaurantSummary {
  const object = parseStrictObject(value, "Restaurant summary");
  rejectUnknownFields(
    object,
    ["id", "name", "cuisines", "branchId", "branchName", "heroImageUrl"],
    "Restaurant summary",
  );
  return {
    id: parseRecordId(object.id, "Restaurant id"),
    name: parseString(object.name, "Restaurant name"),
    cuisines: parseStringArray(object.cuisines, "Restaurant cuisines"),
    branchId: parseRecordId(object.branchId, "Branch id"),
    branchName: parseString(object.branchName, "Branch name"),
    heroImageUrl: parseNullableString(object.heroImageUrl, "Hero image url"),
  };
}
