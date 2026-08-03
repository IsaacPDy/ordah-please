import { describe, expect, it } from "vitest";

import {
  parseAcceptInvitationRequest,
  parseCreateAdminAccessRequest,
  parseDecideAdminAccessRequestRequest,
  parseIssueInvitationRequest,
  parseListPendingAdminAccessRequestsResponse,
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

describe("parseDecideAdminAccessRequestRequest", () => {
  it("accepts a valid approve decision without a reason", () => {
    const parsed = parseDecideAdminAccessRequestRequest({
      requestId: "req_abc123",
      decision: "approved",
    });
    expect(parsed).toEqual({ requestId: "req_abc123", decision: "approved" });
  });

  it("accepts a valid reject decision with a reason", () => {
    const parsed = parseDecideAdminAccessRequestRequest({
      requestId: "req_abc123",
      decision: "rejected",
      reason: "  Wait until next quarter.  ",
    });
    expect(parsed).toEqual({
      requestId: "req_abc123",
      decision: "rejected",
      reason: "Wait until next quarter.",
    });
  });

  it("rejects an unknown decision value", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({
        requestId: "req_abc123",
        decision: "maybe",
      }),
    ).toThrow();
  });

  it("rejects a missing requestId", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({ decision: "approved" }),
    ).toThrow();
  });

  it("rejects a reason longer than 500 characters", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({
        requestId: "req_abc123",
        decision: "approved",
        reason: "x".repeat(501),
      }),
    ).toThrow();
  });

  it("rejects an empty reason string", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({
        requestId: "req_abc123",
        decision: "approved",
        reason: "   ",
      }),
    ).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({
        requestId: "req_abc123",
        decision: "approved",
        evil: true,
      }),
    ).toThrow();
  });
});

describe("parseListPendingAdminAccessRequestsResponse", () => {
  it("accepts a response with zero requests", () => {
    expect(
      parseListPendingAdminAccessRequestsResponse({ requests: [] }),
    ).toEqual({
      requests: [],
    });
  });

  it("accepts a response with one pending request", () => {
    const parsed = parseListPendingAdminAccessRequestsResponse({
      requests: [
        {
          id: "req_abc123",
          requesterUserId: "usr_1",
          requesterDisplayName: "Owner One",
          groupId: "grp_1",
          groupName: "Group One",
          status: "pending",
          createdAt: "2026-07-29T10:00:00.000Z",
        },
      ],
    });
    expect(parsed.requests).toHaveLength(1);
    expect(parsed.requests[0]?.id).toBe("req_abc123");
  });

  it("rejects a request row missing displayName", () => {
    expect(() =>
      parseListPendingAdminAccessRequestsResponse({
        requests: [
          {
            id: "req_1",
            requesterUserId: "usr_1",
            groupId: "grp_1",
            groupName: "G",
            status: "pending",
            createdAt: "2026-07-29T10:00:00.000Z",
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects a non-pending status in the list", () => {
    expect(() =>
      parseListPendingAdminAccessRequestsResponse({
        requests: [
          {
            id: "req_1",
            requesterUserId: "usr_1",
            requesterDisplayName: "X",
            groupId: "grp_1",
            groupName: "G",
            status: "approved",
            createdAt: "2026-07-29T10:00:00.000Z",
          },
        ],
      }),
    ).toThrow();
  });
});
