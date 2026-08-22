// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
}));

import { NewOrderWizard } from "./new-order-wizard";

const members = [
  { displayName: "Mia Tan", role: "owner", userId: "user-1" },
  { displayName: "Alex Rivera", role: "member", userId: "user-2" },
] as const;

const restaurants = [
  {
    branchId: "branch-1",
    branchName: "Naga Plaza",
    restaurantId: "restaurant-1",
    restaurantName: "KFC",
  },
  {
    branchId: "branch-2",
    branchName: "Magsaysay",
    restaurantId: "restaurant-2",
    restaurantName: "McDonald's",
  },
] as const;

function wizardProps() {
  return {
    groupAddress: null,
    groupId: "group-1",
    groupName: "Alpha group",
    managerUserId: "user-1",
    members: [...members],
    restaurants: [...restaurants],
  };
}

describe("NewOrderWizard", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    mockPush.mockReset();
  });

  it("renders participants, restaurants, voting modes, and deadlines", () => {
    const html = renderToStaticMarkup(<NewOrderWizard {...wizardProps()} />);
    expect(html).toContain("Alex Rivera");
    expect(html).toContain("KFC");
    expect(html).toContain("McDonald&#x27;s");
    expect(html).toContain("Voting off");
    expect(html).toContain("Shortlist");
    expect(html).toContain("Whole catalog");
    expect(html).toContain("Start order");
    expect(html).toContain("Who’s joining?");
    expect(html).toContain("Where should it go?");
    expect(html).toContain("How do we choose?");
    expect(html).toContain('class="participant-option');
  });

  it("shows the manager as a required participant who cannot be toggled", () => {
    const html = renderToStaticMarkup(<NewOrderWizard {...wizardProps()} />);
    expect(html).toContain("Mia Tan");
    expect(html).toContain("Order manager · required");
    expect(html).toContain(
      'disabled="" readOnly="" type="checkbox" checked=""',
    );
    expect(html).toContain("Alex Rivera");
    expect(html).toContain(
      "You are included automatically as the order manager.",
    );
  });

  it("posts the expected body with voting off and null normalization", async () => {
    const mockFetch = vi.fn<
      (
        input: string,
        init: RequestInit & { body: string },
      ) => {
        ok: boolean;
        json: () => Promise<{ data: { orderId: string } }>;
      }
    >(() => ({
      ok: true,
      json: () => Promise.resolve({ data: { orderId: "order-9" } }),
    }));
    vi.stubGlobal("fetch", mockFetch);

    const { container } = render(<NewOrderWizard {...wizardProps()} />);

    fireEvent.change(screen.getByLabelText(/recipient name/i), {
      target: { value: "Mia Tan" },
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: "09171234567" },
    });
    fireEvent.change(screen.getByLabelText(/address line 1/i), {
      target: { value: "12 Sampaguita St" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "Quezon City" },
    });
    fireEvent.change(screen.getByLabelText(/^restaurant/i), {
      target: { value: "restaurant-1" },
    });
    fireEvent.change(screen.getByLabelText(/food picks end/i), {
      target: { value: "2026-09-01T12:00" },
    });

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/orders",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const init = mockFetch.mock.calls[0]![1];
    expect(JSON.parse(init.body)).toEqual({
      deliveryAddress: {
        city: "Quezon City",
        lineOne: "12 Sampaguita St",
        lineTwo: null,
        notes: null,
        phoneNumber: "09171234567",
        postalCode: null,
        recipientName: "Mia Tan",
      },
      foodDeadline: new Date("2026-09-01T12:00").toISOString(),
      groupId: "group-1",
      initialBranchId: "branch-1",
      initialRestaurantId: "restaurant-1",
      participantUserIds: [],
      restaurantDeadline: null,
      saveAsGroupDefault: false,
      shortlistRestaurantIds: [],
      votingMode: "voting_disabled",
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/orders/order-9");
    });
  });
});
