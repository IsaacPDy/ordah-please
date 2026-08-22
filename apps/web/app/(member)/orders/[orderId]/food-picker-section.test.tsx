// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}));

import { FoodPickerSection } from "./food-picker-section";

const favorites = [
  {
    available: true,
    description: "Burger, fries, and drink",
    favoriteId: "favorite-1",
    menuItemId: "menu-1",
    name: "Zinger Combo",
    priceCentavos: 22500,
    rank: 1,
  },
  {
    available: false,
    description: "Chicken, rice, and drink",
    favoriteId: "favorite-2",
    menuItemId: "menu-2",
    name: "1-pc Chicken Meal",
    priceCentavos: 14500,
    rank: 2,
  },
];

function postResponse(): Response {
  return new Response(null, { status: 200 });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FoodPickerSection", () => {
  it("renders favorites with prices, the automatic-pick note, and disables unavailable ones", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(postResponse())));
    render(
      <FoodPickerSection
        currentLines={[]}
        currentStatus="pending"
        favorites={favorites}
        locked={false}
        orderId="order-1"
        restaurantId="restaurant-1"
        restaurantName="KFC"
      />,
    );
    expect(screen.getByText("Zinger Combo")).toBeTruthy();
    expect(screen.getByText("₱225.00")).toBeTruthy();
    expect(
      screen.getByText("#1 · ordered automatically if you don't pick"),
    ).toBeTruthy();
    const unavailable = screen.getByRole("button", {
      name: /1-pc Chicken Meal/,
    });
    expect(unavailable.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText(
        "If the deadline passes without your pick, your #1 favorite is ordered automatically.",
      ),
    ).toBeTruthy();
  });

  it("confirms a selected favorite through the food-response API", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(postResponse()));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FoodPickerSection
        currentLines={[]}
        currentStatus="pending"
        favorites={favorites}
        locked={false}
        orderId="order-1"
        restaurantId="restaurant-1"
        restaurantName="KFC"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Zinger Combo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Order this!" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/orders/order-1/food-response",
        expect.objectContaining({
          body: JSON.stringify({ favoriteId: "favorite-1", kind: "favorite" }),
          method: "POST",
        }),
      );
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows the confirmed pick with Cancel pick and Not eating", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(postResponse()));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FoodPickerSection
        currentLines={[
          { itemName: "Zinger Combo", note: "Extra gravy", quantity: 1 },
        ]}
        currentStatus="confirmed"
        favorites={favorites}
        locked={false}
        orderId="order-1"
        restaurantId="restaurant-1"
        restaurantName="KFC"
      />,
    );
    expect(screen.getByText("Ready to order")).toBeTruthy();
    expect(screen.getByText("Extra gravy")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel pick" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/orders/order-1/food-response",
        expect.objectContaining({
          body: JSON.stringify({ kind: "clear" }),
          method: "POST",
        }),
      );
    });
  });

  it("declines with Not eating", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(postResponse()));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FoodPickerSection
        currentLines={[]}
        currentStatus="pending"
        favorites={favorites}
        locked={false}
        orderId="order-1"
        restaurantId="restaurant-1"
        restaurantName="KFC"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Not eating" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/orders/order-1/food-response",
        expect.objectContaining({
          body: JSON.stringify({ kind: "declined" }),
          method: "POST",
        }),
      );
    });
  });

  it("renders read-only when locked", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(postResponse())));
    render(
      <FoodPickerSection
        currentLines={[
          { itemName: "Zinger Combo", note: "", quantity: 1 },
        ]}
        currentStatus="confirmed"
        favorites={favorites}
        locked={true}
        orderId="order-1"
        restaurantId="restaurant-1"
        restaurantName="KFC"
      />,
    );
    expect(
      screen.getByText("Food picks have closed. Your pick is locked in."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Cancel pick" }),
    ).toBeNull();
  });

  it("links to the restaurant menu when there are no favorites", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(postResponse())));
    render(
      <FoodPickerSection
        currentLines={[]}
        currentStatus="pending"
        favorites={[]}
        locked={false}
        orderId="order-1"
        restaurantId="restaurant-1"
        restaurantName="KFC"
      />,
    );
    const link = screen.getByRole("link", { name: "Browse the menu" });
    expect(link.getAttribute("href")).toBe("/restaurants/restaurant-1");
  });
});
