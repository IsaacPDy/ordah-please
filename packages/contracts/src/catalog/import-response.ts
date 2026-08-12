import type { CatalogImportSummary } from "@ordah-please/domain";

import {
  parseArray,
  parseNonNegativeInteger,
  parseStrictObject,
  parseString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

/** Validates the upload endpoint response. */
export function parseCatalogImportResponse(
  value: unknown,
): CatalogImportSummary {
  const object = parseStrictObject(value, "Catalog import summary");
  rejectUnknownFields(
    object,
    [
      "restaurantsAdded",
      "restaurantsUpdated",
      "itemsAdded",
      "itemsSkipped",
      "warnings",
    ],
    "Catalog import summary",
  );
  return {
    restaurantsAdded: parseNonNegativeInteger(
      object.restaurantsAdded,
      "restaurantsAdded",
    ),
    restaurantsUpdated: parseNonNegativeInteger(
      object.restaurantsUpdated,
      "restaurantsUpdated",
    ),
    itemsAdded: parseNonNegativeInteger(object.itemsAdded, "itemsAdded"),
    itemsSkipped: parseNonNegativeInteger(object.itemsSkipped, "itemsSkipped"),
    warnings: parseArray(object.warnings, "Warnings", parseWarning),
  };
}

function parseWarning(
  value: unknown,
): CatalogImportSummary["warnings"][number] {
  const object = parseStrictObject(value, "Catalog import warning");
  rejectUnknownFields(object, ["row", "reason"], "Catalog import warning");
  return {
    row: parseNonNegativeInteger(object.row, "Warning row"),
    reason: parseString(object.reason, "Warning reason"),
  };
}
