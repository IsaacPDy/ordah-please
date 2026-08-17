// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefresh, mockFetch } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.stubGlobal("fetch", mockFetch);

import {
  FavoritesView,
  groupFavoritesByBranch,
} from "./favorites-view";

describe("groupFavoritesByBranch", () => {
  it("groups page rows by branch preserving rank order", () => {
    expect(
      groupFavoritesByBranch([
        {
          availability: "available",
          branchId: "branch-1",
          branchName: "Kapitolyo",
          currentPriceCentavos: 25000,
          favoriteId: "a",
          isCurrentlyAvailable: true,
          menuItemId: "item-1",
          name: "Chicken Meal",
          rank: 2,
          restaurantId: "restaurant-1",
          restaurantName: "McDonald's",
        },
        {
          availability: "available",
          branchId: "branch-1",
          branchName: "Kapitolyo",
          currentPriceCentavos: 15000,
          favoriteId: "b",
          isCurrentlyAvailable: true,
          menuItemId: "item-2",
          name: "Fries",
          rank: 1,
          restaurantId: "restaurant-1",
          restaurantName: "McDonald's",
        },
        {
          availability: "available",
          branchId: "branch-2",
          branchName: "Magsaysay",
          currentPriceCentavos: 9900,
          favoriteId: "c",
          isCurrentlyAvailable: false,
          menuItemId: "item-3",
          name: "Bucket",
          rank: 1,
          restaurantId: "restaurant-2",
          restaurantName: "KFC",
        },
      ]),
    ).toStrictEqual([
      {
        branchId: "branch-1",
        branchName: "Kapitolyo",
        favorites: [
          { favoriteId: "b", name: "Fries", priceCentavos: 15000, rank: 1 },
          { favoriteId: "a", name: "Chicken Meal", priceCentavos: 25000, rank: 2 },
        ],
        restaurantName: "McDonald's",
      },
      {
        branchId: "branch-2",
        branchName: "Magsaysay",
        favorites: [
          { favoriteId: "c", name: "Bucket", priceCentavos: 9900, rank: 1 },
        ],
        restaurantName: "KFC",
      },
    ]);
  });
});

describe("FavoritesView", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the empty state when there are no favorites", () => {
    render(<FavoritesView groups={[]} />);
    expect(
      screen.getByText("No favorites yet — browse restaurants to add your first one."),
    ).toBeTruthy();
  });

  it("lists favorites grouped by restaurant with rank badges, prices, and remove buttons", () => {
    render(
      <FavoritesView
        groups={[
          {
            branchId: "branch-1",
            branchName: "Kapitolyo",
            favorites: [
              { favoriteId: "b", name: "Fries", priceCentavos: 15000, rank: 1 },
              { favoriteId: "a", name: "Chicken Meal", priceCentavos: 25000, rank: 2 },
            ],
            restaurantName: "McDonald's",
          },
        ]}
      />,
    );
    expect(screen.getByText("McDonald's — Kapitolyo")).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.getByText("Fries")).toBeTruthy();
    expect(screen.getByText("₱150.00")).toBeTruthy();
    expect(screen.getByText("₱250.00")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Remove Fries from favorites" }),
    ).toBeTruthy();
  });

  it("removes a favorite and refreshes", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    render(
      <FavoritesView
        groups={[
          {
            branchId: "branch-1",
            branchName: "Kapitolyo",
            favorites: [
              { favoriteId: "b", name: "Fries", priceCentavos: 15000, rank: 1 },
            ],
            restaurantName: "McDonald's",
          },
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Fries from favorites" }),
    );
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/favorites/b",
        { method: "DELETE" },
      );
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
