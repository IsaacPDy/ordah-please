import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";

import { hashInvitationToken, issueInvitationToken } from "./invitation-token";

describe("invitation token security", () => {
  it("issues an unpredictable deployment-bound token and returns only its hash for persistence", () => {
    const first = issueInvitationToken("preview.ordah-please.test");
    const second = issueInvitationToken("preview.ordah-please.test");

    expect(first.publicToken).not.toBe(second.publicToken);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).not.toHaveProperty("randomBytes");
    expect(first.tokenHash).toBe(
      createHash("sha256").update(first.publicToken).digest("hex"),
    );
    expect(
      hashInvitationToken(first.publicToken, "preview.ordah-please.test"),
    ).toBe(first.tokenHash);
  });

  it("rejects a malformed token with one safe error", () => {
    expect(() =>
      hashInvitationToken("not-a-token", "preview.ordah-please.test"),
    ).toThrow(
      new PublicApiError("INVALID_INPUT", "This invitation link is invalid."),
    );
  });

  it("rejects a structurally valid token issued for another deployment", () => {
    const token = issueInvitationToken("other.ordah-please.test").publicToken;

    expect(() =>
      hashInvitationToken(token, "preview.ordah-please.test"),
    ).toThrow(
      new PublicApiError("INVALID_INPUT", "This invitation link is invalid."),
    );
  });
});
