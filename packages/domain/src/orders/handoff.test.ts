import { describe, expect, it } from "vitest";

import * as domain from "../index.js";

type BuildHandoff = (input: {
  selections: readonly {
    userId: string;
    displayName: string;
    selection: {
      items: readonly {
        menuItemId: string;
        name: string;
        quantity: number;
        unitPriceCentavos: number;
        variant: null | { name: string; priceDeltaCentavos: number };
        modifiers: readonly {
          name: string;
          quantity: number;
          priceDeltaCentavos: number;
        }[];
        note: string;
      }[];
    };
  }[];
  grabUrl: string | null;
}) => unknown;

/** Loads the planned policy while keeping the first RED run executable. */
function policy(): BuildHandoff {
  const candidate: unknown =
    "buildOrderHandoff" in domain ? domain.buildOrderHandoff : undefined;
  expect(candidate).toBeTypeOf("function");
  return candidate as BuildHandoff;
}

describe("buildOrderHandoff", () => {
  it("consolidates identical configured lines while preserving member quantities", () => {
    const item = {
      menuItemId: "item-1",
      name: "Chicken Meal",
      quantity: 1,
      unitPriceCentavos: 10000,
      variant: { name: "Spicy", priceDeltaCentavos: 500 },
      modifiers: [
        { name: "Extra rice", quantity: 1, priceDeltaCentavos: 2000 },
      ],
      note: "No utensils",
    } as const;

    expect(
      policy()({
        selections: [
          {
            userId: "user-1",
            displayName: "Alex",
            selection: { items: [item] },
          },
          {
            userId: "user-2",
            displayName: "Blair",
            selection: { items: [{ ...item, quantity: 2 }] },
          },
        ],
        grabUrl: null,
      }),
    ).toEqual({
      lines: [
        {
          itemName: "Chicken Meal",
          quantity: 3,
          unitPriceCentavos: 12500,
          modifiers: ["Spicy", "Extra rice"],
          note: "No utensils",
          memberQuantities: [
            { userId: "user-1", quantity: 1 },
            { userId: "user-2", quantity: 2 },
          ],
          lineSubtotalCentavos: 37500,
        },
      ],
      memberBreakdown: [
        { userId: "user-1", displayName: "Alex", subtotalCentavos: 12500 },
        { userId: "user-2", displayName: "Blair", subtotalCentavos: 25000 },
      ],
      foodSubtotalCentavos: 37500,
      copyableText: "3x Chicken Meal — Spicy, Extra rice — No utensils",
      grabUrl: null,
    });
  });

  it("rejects consolidated quantities that exceed the safe-integer boundary", () => {
    const item = {
      menuItemId: "item-1",
      name: "Free Sample",
      unitPriceCentavos: 0,
      variant: null,
      modifiers: [],
      note: "",
    } as const;

    expect(() =>
      policy()({
        selections: [
          {
            userId: "user-1",
            displayName: "Alex",
            selection: {
              items: [{ ...item, quantity: Number.MAX_SAFE_INTEGER }],
            },
          },
          {
            userId: "user-2",
            displayName: "Blair",
            selection: { items: [{ ...item, quantity: 1 }] },
          },
        ],
        grabUrl: null,
      }),
    ).toThrow("Quantity must be a positive safe integer.");
  });
});
