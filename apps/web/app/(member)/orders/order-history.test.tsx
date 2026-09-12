import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listOrderSummaries } = vi.hoisted(() => ({
  listOrderSummaries: vi.fn(),
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
  ordersRuntime: { listOrderSummaries },
}));

import OrdersPage from "./page";

describe("Orders History", () => {
  beforeEach(() => {
    listOrderSummaries.mockReset();
    listOrderSummaries.mockResolvedValue({
      active: [],
      history: [
        {
          completedAt: new Date("2026-09-10T16:30:00.000Z"),
          deadline: null,
          groupId: "group-1",
          groupName: "Friends",
          orderId: "order-1",
          participants: [
            {
              displayName: "Fiona Santos",
              foodResponse: "confirmed",
              itemCount: 2,
              subtotalCentavos: 42000,
              userId: "user-1",
            },
            {
              displayName: "Jamie Santos",
              foodResponse: "declined",
              itemCount: 0,
              subtotalCentavos: 0,
              userId: "user-2",
            },
            {
              displayName: "Mia Tan",
              foodResponse: "pending",
              itemCount: 0,
              subtotalCentavos: 0,
              userId: "user-3",
            },
          ],
          participantsTotal: 3,
          participantsVoted: 3,
          restaurantName: "KFC – Magsaysay",
          state: "ordered",
        },
      ],
    });
  });

  it("renders an expandable person-by-person order log", async () => {
    const html = renderToStaticMarkup(await OrdersPage());

    expect(html).toContain("Show order log for KFC – Magsaysay");
    expect(html).toContain("Fiona Santos");
    expect(html).toContain("2 items");
    expect(html).toContain("₱420.00");
    expect(html).toContain("Not eating");
    expect(html).toContain("No food selected");
    expect(html).toContain('href="/orders/order-1"');
    expect(html).toContain("View exact items");
    expect(html).toContain("Sep 11, 2026");
  });

  it("shows a safe retry message when orders cannot load", async () => {
    listOrderSummaries.mockRejectedValueOnce(
      new Error("database password leaked by mistake"),
    );

    const html = renderToStaticMarkup(await OrdersPage());

    expect(html).toContain(
      "Couldn&#x27;t load orders. Refresh this page to try again.",
    );
    expect(html).not.toContain("database password leaked by mistake");
  });
});
