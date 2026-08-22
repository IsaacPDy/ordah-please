import { PublicApiError } from "@ordah-please/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/auth/load-server-page-identity", () => ({
  getCurrentServerPageIdentity: () =>
    Promise.resolve({
      identity: {
        authUserId: "auth-1",
        displayName: "Mia Tan",
        email: "mia@example.com",
        imageUrl: null,
        isPlatformAdmin: false,
        memberships: [{ groupId: "group-1", role: "manager" }],
        userId: "user-1",
      },
      status: "authenticated",
    }),
}));

vi.mock("../../../../src/features/orders/orders-runtime", () => ({
  ordersRuntime: {
    loadOrderDetailView: vi.fn(() =>
      Promise.resolve({
        order: {
          choiceMode: "shortlist",
          completedAt: null,
          createdAt: new Date("2026-08-18T08:00:00.000Z"),
          deliveryAddress: {
            city: "Naga",
            lineOne: "12 Sample Street",
            lineTwo: null,
            notes: null,
            phoneNumber: "+63 900 000 0000",
            postalCode: null,
            recipientName: "Mia Tan",
          },
          foodDeadline: new Date("2026-08-20T09:00:00.000Z"),
          groupId: "group-1",
          groupName: "Alpha group",
          initialBranchName: "Main Branch",
          initialRestaurantName: "Fallback Grill",
          orderId: "order-1",
          restaurantDeadline: new Date("2026-08-20T03:30:00.000Z"),
          restaurantName: null,
          state: "restaurant_voting",
        },
        participants: [
          {
            displayName: "Mia Tan",
            foodResponse: "pending",
            restaurantResponse: "responded",
            role: "manager",
            userId: "user-1",
          },
        ],
        viewer: { canManage: true, kind: "participant" },
      }),
    ),
  },
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("Not found"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import OrderDetailPage from "./page";

describe("order detail page", () => {
  it("renders the state, deadlines, address, and participants", async () => {
    const page = await OrderDetailPage({
      params: Promise.resolve({ orderId: "order-1" }),
    });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Alpha group");
    expect(html).toContain("Voting");
    expect(html).toContain("Fallback Grill");
    expect(html).toContain("12 Sample Street, Naga");
    expect(html).toContain("Mia Tan");
    expect(html).toContain("Cancel order");
    expect(html).not.toContain('href="/orders"');
  });

  it("maps a FORBIDDEN order view to notFound instead of an error page", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockRejectedValueOnce(
      new PublicApiError("FORBIDDEN", "You do not have access to this action."),
    );

    const page = OrderDetailPage({
      params: Promise.resolve({ orderId: "order-1" }),
    });
    await expect(page).rejects.not.toBeInstanceOf(PublicApiError);
    await expect(page).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
