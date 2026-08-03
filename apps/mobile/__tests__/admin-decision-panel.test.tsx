import { render, waitFor } from "@testing-library/react-native";
import React from "react";

import { AdminDecisionPanel } from "../src/features/access/admin-decision-panel";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdminDecisionPanel", () => {
  it("renders a forbidden state when the caller is not a platform admin", async () => {
    const request = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockResolvedValue(jsonResponse({ ok: false }, 403));

    const screen = await render(
      <AdminDecisionPanel
        apiBaseUrl="https://preview.ordah-please.test"
        cookie="ordah-please.session_token=opaque"
        request={request}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/only platform admins can review access requests/i),
      ).toBeTruthy(),
    );
  });

  it("renders an empty state when no pending requests exist", async () => {
    const request = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockResolvedValue(
        jsonResponse({ ok: true, data: { requests: [] } }, 200),
      );

    const screen = await render(
      <AdminDecisionPanel
        apiBaseUrl="https://preview.ordah-please.test"
        cookie="ordah-please.session_token=opaque"
        request={request}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/no pending platform-admin requests/i),
      ).toBeTruthy(),
    );
  });

  it("renders one card per pending request", async () => {
    const request = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockResolvedValue(
        jsonResponse(
          {
            ok: true,
            data: {
              requests: [
                {
                  id: "req-1",
                  requesterUserId: "usr-1",
                  requesterDisplayName: "Owner Riley",
                  groupId: "grp-1",
                  groupName: "Riley Group",
                  status: "pending",
                  createdAt: "2026-07-28T08:00:00.000Z",
                },
              ],
            },
          },
          200,
        ),
      );

    const screen = await render(
      <AdminDecisionPanel
        apiBaseUrl="https://preview.ordah-please.test"
        cookie="ordah-please.session_token=opaque"
        request={request}
      />,
    );

    await waitFor(() => expect(screen.getByText("Owner Riley")).toBeTruthy());
    expect(screen.getByText("Riley Group")).toBeTruthy();
    expect(screen.getByText("Approve")).toBeTruthy();
    expect(screen.getByText("Reject")).toBeTruthy();
  });

  it("renders a retry button when the initial load fails", async () => {
    const request = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockResolvedValue(jsonResponse({ ok: false }, 500));

    const screen = await render(
      <AdminDecisionPanel
        apiBaseUrl="https://preview.ordah-please.test"
        cookie="ordah-please.session_token=opaque"
        request={request}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/admin requests could not be loaded/i),
      ).toBeTruthy(),
    );
    expect(screen.getByText("Try again")).toBeTruthy();
  });
});
