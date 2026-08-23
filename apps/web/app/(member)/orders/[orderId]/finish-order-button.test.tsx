// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import { FinishOrderButton } from "./finish-order-button";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FinishOrderButton", () => {
  it("finishes the order after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<FinishOrderButton orderId="order-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Finish order now" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/orders/order-1/finish",
        expect.objectContaining({
          body: JSON.stringify({}),
          method: "POST",
        }),
      );
    });
    expect(mockPush).toHaveBeenCalledWith("/orders");
  });

  it("does nothing when the manager cancels the confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<FinishOrderButton orderId="order-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Finish order now" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces the server error message", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: { code: "CONFLICT", message: "Only orders in food picks can be finished early." },
            }),
            { status: 409 },
          ),
        ),
      ),
    );
    render(<FinishOrderButton orderId="order-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Finish order now" }));
    await waitFor(() => {
      expect(
        screen.getByText("Only orders in food picks can be finished early."),
      ).toBeTruthy();
    });
  });
});
