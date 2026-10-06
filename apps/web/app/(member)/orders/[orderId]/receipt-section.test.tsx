/* eslint-disable @typescript-eslint/require-await */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ReceiptSection } from "./receipt-section";
import type { ReceiptView } from "../../../../src/features/orders/receipt-service";
const view: ReceiptView = {
  sessionTotalCentavos: null,
  canSetSessionTotal: true,
  enabled: true,
  mode: "group",
  submitterIds: [],
  canManage: true,
  canSubmit: true,
  userId: "owner",
  participants: [{ userId: "person", displayName: "Person" }],
  receipts: [],
};
function fetchView(data = view) {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data }) }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("session receipt controls", () => {
  it("lets the owner change modes and select submitters", async () => {
    const fetch = fetchView();
    render(<ReceiptSection orderId="session" />);
    await screen.findByRole("combobox", { name: "Receipt mode" });
    fireEvent.change(screen.getByLabelText("Receipt mode"), {
      target: { value: "individual" },
    });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/orders/session/receipts",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            enabled: true,
            mode: "individual",
            submitterIds: [],
          }),
        }),
      ),
    );
    fireEvent.click(screen.getByLabelText("Person"));
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          (call) =>
            (call as unknown as [string, RequestInit])[1]?.body ===
            JSON.stringify({
              enabled: true,
              mode: "group",
              submitterIds: ["person"],
            }),
        ),
      ).toBe(true),
    );
  });
  it("keeps saved receipts visible while disabling submission", async () => {
    fetchView({
      ...view,
      enabled: false,
      canManage: false,
      canSubmit: false,
      receipts: [
        {
          id: "receipt",
          mode: "group",
          participantUserId: null,
          participantName: null,
          submitterName: "Owner",
          amountCentavos: 12500,
          note: "Lunch",
          contentType: "application/pdf",
          createdAt: "2026-10-06T00:00:00Z",
          canEdit: false,
        },
      ],
    });
    render(<ReceiptSection orderId="session" />);
    await screen.findByText("Lunch");
    expect(screen.queryByLabelText("Receipt file")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Open PDF receipt" })
        .getAttribute("href"),
    ).toBe("/api/orders/session/receipts/receipt/file");
  });
  it("requires confirmation before receipt removal", async () => {
    const fetch = fetchView({
      ...view,
      receipts: [
        {
          id: "receipt",
          mode: "group",
          participantUserId: null,
          participantName: null,
          submitterName: "Owner",
          amountCentavos: 12500,
          note: "Lunch",
          contentType: "application/pdf",
          createdAt: "2026-10-06T00:00:00Z",
          canEdit: true,
        },
      ],
    });
    render(<ReceiptSection orderId="session" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove receipt" }),
    );
    expect(fetch.mock.calls.length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/orders/session/receipts/receipt",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ confirmed: true }),
        }),
      ),
    );
  });
  it("reports load errors with a retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: { message: "Unavailable" } }),
      })),
    );
    render(<ReceiptSection orderId="session" />);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Unavailable",
    );
    expect(screen.getByRole("button", { name: "Retry receipts" })).toBeTruthy();
  });
});

it("lets managers save a separate total without receipt settings", async () => {
  const fetch = fetchView({
    ...view,
    canManage: false,
    canSubmit: false,
    enabled: false,
  });
  render(<ReceiptSection orderId="session" />);
  fireEvent.change(await screen.findByLabelText("Session total (PHP)"), {
    target: { value: "456.78" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save session total" }));
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/orders/session/receipts/total",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ sessionTotalCentavos: 45678 }),
      }),
    ),
  );
  expect(screen.queryByRole("switch")).toBeNull();
});
