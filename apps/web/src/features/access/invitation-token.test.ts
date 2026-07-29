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

  it.each(["not-a-token", "invite.v1.wrong-deployment.random-value"])(
    "rejects malformed or wrong-deployment token %s with one safe error",
    (publicToken) => {
      expect(() =>
        hashInvitationToken(publicToken, "preview.ordah-please.test"),
      ).toThrow(
        new PublicApiError("INVALID_INPUT", "This invitation link is invalid."),
      );
    },
  );
});
