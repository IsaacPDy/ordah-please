import { describe, expect, it } from "vitest";

import {
  parseAcceptInvitationRequest,
  parseCreateAdminAccessRequest,
  parseIssueInvitationRequest,
  parseMemberActionRequest,
} from "./access-requests";

describe("access request contracts", () => {
  it("parses the exact invitation and member-action request shapes", () => {
    expect(
      parseIssueInvitationRequest({
        expiresAt: "2026-07-26T08:00:00.000Z",
      }),
    ).toEqual({ expiresAt: "2026-07-26T08:00:00.000Z" });
    expect(parseAcceptInvitationRequest({ token: "invite-token" })).toEqual({
      token: "invite-token",
    });
    expect(parseMemberActionRequest({ userId: "user-1" })).toEqual({
      userId: "user-1",
    });
    expect(parseCreateAdminAccessRequest({})).toEqual({});
  });

  it.each([
    () => parseIssueInvitationRequest({ expiresAt: "tomorrow" }),
    () => parseAcceptInvitationRequest({ token: "x", groupId: "group-1" }),
    () => parseMemberActionRequest({ userId: "" }),
    () => parseCreateAdminAccessRequest({ reason: "please" }),
  ])("rejects malformed or unknown access fields", (parse) => {
    expect(parse).toThrow(TypeError);
  });
});
