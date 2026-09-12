import { describe, expect, it, vi } from "vitest";

import { loadAdminCatalogPage } from "./catalog-page-data";

describe("admin catalog page data", () => {
  it("loads one bounded page and exposes whether another page exists", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      branchId: `branch-${index}`,
      branchName: "Main",
      cuisines: [],
      heroImageUrl: null,
      restaurantId: `restaurant-${index}`,
      restaurantName: `Restaurant ${index}`,
    }));
    const listRestaurantPreviews = vi.fn(() => Promise.resolve(rows));

    const result = await loadAdminCatalogPage("2", listRestaurantPreviews);

    expect(result).toMatchObject({
      hasNextPage: true,
      page: 2,
    });
    expect(result.restaurants).toHaveLength(50);
    expect(listRestaurantPreviews).toHaveBeenCalledWith({
      limit: 51,
      offset: 50,
    });
  });

  it("falls back to the first page for invalid input", async () => {
    const listRestaurantPreviews = vi.fn(() => Promise.resolve([]));

    await loadAdminCatalogPage("not-a-page", listRestaurantPreviews);

    expect(listRestaurantPreviews).toHaveBeenCalledWith({
      limit: 51,
      offset: 0,
    });
  });
});
