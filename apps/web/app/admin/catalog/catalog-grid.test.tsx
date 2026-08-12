// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({ default: () => null }));

import { CatalogGrid } from "./catalog-grid";

afterEach(cleanup);

describe("admin catalog grid", () => {
  it("filters restaurants by name", () => {
    render(
      <CatalogGrid
        restaurants={[
          {
            branchId: "branch-1",
            branchName: "Magsaysay",
            cuisines: ["Burgers"],
            heroImageUrl: null,
            restaurantId: "restaurant-1",
            restaurantName: "McDonald's",
          },
          {
            branchId: "branch-2",
            branchName: "Centro",
            cuisines: ["Chicken"],
            heroImageUrl: null,
            restaurantId: "restaurant-2",
            restaurantName: "KFC",
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search restaurants"), {
      target: { value: "kfc" },
    });

    expect(screen.getByText("KFC")).toBeTruthy();
    expect(screen.queryByText("McDonald's")).toBeNull();
  });
});
