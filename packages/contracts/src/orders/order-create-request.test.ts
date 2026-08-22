import { describe, expect, it } from "vitest";

import { parseOrderCreateRequest } from "./order-create-request.js";

const groupId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const restaurantId = "33333333-3333-4333-8333-333333333333";
const branchId = "44444444-4444-4444-8444-444444444444";

function baseRequest(): Record<string, unknown> {
  return {
    groupId,
    participantUserIds: [userId],
    deliveryAddress: {
      recipientName: "Mia Tan",
      phoneNumber: "+63 900 000 0000",
      lineOne: "12 Sample Street",
      lineTwo: null,
      city: "Naga",
      postalCode: null,
      notes: null,
    },
    saveAsGroupDefault: false,
    initialRestaurantId: restaurantId,
    initialBranchId: branchId,
    votingMode: "voting_disabled",
    shortlistRestaurantIds: [],
    restaurantDeadline: null,
    foodDeadline: "2026-08-20T09:00:00.000Z",
  };
}

describe("parseOrderCreateRequest", () => {
  it("parses a voting-disabled request", () => {
    const parsed = parseOrderCreateRequest(baseRequest());
    expect(parsed.votingMode).toBe("voting_disabled");
    expect(parsed.restaurantDeadline).toBeNull();
    expect(parsed.shortlistRestaurantIds).toEqual([]);
  });

  it("requires a voting deadline for shortlist and catalog modes", () => {
    const request = baseRequest();
    request.votingMode = "shortlist";
    request.shortlistRestaurantIds = [restaurantId];
    request.restaurantDeadline = "2026-08-20T08:00:00.000Z";
    expect(parseOrderCreateRequest(request).votingMode).toBe("shortlist");

    delete request.restaurantDeadline;
    expect(() => parseOrderCreateRequest(request)).toThrow(TypeError);
  });

  it("requires shortlist ids only in shortlist mode", () => {
    const request = baseRequest();
    request.shortlistRestaurantIds = [restaurantId];
    expect(() => parseOrderCreateRequest(request)).toThrow(TypeError);

    const shortlist = baseRequest();
    shortlist.votingMode = "shortlist";
    shortlist.restaurantDeadline = "2026-08-20T08:00:00.000Z";
    expect(() => parseOrderCreateRequest(shortlist)).not.toThrow();
  });

  it("rejects duplicate participants", () => {
    const request = baseRequest();
    request.participantUserIds = [userId, userId];
    expect(() => parseOrderCreateRequest(request)).toThrow(TypeError);
  });

  it("rejects unknown fields and blank address lines", () => {
    const request = baseRequest();
    request.extra = true;
    expect(() => parseOrderCreateRequest(request)).toThrow(TypeError);

    const blank = baseRequest();
    blank.deliveryAddress = {
      ...(baseRequest().deliveryAddress as Record<string, unknown>),
      city: " ",
    };
    expect(() => parseOrderCreateRequest(blank)).toThrow(TypeError);
  });
});
