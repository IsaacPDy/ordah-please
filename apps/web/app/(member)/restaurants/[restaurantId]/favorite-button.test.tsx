// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefresh, mockFetch } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.stubGlobal("fetch", mockFetch);

import { FavoriteButton } from "./favorite-button";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("FavoriteButton", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders unsaved state with an accessible label", () => {
    render(
      <FavoriteButton favoriteId={null} initiallyFavorited={false} menuItemId="item-1" />,
    );
    const button = screen.getByRole("button", {
      name: /save favorite meal/i,
    });
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("saves on click and refreshes server data", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(200, {
        data: { favoriteId: "favorite-9", rank: 1 },
      }),
    );
    render(
      <FavoriteButton favoriteId={null} initiallyFavorited={false} menuItemId="item-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save favorite meal/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/favorites",
        expect.objectContaining({
          body: JSON.stringify({ menuItemId: "item-1" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("removes on click when already saved", async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { data: { ok: true } }));
    render(
      <FavoriteButton
        favoriteId="favorite-9"
        initiallyFavorited={true}
        menuItemId="item-1"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /remove favorite meal/i }),
    );
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/favorites/favorite-9",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows the server's limit message on conflict and clears after 5 seconds", async () => {
    // Only the component's message timer is faked; findBy* is avoided because
    // waitFor's fake-timer branch loops on advanceTimersByTime and stalls here.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mockFetch.mockResolvedValue(
      jsonResponse(409, {
        error: {
          code: "CONFLICT",
          message: "You already have 3 favorites here — remove one first.",
        },
      }),
    );
    render(
      <FavoriteButton favoriteId={null} initiallyFavorited={false} menuItemId="item-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save favorite meal/i }));
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
    expect(screen.getByRole("status").textContent).toBe(
      "You already have 3 favorites here — remove one first.",
    );
    expect(mockRefresh).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the sign-in message when unauthenticated", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(401, {
        error: { code: "UNAUTHENTICATED", message: "Sign in is required." },
      }),
    );
    render(
      <FavoriteButton favoriteId={null} initiallyFavorited={false} menuItemId="item-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save favorite meal/i }));
    expect(
      await screen.findByRole("status"),
    ).toBeTruthy();
  });
});
