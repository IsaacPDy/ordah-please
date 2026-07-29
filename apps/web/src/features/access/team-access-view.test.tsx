import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TeamAccessView } from "./team-access-view";

describe("TeamAccessView", () => {
  it("shows exact member roles and valid owner actions", () => {
    const markup = renderToStaticMarkup(
      <TeamAccessView
        actionsDisabled={false}
        members={[
          { displayName: "Owner", role: "owner", userId: "owner-1" },
          { displayName: "Organizer", role: "organizer", userId: "user-2" },
          { displayName: "Member", role: "member", userId: "user-3" },
        ]}
        onAction={() => undefined}
        onRequestAdmin={() => undefined}
      />,
    );

    expect(markup).toContain("Owner");
    expect(markup).toContain("Organizer");
    expect(markup).toContain("Member");
    expect(markup).toContain("Promote organizer");
    expect(markup).toContain("Demote to member");
    expect(markup).toContain("Remove member");
    expect(markup).toContain("Request platform-admin access");
  });

  it("disables every owner action while one mutation is pending", () => {
    const markup = renderToStaticMarkup(
      <TeamAccessView
        actionsDisabled
        members={[{ displayName: "Member", role: "member", userId: "user-1" }]}
        onAction={() => undefined}
        onRequestAdmin={() => undefined}
      />,
    );

    expect(markup.match(/disabled=""/gu)).toHaveLength(4);
  });
});
