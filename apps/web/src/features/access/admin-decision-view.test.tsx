import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AdminDecisionView } from "./admin-decision-view";

describe("AdminDecisionView", () => {
  it("shows an empty state when there are no pending requests", () => {
    const markup = renderToStaticMarkup(
      <AdminDecisionView
        actionsDisabled={false}
        busyRequestId={null}
        message={null}
        onDecide={() => undefined}
        onReasonChange={() => undefined}
        reasons={{}}
        requests={[]}
      />,
    );

    expect(markup).toContain("no pending platform-admin requests");
  });

  it("renders one card per pending request with approve, reject, and reason", () => {
    const markup = renderToStaticMarkup(
      <AdminDecisionView
        actionsDisabled={false}
        busyRequestId={null}
        message={null}
        onDecide={() => undefined}
        onReasonChange={() => undefined}
        reasons={{}}
        requests={[
          {
            id: "req-1",
            requesterDisplayName: "Owner Riley",
            groupName: "Riley Group",
            submittedAt: "2026-07-28",
          },
          {
            id: "req-2",
            requesterDisplayName: "Owner Sam",
            groupName: "Sam Group",
            submittedAt: "2026-07-29",
          },
        ]}
      />,
    );

    expect(markup).toContain("Owner Riley");
    expect(markup).toContain("Riley Group");
    expect(markup).toContain("Owner Sam");
    expect(markup).toContain("Sam Group");
    expect(markup).toContain("Reason (optional)");
    expect(markup.match(/Approve/gu)).toHaveLength(2);
    expect(markup.match(/Reject/gu)).toHaveLength(2);
  });

  it("reflects the active reason text in the matching card input", () => {
    const markup = renderToStaticMarkup(
      <AdminDecisionView
        actionsDisabled={false}
        busyRequestId={null}
        message={null}
        onDecide={() => undefined}
        onReasonChange={() => undefined}
        reasons={{ "req-1": "Promote after review." }}
        requests={[
          {
            id: "req-1",
            requesterDisplayName: "Owner Riley",
            groupName: "Riley Group",
            submittedAt: "2026-07-28",
          },
        ]}
      />,
    );

    expect(markup).toContain("Promote after review.");
  });

  it("disables the actions on the in-flight card only", () => {
    const markup = renderToStaticMarkup(
      <AdminDecisionView
        actionsDisabled={false}
        busyRequestId="req-1"
        message={null}
        onDecide={() => undefined}
        onReasonChange={() => undefined}
        reasons={{}}
        requests={[
          {
            id: "req-1",
            requesterDisplayName: "Owner Riley",
            groupName: "Riley Group",
            submittedAt: "2026-07-28",
          },
          {
            id: "req-2",
            requesterDisplayName: "Owner Sam",
            groupName: "Sam Group",
            submittedAt: "2026-07-29",
          },
        ]}
      />,
    );

    // The busy card has 2 disabled buttons, the other card has none.
    expect(markup.match(/disabled=""/gu)).toHaveLength(2);
  });

  it("disables every action while a global mutation lock is held", () => {
    const markup = renderToStaticMarkup(
      <AdminDecisionView
        actionsDisabled
        busyRequestId={null}
        message={null}
        onDecide={() => undefined}
        onReasonChange={() => undefined}
        reasons={{}}
        requests={[
          {
            id: "req-1",
            requesterDisplayName: "Owner Riley",
            groupName: "Riley Group",
            submittedAt: "2026-07-28",
          },
        ]}
      />,
    );

    expect(markup.match(/disabled=""/gu)).toHaveLength(2);
  });

  it("surfaces a safe status message when provided", () => {
    const onDecide = vi.fn();
    const markup = renderToStaticMarkup(
      <AdminDecisionView
        actionsDisabled={false}
        busyRequestId={null}
        message="The approve action could not be completed."
        onDecide={onDecide}
        onReasonChange={() => undefined}
        reasons={{}}
        requests={[
          {
            id: "req-1",
            requesterDisplayName: "Owner Riley",
            groupName: "Riley Group",
            submittedAt: "2026-07-28",
          },
        ]}
      />,
    );

    expect(markup).toContain("The approve action could not be completed.");
  });
});
