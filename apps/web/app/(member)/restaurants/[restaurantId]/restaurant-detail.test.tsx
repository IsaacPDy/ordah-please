import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const readEvents = vi.hoisted(() => [] as string[]);
const listFavoritesForBranch = vi.hoisted(() =>
  vi.fn(() => Promise.resolve([])),
);

vi.mock("../../../../src/features/catalog/catalog-cache", () => ({
  getCachedRestaurantDetail: () => (
    readEvents.push("detail"),
    Promise.resolve({
      branchId: "branch-1",
      branchName: "Naga Plaza",
      categories: [
        {
          items: [
            {
              basePriceCentavos: 19900,
              description: "Crispy chicken with rice and a drink.",
              id: "item-1",
              imageUrl: "https://example.com/chicken.jpg",
              name: "Chicken meal",
            },
          ],
          name: "Meals",
        },
      ],
      cuisines: ["Fried Chicken"],
      grabUrl: "https://example.com/grab",
      restaurantName: "KFC - Naga Plaza",
    })
  ),
}));

vi.mock("../../../../src/features/favorites/favorites-runtime", () => ({
  favoritesRuntime: {
    listFavoritesForBranch,
  },
}));

vi.mock("../../../../src/auth/load-server-page-identity", () => ({
  getCurrentServerPageIdentity: () => (
    readEvents.push("identity"),
    Promise.resolve({
      identity: {
        userId: "user-1",
      },
      status: "authenticated",
    })
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

import RestaurantDetailPage from "./page";

describe("restaurant detail page", () => {
  it("renders the real menu without a duplicate page-level back link", async () => {
    readEvents.length = 0;
    listFavoritesForBranch.mockClear();
    const page = await RestaurantDetailPage({
      params: Promise.resolve({ restaurantId: "restaurant-1" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("KFC - Naga Plaza");
    expect(html).toContain("Chicken meal");
    expect(html).toContain("₱199.00");
    expect(html).toContain("restaurant-detail__item");
    expect(html).not.toContain("restaurant-detail__back");
    expect(html).not.toContain("← Back");
    expect(readEvents.slice(0, 2)).toEqual(["identity", "detail"]);
    expect(listFavoritesForBranch).toHaveBeenCalledWith("user-1", "branch-1");
  });
});
