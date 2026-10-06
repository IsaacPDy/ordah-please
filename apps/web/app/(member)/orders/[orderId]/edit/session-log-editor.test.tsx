// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/require-await */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SessionLogEditor } from "./session-log-editor";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
const initial = {
  groupId: "group",
  state: "ordered" as const,
  restaurantId: null,
  createdAt: "2026-10-06T04:00:00Z",
  completedAt: "2026-10-06T05:00:00Z",
  managerUserId: "owner",
  deliveryAddress: null,
  participants: [
    {
      userId: "owner",
      displayName: "Owner",
      foodResponse: "pending" as const,
      lines: [],
    },
  ],
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
});
describe("session log editor", () => {
  it("saves finished history without a restaurant and edits participant names", async () => {
    const fetch = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toBe("/api/orders/session/log");
      expect(options.method).toBe("PATCH");
      return { ok: true, json: async () => ({ data: { orderId: "session" } }) };
    });
    vi.stubGlobal("fetch", fetch);
    render(
      <SessionLogEditor
        orderId="session"
        initial={initial}
        members={[]}
        restaurants={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Participant name"), {
      target: { value: "Corrected owner" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const rawBody = fetch.mock.calls[0]?.[1].body;
    if (typeof rawBody !== "string") throw new Error("Expected a JSON body");
    const body = JSON.parse(rawBody) as typeof initial;
    expect(body.restaurantId).toBeNull();
    expect(body.state).toBe("ordered");
    expect(body.participants[0]?.displayName).toBe("Corrected owner");
  });
  it("requires explicit confirmation for permanent deletion", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetch);
    render(
      <SessionLogEditor
        orderId="session"
        initial={initial}
        members={[]}
        restaurants={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep session" }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete session" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/orders/session/log",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ confirmed: true }),
        }),
      ),
    );
  });
});
