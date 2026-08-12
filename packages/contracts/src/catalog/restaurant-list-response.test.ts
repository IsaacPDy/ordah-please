import { describe, expect, it } from "vitest";

import { parseRestaurantListResponse } from "./restaurant-list-response.js";

describe("parseRestaurantListResponse", () => {
  it("parses a valid list with one restaurant", () => {
    const input = [
      {
        id: "rest-1",
        name: "McDonald's",
        cuisines: ["American", "Burger"],
        branchId: "branch-1",
        branchName: "Magsaysay",
        heroImageUrl: "https://example.test/photo.avif",
      },
    ];
    expect(parseRestaurantListResponse(input)).toEqual(input);
  });

  it("parses an empty list", () => {
    expect(parseRestaurantListResponse([])).toEqual([]);
  });

  it("allows null heroImageUrl", () => {
    const input = [
      {
        id: "rest-1",
        name: "Test",
        cuisines: [],
        branchId: "b-1",
        branchName: "Branch",
        heroImageUrl: null,
      },
    ];
    expect(parseRestaurantListResponse(input)).toEqual(input);
  });

  it("rejects an entry with an unexpected field", () => {
    expect(() =>
      parseRestaurantListResponse([
        {
          id: "rest-1",
          name: "Test",
          cuisines: [],
          branchId: "b-1",
          branchName: "Branch",
          heroImageUrl: null,
          unexpected: true,
        },
      ]),
    ).toThrow("Restaurant summary contains unknown field");
  });
});
