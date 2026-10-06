// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SessionsView } from "./sessions-view";
import type { OrderSummaryPage } from "../../../src/features/orders/orders-service";

const summary: OrderSummaryPage = {
  active: [
    {
      orderId: "active",
      groupId: "group",
      groupName: "Friends",
      state: "food_confirmation",
      restaurantName: "Grill",
      deadline: null,
      participantsVoted: 1,
      participantsTotal: 2,
      participants: [],
      completedAt: null,
    },
  ],
  history: [
    {
      orderId: "past",
      groupId: "group",
      groupName: "Friends",
      state: "ordered",
      restaurantName: "Pizza",
      deadline: null,
      participantsVoted: 0,
      participantsTotal: 2,
      participants: [],
      completedAt: new Date("2026-09-02T00:00:00Z"),
    },
  ],
  nextCursor: null,
};
afterEach(cleanup);
describe("SessionsView", () => {
  it("switches the visible orders between Active and Past", () => {
    render(<SessionsView summaries={summary} canStartOrder />);
    expect(
      screen.getByRole("link", { name: /Food picking/ }).getAttribute("href"),
    ).toBe("/orders/active");
    expect(screen.queryByRole("button", { name: /Show order log/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Past" }));
    expect(screen.queryByRole("link", { name: /Food picking/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Show order log for Pizza/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(screen.getByRole("link", { name: /Food picking/ })).toBeTruthy();
  });
  it("opens a direct Past link without granting the member a start action", () => {
    render(
      <SessionsView
        summaries={summary}
        canStartOrder={false}
        initialTab="past"
      />,
    );
    expect(screen.getByRole("heading", { name: "Order history" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    expect(
      screen.queryByRole("link", { name: /Start a group order/ }),
    ).toBeNull();
  });
});
