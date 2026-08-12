import { describe, expect, it } from "vitest";

import { parseCatalogImportResponse } from "./import-response.js";

describe("parseCatalogImportResponse", () => {
  it("parses a successful summary", () => {
    const input = {
      restaurantsAdded: 2,
      restaurantsUpdated: 1,
      itemsAdded: 47,
      itemsSkipped: 1,
      warnings: [{ row: 12, reason: "price_centavos missing" }],
    };
    expect(parseCatalogImportResponse(input)).toEqual(input);
  });

  it("parses an empty warnings list", () => {
    const input = {
      restaurantsAdded: 1,
      restaurantsUpdated: 0,
      itemsAdded: 3,
      itemsSkipped: 0,
      warnings: [],
    };
    expect(parseCatalogImportResponse(input)).toEqual(input);
  });

  it("rejects a negative count", () => {
    expect(() =>
      parseCatalogImportResponse({
        restaurantsAdded: -1,
        restaurantsUpdated: 0,
        itemsAdded: 0,
        itemsSkipped: 0,
        warnings: [],
      }),
    ).toThrow("restaurantsAdded must be a non-negative safe integer");
  });
});
