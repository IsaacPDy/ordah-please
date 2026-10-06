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
          selectedBranchId: "branch-1",
          selectedBranchName: null,
          selectedRestaurantId: null,
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
        viewerFavorites: [],
        lines: [],
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

const foodView = {
  lines: [
    {
      itemName: "Zinger Combo",
      lineSubtotalCentavos: 22500,
      note: "Extra gravy",
      quantity: 1,
      unitPriceCentavos: 22500,
      userId: "user-2",
    },
  ],
  order: {
    choiceMode: "voting_disabled",
    completedAt: null,
    createdAt: new Date("2026-01-01T08:00:00.000Z"),
    deliveryAddress: {
      city: "Naga",
      lineOne: "12 Sample Street",
      lineTwo: null,
      notes: null,
      phoneNumber: "+63 900 000 0000",
      postalCode: null,
      recipientName: "Mia Tan",
    },
    foodDeadline: new Date("2030-01-01T09:00:00.000Z"),
    groupId: "group-1",
    groupName: "Alpha group",
    initialBranchName: "Naga Plaza",
    initialRestaurantName: "Fallback Grill",
    orderId: "order-1",
    restaurantDeadline: new Date("2020-01-01T08:00:00.000Z"),
    restaurantName: "KFC",
    selectedBranchId: "branch-1",
    selectedBranchName: "Naga Plaza",
    selectedRestaurantId: "restaurant-1",
    state: "food_confirmation",
  },
  participants: [
    {
      displayName: "Mia Tan",
      foodResponse: "pending",
      restaurantResponse: "responded",
      role: "manager",
      userId: "user-1",
    },
    {
      displayName: "Alex Rivera",
      foodResponse: "confirmed",
      restaurantResponse: "pending",
      role: "member",
      userId: "user-2",
    },
  ],
  viewer: { canManage: true, kind: "participant" },
  viewerFavorites: [
    {
      available: true,
      description: "Burger, fries, and drink",
      favoriteId: "favorite-1",
      menuItemId: "menu-1",
      name: "Zinger Combo",
      priceCentavos: 22500,
      rank: 1,
    },
  ],
};

async function renderFoodPage(): Promise<string> {
  const page = await OrderDetailPage({
    params: Promise.resolve({ orderId: "order-1" }),
  });
  return renderToStaticMarkup(page);
}

describe("order detail food picking", () => {
  it("shows the manager the picker, banner, and participant checklist", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce(
      foodView as never,
    );
    const html = await renderFoodPage();
    expect(html).toContain("KFC favorites");
    expect(html).toContain("Your favorite picks");
    expect(html).toContain("Not eating");
    expect(html).toContain(
      "Top favorites stay visible until a participant confirms one meal.",
    );
    expect(html).toContain("Participants");
    expect(html).toContain("Ordered · 1 choice");
    expect(html).toContain("Picking…");
    expect(html).toContain("Voting closed ·");
    expect(html).toContain("Food picks end ·");
    expect(html).toContain("KFC – Naga Plaza");
  });

  it("marks a locked pending participant as Did not order anything", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce({
      ...foodView,
      order: {
        ...foodView.order,
        foodDeadline: new Date("2020-01-01T09:00:00.000Z"),
      },
    } as never);
    const html = await renderFoodPage();
    expect(html).toContain("Did not order anything");
    expect(html).not.toContain("Order this!");
  });

  it("shows a finish action for legacy sessions ready to finish", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce({
      ...foodView,
      order: { ...foodView.order, state: "ready_for_handoff" },
    } as never);
    const html = await renderFoodPage();
    expect(html).toContain(
      "This session is ready to finish. You can update its details afterward.",
    );
    expect(html).toContain("Ordered · 1 choice");
  });

  it("shows members the ordered count instead of the checklist", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce({
      ...foodView,
      viewer: { canManage: false, kind: "participant" },
    } as never);
    const html = await renderFoodPage();
    expect(html).toContain("1 of 2 ordered");
    expect(html).toContain("Your order summary");
    const summary = html
      .split('id="shared-order-summary"')[1]!
      .split("</aside>")[0]!;
    expect(summary).toContain("₱0.00");
    expect(summary).not.toContain("₱225.00");
    expect(html).not.toContain(
      "Top favorites stay visible until a participant confirms one meal.",
    );
  });

  it("shows the manager Finish order now during food picks", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce(
      foodView as never,
    );
    const html = await renderFoodPage();
    expect(html).toContain("Finish order now");
  });

  it("allows manual finishing before a restaurant is recorded", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce({
      ...foodView,
      order: {
        ...foodView.order,
        state: "draft",
        initialRestaurantName: null,
        initialBranchName: null,
        initialRestaurantId: null,
        selectedRestaurantId: null,
        restaurantName: null,
      },
    } as never);
    const html = await renderFoodPage();
    expect(html).toContain("Finish order now");
    expect(html).toContain("Restaurant pending");
    expect(html).not.toContain("View participants");
  });

  it("hides Finish order now from members", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce({
      ...foodView,
      viewer: { canManage: false, kind: "participant" },
    } as never);
    const html = await renderFoodPage();
    expect(html).not.toContain("Finish order now");
  });
});

describe("terminal order detail", () => {
  it("shows every authorized participant and exact saved line read-only", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce({
      ...foodView,
      lines: [
        {
          itemName: "Manager meal",
          lineSubtotalCentavos: 21000,
          note: "No onions",
          quantity: 1,
          unitPriceCentavos: 21000,
          userId: "user-1",
        },
        ...foodView.lines,
      ],
      order: {
        ...foodView.order,
        completedAt: new Date("2026-09-11T05:00:00.000Z"),
        state: "ordered",
      },
      participants: [
        { ...foodView.participants[0], foodResponse: "confirmed" },
        foodView.participants[1],
      ],
    } as never);

    const html = await renderFoodPage();

    expect(html).toContain("Order log");
    expect(html).toContain("Mia Tan");
    expect(html).toContain("Alex Rivera");
    expect(html).toContain("Manager meal");
    expect(html).toContain("Zinger Combo");
    expect(html).toContain("No onions");
    expect(html).toContain("Extra gravy");
    expect(html).toContain("₱225.00");
    expect(html).not.toContain("Your favorite picks");
    expect(html).not.toContain("Finish order now");
    expect(html).not.toContain("Cancel order");
  });

  it("renders only the Member row returned by the service", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce({
      ...foodView,
      lines: [
        {
          itemName: "Member meal",
          lineSubtotalCentavos: 18000,
          note: "",
          quantity: 1,
          unitPriceCentavos: 18000,
          userId: "user-1",
        },
      ],
      order: {
        ...foodView.order,
        completedAt: new Date("2026-09-11T05:00:00.000Z"),
        state: "ordered",
      },
      participants: [
        { ...foodView.participants[0], foodResponse: "confirmed" },
      ],
      viewer: { canManage: false, kind: "participant" },
      viewerFavorites: [],
    } as never);

    const html = await renderFoodPage();

    expect(html).toContain("Mia Tan");
    expect(html).toContain("Member meal");
    expect(html).not.toContain("Alex Rivera");
  });

  it("labels incomplete and declined cancelled participants literally", async () => {
    const { ordersRuntime } =
      await import("../../../../src/features/orders/orders-runtime");
    vi.mocked(ordersRuntime.loadOrderDetailView).mockResolvedValueOnce({
      ...foodView,
      lines: [],
      order: {
        ...foodView.order,
        completedAt: new Date("2026-09-11T05:00:00.000Z"),
        state: "cancelled",
      },
      participants: [
        { ...foodView.participants[0], foodResponse: "pending" },
        { ...foodView.participants[1], foodResponse: "declined" },
      ],
      viewerFavorites: [],
    } as never);

    const html = await renderFoodPage();

    expect(html).toContain("No food selected");
    expect(html).toContain("Not eating");
  });
});
