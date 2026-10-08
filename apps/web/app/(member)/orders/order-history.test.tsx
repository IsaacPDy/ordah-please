// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listOrderSummaryPage } = vi.hoisted(() => ({
  listOrderSummaryPage: vi.fn(),
}));

vi.mock("../../../src/auth/load-server-page-identity", () => ({
  getCurrentServerPageIdentity: () =>
    Promise.resolve({
      identity: {
        authUserId: "auth-1",
        displayName: "Fiona Santos",
        email: "fiona@example.com",
        imageUrl: null,
        isPlatformAdmin: false,
        memberships: [{ groupId: "group-1", role: "group-owner" }],
        userId: "user-1",
      },
      status: "authenticated",
    }),
}));

vi.mock("../../../src/features/orders/orders-runtime", () => ({
  ordersRuntime: { listOrderSummaryPage },
}));

import OrdersPage from "./page";
import { OrderHistoryList } from "./order-history-list";

const orderId = "99999999-9999-4999-8999-999999999999";
const compactOrder = {
  completedAt: new Date("2026-09-10T16:30:00.000Z"),
  deadline: null,
  groupId: "group-1",
  groupName: "Friends",
  orderId,
  participants: [] as const,
  participantsTotal: 3,
  participantsVoted: 0,
  foodSubtotalCentavos: 42000,
  restaurantName: "KFC – Magsaysay",
  state: "ordered" as const,
};

afterEach(cleanup);

describe("progressive Orders History", () => {
  it("combines restaurant, status, and date filters within group history", () => {
    render(
      <OrderHistoryList
        groupId="group-1"
        initialNextCursor={null}
        initialHistory={[
          compactOrder,
          {
            ...compactOrder,
            orderId: "cancelled",
            state: "cancelled",
            restaurantName: "Pancake House",
            completedAt: new Date("2026-08-10T00:00:00Z"),
          },
          {
            ...compactOrder,
            orderId: "other-group",
            groupId: "group-2",
            restaurantName: "Other group restaurant",
          },
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Filter history by status" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Cancelled" }));
    expect(
      screen.getByRole("button", { name: "Show order log for Pancake House" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Show order log for KFC – Magsaysay",
      }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Filter history by restaurant" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "KFC – Magsaysay" }));
    expect(
      screen.getByText("No orders match these filters on the loaded pages."),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Filter history by status" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "All statuses" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Filter history by month" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "August 2026" }));
    expect(
      screen.queryByRole("button", {
        name: "Show order log for KFC – Magsaysay",
      }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Filter history by month" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "All time" }));
    expect(
      screen.getByRole("button", {
        name: "Show order log for KFC – Magsaysay",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Show order log for Other group restaurant",
      }),
    ).toBeNull();
  });
  beforeEach(() => {
    vi.restoreAllMocks();
    listOrderSummaryPage.mockReset();
    listOrderSummaryPage.mockResolvedValue({
      active: [],
      history: [compactOrder],
      nextCursor: null,
    });
  });

  it("uses the edited session date for finished and cancelled history months", () => {
    render(
      <OrderHistoryList
        initialHistory={[
          { ...compactOrder, loggedAt: new Date("2026-08-12T16:30:00Z") },
          {
            ...compactOrder,
            orderId: "cancelled",
            state: "cancelled",
            restaurantName: "Pancake House",
            loggedAt: new Date("2026-07-01T00:00:00Z"),
          },
        ]}
        initialNextCursor={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "August 2026" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "July 2026" })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "September 2026" }),
    ).toBeNull();
    expect(screen.getAllByText(/Aug 13, 2026/).length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Filter history by month" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "August 2026" }));
    expect(
      screen.getByRole("button", { name: /Show order log for KFC/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Pancake House/ })).toBeNull();
  });

  it("requests a person log only when its compact card opens", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            orderId,
            participants: [
              {
                displayName: "Fiona Santos",
                foodResponse: "confirmed",
                itemCount: 2,
                subtotalCentavos: 42000,
                userId: "user-1",
              },
            ],
          },
          ok: true,
        }),
        { status: 200 },
      ),
    );
    render(
      <OrderHistoryList
        initialHistory={[compactOrder]}
        initialNextCursor={null}
      />,
    );

    expect(screen.queryByText("Fiona Santos")).toBeNull();
    expect(screen.getByText("₱420.00")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.queryByText("View food subtotal")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show order log for KFC – Magsaysay",
      }),
    );

    expect(await screen.findByText("Fiona Santos")).toBeTruthy();
    expect(screen.getByText("2 items")).toBeTruthy();
    expect(screen.getAllByText("₱420.00")).toHaveLength(2);
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.queryByText("Visible food subtotal")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(`/api/orders/${orderId}/history`, {
      method: "GET",
    });

    fireEvent.click(screen.getByRole("button", { name: /Hide order log/ }));
    fireEvent.click(screen.getByRole("button", { name: /Show order log/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the compact card and offers Retry when detail fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false }), { status: 503 }),
    );
    render(
      <OrderHistoryList
        initialHistory={[compactOrder]}
        initialNextCursor={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Show order log/ }));

    expect(
      await screen.findByText("Couldn’t load this order log."),
    ).toBeTruthy();
    expect(screen.getByText("KFC – Magsaysay")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("does not duplicate a detail request during rapid reopen", async () => {
    let finishRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finishRequest = resolve;
        }),
    );
    render(
      <OrderHistoryList
        initialHistory={[compactOrder]}
        initialNextCursor={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Show order log/ }));
    fireEvent.click(screen.getByRole("button", { name: /Hide order log/ }));
    fireEvent.click(screen.getByRole("button", { name: /Show order log/ }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    finishRequest?.(
      new Response(
        JSON.stringify({ data: { orderId, participants: [] }, ok: true }),
        { status: 200 },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("Loading order log…")).toBeNull(),
    );
  });

  it("shows a safe retry message when the first summary page fails", async () => {
    listOrderSummaryPage.mockRejectedValueOnce(
      new Error("database password leaked by mistake"),
    );

    const html = renderToStaticMarkup(await OrdersPage());

    expect(html).toContain(
      "Couldn&#x27;t load orders. Refresh this page to try again.",
    );
    expect(html).not.toContain("database password leaked by mistake");
  });

  it("appends another compact page without discarding existing cards", async () => {
    const nextOrder = {
      ...compactOrder,
      orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      restaurantName: "Jollibee",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { active: [], history: [nextOrder], nextCursor: null },
          ok: true,
        }),
        { status: 200 },
      ),
    );
    render(
      <OrderHistoryList
        initialHistory={[compactOrder]}
        initialNextCursor="next-page"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getByText("Jollibee")).toBeTruthy());
    expect(screen.getByText("KFC – Magsaysay")).toBeTruthy();
  });

  it("does not duplicate a page request during rapid clicks", async () => {
    let finishRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finishRequest = resolve;
        }),
    );
    render(
      <OrderHistoryList
        initialHistory={[compactOrder]}
        initialNextCursor="next-page"
      />,
    );

    const button = screen.getByRole("button", { name: "Load more" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    finishRequest?.(
      new Response(
        JSON.stringify({
          data: { active: [], history: [], nextCursor: null },
          ok: true,
        }),
        { status: 200 },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Loading…" })).toBeNull(),
    );
  });
});

it("shows the saved session total before expanding a history card", () => {
  render(
    <OrderHistoryList
      initialHistory={[{ ...compactOrder, sessionTotalCentavos: 98765 }]}
      initialNextCursor={null}
    />,
  );
  expect(screen.getByText("₱987.65")).toBeTruthy();
  expect(screen.getByText("Total")).toBeTruthy();
  expect(screen.queryByText("₱420.00")).toBeNull();
});
