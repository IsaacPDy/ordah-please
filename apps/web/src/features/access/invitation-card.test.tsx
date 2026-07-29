import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InvitationCard } from "./invitation-card";

describe("InvitationCard", () => {
  it("shows Google sign-in without exposing acceptance when signed out", () => {
    const markup = renderToStaticMarkup(
      <InvitationCard isSignedIn={false} status="idle" />,
    );

    expect(markup).toContain("Sign in with Google to continue");
    expect(markup).toContain("Sign in with Google");
    expect(markup).not.toContain("Join group");
  });

  it("explains membership versus order participation before joining", () => {
    const markup = renderToStaticMarkup(
      <InvitationCard isSignedIn status="idle" />,
    );

    expect(markup).toContain(
      "Joining the group does not add you to any food order.",
    );
    expect(markup).toContain("Join group");
  });

  it("shows a safe error when Google sign-in fails", () => {
    const markup = renderToStaticMarkup(
      <InvitationCard isSignedIn={false} status="error" />,
    );

    expect(markup).toContain("Sign-in or invitation acceptance failed.");
  });
});
