import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { RestaurantSummaryRow } from "@ordah-please/db";

const listCachedRestaurantPreviews = vi.hoisted(() =>
  vi.fn<
    (options: {
      readonly limit: number;
      readonly offset?: number;
    }) => Promise<readonly RestaurantSummaryRow[]>
  >(() => Promise.resolve([])),
);

vi.mock("../../../src/features/catalog/catalog-cache", () => ({
  listCachedRestaurantPreviews,
}));
vi.mock("next/image", () => ({ default: () => null }));

import RestaurantsPage from "./page";

describe("member restaurant index", () => {
  it("renders one bounded page with next navigation", async () => {
    listCachedRestaurantPreviews.mockResolvedValueOnce(
      Array.from({ length: 21 }, (_, index) => ({
        branchId: `branch-${index}`,
        branchName: "Main",
        cuisines: [],
        heroImageUrl: null,
        restaurantId: `restaurant-${index}`,
        restaurantName: `Restaurant ${index}`,
      })),
    );

    const html = renderToStaticMarkup(await RestaurantsPage({}));

    expect(html).toContain("All restaurants");
    expect(html).toContain("Restaurant 19");
    expect(html).not.toContain("Restaurant 20");
    expect(html).toContain('href="/restaurants?page=2"');
    expect(listCachedRestaurantPreviews).toHaveBeenCalledWith({
      limit: 21,
      offset: 0,
    });
  });
});
