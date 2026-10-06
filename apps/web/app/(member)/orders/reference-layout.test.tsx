// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrderHistoryList } from "./order-history-list";
import { FavoritesView } from "../favorites/favorites-view";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);
it("filters monthly history by completion month without fetching details", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const base = {
    orderId: "one",
    groupId: "g",
    groupName: "Team",
    state: "ordered" as const,
    restaurantName: "KFC",
    deadline: null,
    participants: [] as const,
    participantsTotal: 4,
    participantsVoted: 0,
  };
  render(
    <OrderHistoryList
      initialHistory={[
        { ...base, completedAt: new Date("2026-10-04T00:00:00Z") },
        {
          ...base,
          orderId: "two",
          restaurantName: "Burger King",
          completedAt: new Date("2026-09-04T00:00:00Z"),
        },
      ]}
      initialNextCursor={null}
    />,
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Filter history by month" }),
    { target: { value: "October 2026" } },
  );
  expect(screen.queryByRole("button", { name: /Burger King/ })).toBeNull();
  expect(screen.getByRole("button", { name: /KFC/ })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});
it("switches favorites between restaurant sections and all meals", () => {
  render(
    <FavoritesView
      groups={[
        {
          branchId: "b",
          restaurantName: "KFC",
          branchName: "Naga",
          favorites: [
            { favoriteId: "f", name: "Chicken", rank: 1, priceCentavos: 14500 },
          ],
        },
      ]}
    />,
  );
  expect(screen.getByRole("heading", { name: "KFC — Naga" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "All favorites" }));
  expect(screen.queryByRole("heading", { name: "KFC — Naga" })).toBeNull();
  expect(screen.getByText("Chicken")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "By restaurant" }));
  expect(screen.getByRole("heading", { name: "KFC — Naga" })).toBeTruthy();
});
