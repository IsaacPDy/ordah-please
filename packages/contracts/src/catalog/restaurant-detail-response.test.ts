import { describe, expect, it } from "vitest";

import { parseRestaurantDetailResponse } from "./restaurant-detail-response.js";

const validDetail = {
  restaurantId: "rest-1",
  restaurantName: "McDonald's",
  cuisines: ["American"],
  branchId: "branch-1",
  branchName: "Magsaysay",
  grabUrl: "https://food.grab.com/example",
  menuVersionPublishedAt: "2026-08-12T00:00:00.000Z",
  categories: [
    {
      name: "New Offers",
      items: [
        {
          id: "item-1",
          name: "McCafé Iced Coffee Coco Mocha",
          description: "Coffee",
          priceCentavos: 8900,
          availability: "available",
          imageUrl: "https://example.test/photo.avif",
          variants: [],
          modifierGroups: [],
        },
      ],
    },
  ],
};

describe("parseRestaurantDetailResponse", () => {
  it("preserves a valid detail response exactly", () => {
    expect(parseRestaurantDetailResponse(validDetail)).toEqual(validDetail);
  });

  it("allows null grabUrl and null imageUrl", () => {
    const input = {
      ...validDetail,
      grabUrl: null,
      categories: [
        {
          ...validDetail.categories[0]!,
          items: [{ ...validDetail.categories[0]!.items[0]!, imageUrl: null }],
        },
      ],
    };
    expect(parseRestaurantDetailResponse(input)).toEqual(input);
  });

  it("rejects an unknown top-level field", () => {
    expect(() =>
      parseRestaurantDetailResponse({ ...validDetail, extra: true }),
    ).toThrow("Restaurant detail contains unknown field");
  });

  it("rejects a non-empty variants array (V1 does not support variants)", () => {
    const input = {
      ...validDetail,
      categories: [
        {
          ...validDetail.categories[0]!,
          items: [
            {
              ...validDetail.categories[0]!.items[0]!,
              variants: [{ id: "v-1", name: "Spicy", priceDeltaCentavos: 0 }],
            },
          ],
        },
      ],
    };
    expect(() => parseRestaurantDetailResponse(input)).toThrow(
      "Variants and modifier groups are not supported in V1",
    );
  });
});
