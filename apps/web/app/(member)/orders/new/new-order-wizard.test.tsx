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

  it("keeps selections when moving back and searches members without losing them", () => {
    render(<NewOrderWizard {...wizardProps()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Alex Rivera/i }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Mia" },
    });
    expect(screen.queryByText("Alex Rivera")).toBeNull();
    expect(screen.getByText("2 members selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(
      screen.getByRole("heading", { name: "Where should it go?" }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Where should it go?" }),
    );
    expect(screen.queryByRole("button", { name: "Start order" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: /Alex Rivera/i,
      }).checked,
    ).toBe(true);
  });

  it("blocks incomplete delivery details and does not submit on an earlier step", () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    const { container } = render(<NewOrderWizard {...wizardProps()} />);
    fireEvent.submit(container.querySelector("form")!);
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(
      screen.getByRole("button", { name: /Next/i }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows the manager as a required participant who cannot be toggled", () => {
    const html = renderToStaticMarkup(<NewOrderWizard {...wizardProps()} />);
    expect(html).toContain("Mia Tan");
    expect(html).toContain("Order manager (required)");
    expect(html).toContain(
      'disabled="" readOnly="" type="checkbox" checked=""',
    );
    expect(html).toContain("Alex Rivera");
    expect(html).toContain("You’ll be the order manager automatically.");
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

    fireEvent.click(screen.getByRole("button", { name: /Next/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
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
