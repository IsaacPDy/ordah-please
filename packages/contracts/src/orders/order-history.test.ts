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

const orderFixture = {
  id: "order-1",
  groupId: "group-1",
  managerId: "user-1",
  state: "ordered",
  choiceMode: {
    kind: "shortlist",
    restaurantIds: ["restaurant-1", "restaurant-2"],
  },
  initialRestaurantId: "restaurant-1",
  selectedRestaurantId: "restaurant-2",
  selectedRestaurantName: "McDonald's",
  selectedBranchId: "branch-1",
  selectedBranchName: "McDonald's – Greenhills",
  menuVersionId: "menu-version-1",
  deliveryAddress: "12 Sample Street, San Juan City",
  restaurantDeadline: "2026-07-22T03:00:00.000Z",
  foodDeadline: "2026-07-22T04:00:00.000Z",
  participants: [
    {
      userId: "user-1",
      displayName: "Alex",
      role: "manager",
      restaurantResponse: "responded",
      foodResponse: "confirmed",
    },
  ],
  votes: [
    {
      userId: "user-1",
      restaurantId: "restaurant-2",
      submittedAt: "2026-07-22T02:30:00.000Z",
    },
  ],
  foodResponses: [
    {
      kind: "confirmed",
      userId: "user-1",
      selection: {
        source: { kind: "saved_favorite", favoriteId: "favorite-1" },
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
          },
        ],
      },
      submittedAt: "2026-07-22T03:30:00.000Z",
    },
  ],
  managerResolutions: [],
  handoff: {
    lines: [
      {
        itemName: "1-pc. Chicken McDo & Rice",
        quantity: 2,
        unitPriceCentavos: 9900,
        modifiers: ["Spicy", "Coke McFloat"],
        note: "No utensils",
        memberQuantities: [{ userId: "user-1", quantity: 2 }],
        lineSubtotalCentavos: 19800,
      },
    ],
    memberBreakdown: [
      {
        userId: "user-1",
        displayName: "Alex",
        subtotalCentavos: 19800,
      },
    ],
    foodSubtotalCentavos: 19800,
    copyableText: "2x 1-pc. Chicken McDo & Rice",
    grabUrl: "https://example.test/branch",
  },
  receipt: {
    fileId: "file-1",
    uploadedAt: "2026-07-22T05:00:00.000Z",
  },
  createdAt: "2026-07-22T02:00:00.000Z",
  completedAt: "2026-07-22T05:00:00.000Z",
} as const;

describe("parseOrderHistorySnapshot", () => {
  it("round-trips the immutable order, vote, food, handoff, and receipt snapshot", () => {
    const parseOrderHistorySnapshot = requiredParser(
      "parseOrderHistorySnapshot",
    );

    expect(parseOrderHistorySnapshot(orderFixture)).toEqual(orderFixture);
  });

  it("rejects unknown fields at the order boundary", () => {
    const parseOrderHistorySnapshot = requiredParser(
      "parseOrderHistorySnapshot",
    );

    expect(() =>
      parseOrderHistorySnapshot({
        ...orderFixture,
        finalGrabTotalCentavos: 25000,
      }),
    ).toThrow(
      "Order history snapshot contains unknown field: finalGrabTotalCentavos.",
    );
  });

  it("preserves the copyable fallback when receipt and Grab link are absent", () => {
    const parseOrderHistorySnapshot = requiredParser(
      "parseOrderHistorySnapshot",
    );
    const fallbackOnly = {
      ...orderFixture,
      handoff: { ...orderFixture.handoff, grabUrl: null },
      receipt: null,
    };

    expect(parseOrderHistorySnapshot(fallbackOnly)).toEqual(fallbackOnly);
  });

  it("rejects active states from the completed history boundary", () => {
    const parseOrderHistorySnapshot = requiredParser(
      "parseOrderHistorySnapshot",
    );

    expect(() =>
      parseOrderHistorySnapshot({
        ...orderFixture,
        state: "food_confirmation",
      }),
    ).toThrow("Completed order state is not supported.");
  });
});
