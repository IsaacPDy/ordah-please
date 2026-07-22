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

const inlineSelection = {
  source: { kind: "inline" },
  items: [
    {
      menuItemId: "item-1",
      name: "1-pc. Chicken McDo & Rice",
      quantity: 1,
      unitPriceCentavos: 9900,
      variant: null,
      modifiers: [],
      note: "",
    },
  ],
} as const;

describe("order mutation request parsers", () => {
  it("parses a strict restaurant vote request", () => {
    const parseSubmitRestaurantVoteRequest = requiredParser(
      "parseSubmitRestaurantVoteRequest",
    );
    const request = { orderId: "order-1", restaurantId: "restaurant-2" };

    expect(parseSubmitRestaurantVoteRequest(request)).toEqual(request);
    expect(() =>
      parseSubmitRestaurantVoteRequest({ ...request, userId: "forged-user" }),
    ).toThrow("Restaurant vote request contains unknown field: userId.");
  });

  it("parses an inline food confirmation without requiring an existing favorite", () => {
    const parseSubmitFoodResponseRequest = requiredParser(
      "parseSubmitFoodResponseRequest",
    );
    const request = {
      orderId: "order-1",
      response: { kind: "confirmed", selection: inlineSelection },
    };

    expect(parseSubmitFoodResponseRequest(request)).toEqual(request);
  });

  it("parses organizer-selected inline food for another participant", () => {
    const parseOrganizerResolutionRequest = requiredParser(
      "parseOrganizerResolutionRequest",
    );
    const request = {
      orderId: "order-1",
      userId: "user-2",
      selection: inlineSelection,
    };

    expect(parseOrganizerResolutionRequest(request)).toEqual(request);
  });
});
