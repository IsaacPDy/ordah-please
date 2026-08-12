import { describe, expect, it } from "vitest";

import * as contracts from "../index.js";

type BoundaryParser = (value: unknown) => unknown;

/** Loads a planned public parser while keeping the first RED run executable. */
function requiredParser(name: string): BoundaryParser {
  const candidate: unknown =
    name in contracts ? contracts[name as keyof typeof contracts] : undefined;

  expect(candidate, `${name} must be exported`).toBeTypeOf("function");
  return candidate as BoundaryParser;
}

const catalogFixture = {
  restaurant: {
    id: "restaurant-1",
    name: "McDonald's",
    cuisines: ["American", "Burger"],
  },
  branch: {
    id: "branch-1",
    restaurantId: "restaurant-1",
    name: "McDonald's – Greenhills",
    grabUrl: "https://example.test/branch",
  },
  menuVersion: {
    id: "menu-version-1",
    branchId: "branch-1",
    publishedAt: "2026-07-22T02:00:00.000Z",
    stale: false,
    items: [
      {
        id: "item-1",
        name: "1-pc. Chicken McDo & Rice",
        description: "Original imported wording",
        priceCentavos: 9900,
        availability: "available",
        imageUrl: "https://example.test/item.avif",
        variants: [{ id: "variant-1", name: "Spicy", priceDeltaCentavos: 500 }],
        modifierGroups: [
          {
            id: "group-1",
            name: "Drink",
            minimumSelections: 1,
            maximumSelections: 1,
            options: [
              {
                id: "modifier-1",
                name: "Coke McFloat",
                priceDeltaCentavos: 2500,
                availability: "available",
              },
            ],
          },
        ],
      },
    ],
  },
} as const;

describe("parseCatalogReadModel", () => {
  it("preserves imported proper-name strings and menu-version references exactly", () => {
    const parseCatalogReadModel = requiredParser("parseCatalogReadModel");

    expect(parseCatalogReadModel(catalogFixture)).toEqual(catalogFixture);
  });

  it("rejects unknown fields instead of silently accepting API drift", () => {
    const parseCatalogReadModel = requiredParser("parseCatalogReadModel");

    expect(() =>
      parseCatalogReadModel({ ...catalogFixture, unexpected: true }),
    ).toThrow("Catalog read model contains unknown field: unexpected.");
  });

  it("keeps catalog data usable when no Grab branch link is available", () => {
    const parseCatalogReadModel = requiredParser("parseCatalogReadModel");

    expect(
      parseCatalogReadModel({
        ...catalogFixture,
        branch: { ...catalogFixture.branch, grabUrl: null },
      }),
    ).toMatchObject({ branch: { grabUrl: null } });
  });
});
