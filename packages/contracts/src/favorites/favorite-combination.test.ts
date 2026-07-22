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

const favoriteFixture = {
  id: "favorite-1",
  userId: "user-1",
  branchId: "branch-1",
  menuVersionId: "menu-version-1",
  rank: 1,
  availability: "available",
  items: [
    {
      menuItemId: "item-1",
      name: "1-pc. Chicken McDo & Rice",
      quantity: 2,
      unitPriceCentavos: 9900,
      variant: {
        menuVariantId: "variant-1",
        name: "Spicy",
        priceDeltaCentavos: 500,
      },
      modifiers: [
        {
          menuModifierOptionId: "modifier-1",
          name: "Coke McFloat",
          quantity: 1,
          priceDeltaCentavos: 2500,
        },
      ],
      note: "No utensils",
      availability: "available",
    },
  ],
} as const;

describe("parseFavoriteCombination", () => {
  it("accepts a complete ranked combination with captured configuration", () => {
    const parseFavoriteCombination = requiredParser("parseFavoriteCombination");

    expect(parseFavoriteCombination(favoriteFixture)).toEqual(favoriteFixture);
  });

  it("rejects unknown nested fields", () => {
    const parseFavoriteCombination = requiredParser("parseFavoriteCombination");
    const invalid = {
      ...favoriteFixture,
      items: [{ ...favoriteFixture.items[0], normalizedName: "chicken" }],
    };

    expect(() => parseFavoriteCombination(invalid)).toThrow(
      "Favorite item contains unknown field: normalizedName.",
    );
  });

  it("accepts a complete item when the menu offers no variant", () => {
    const parseFavoriteCombination = requiredParser("parseFavoriteCombination");
    const withoutVariant = {
      ...favoriteFixture,
      items: [{ ...favoriteFixture.items[0], variant: null }],
    };

    expect(parseFavoriteCombination(withoutVariant)).toEqual(withoutVariant);
  });
});
