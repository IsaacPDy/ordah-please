import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parseId, type UserId } from "@ordah-please/domain";

import { AdminPageAccessView, MemberPageAccessView } from "./page-access-view";

const baseIdentity = {
  authUserId: "auth-user-1",
  isPlatformAdmin: false,
  memberships: [],
  userId: parseId<UserId>("user-1"),
} as const;

describe("page access views", () => {
  it("shows Google sign-in instead of a member shell when unauthenticated", () => {
    const markup = renderToStaticMarkup(
      <MemberPageAccessView result={{ status: "unauthenticated" }}>
        <nav>Member navigation</nav>
      </MemberPageAccessView>,
    );

    expect(markup).toContain("Sign in with Google");
    expect(markup).not.toContain("Member navigation");
  });

  it("renders a member shell for a signed-in account with no memberships", () => {
    const markup = renderToStaticMarkup(
      <MemberPageAccessView
        result={{ identity: baseIdentity, status: "authenticated" }}
      >
        <nav>Member navigation</nav>
      </MemberPageAccessView>,
    );

    expect(markup).toContain("Member navigation");
  });

  it("hides the whole admin shell from a signed-in non-admin", () => {
    const markup = renderToStaticMarkup(
      <AdminPageAccessView
        result={{ identity: baseIdentity, status: "authenticated" }}
      >
        <nav>Admin navigation</nav>
      </AdminPageAccessView>,
    );

    expect(markup).toContain(
      "Only platform admins can open the admin workspace",
    );
    expect(markup).not.toContain("Admin navigation");
  });

  it("renders the admin shell for a Platform Admin", () => {
    const markup = renderToStaticMarkup(
      <AdminPageAccessView
        result={{
          identity: { ...baseIdentity, isPlatformAdmin: true },
          status: "authenticated",
        }}
      >
        <nav>Admin navigation</nav>
      </AdminPageAccessView>,
    );

    expect(markup).toContain("Admin navigation");
  });
});
