import { describe, expect, it, vi } from "vitest";

import { signInForInvitation } from "./invitation-onboarding";

describe("signInForInvitation", () => {
  it("starts Better Auth Google sign-in with the encoded invitation return path", async () => {
    const signIn = vi.fn(() => Promise.resolve());

    await signInForInvitation("invite.v1/preview token", signIn);

    expect(signIn).toHaveBeenCalledWith({
      callbackURL: "/invite/invite.v1%2Fpreview%20token",
      provider: "google",
    });
  });
});
