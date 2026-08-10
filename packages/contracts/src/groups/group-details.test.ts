import { describe, expect, it } from "vitest";

import { parseGroupDetailsResponse } from "./group-details.js";

describe("parseGroupDetailsResponse", () => {
  it("accepts a complete payload including the invite link", () => {
    const payload = {
      groupId: "group-abc",
      name: "Friends",
      viewerRole: "group-owner",
      owner: { userId: "user-1", displayName: "Mia" },
      members: [
        { userId: "user-1", displayName: "Mia", role: "group-owner" },
        { userId: "user-2", displayName: "Leo", role: "member" },
      ],
      inviteLink: { publicValue: "abc12345_rest", tokenPrefix: "abc12345" },
    };

    expect(parseGroupDetailsResponse(payload)).toEqual(payload);
  });

  it("accepts a payload without the invite link section", () => {
    const payload = {
      groupId: "group-abc",
      name: "Friends",
      viewerRole: "member",
      owner: { userId: "user-1", displayName: "Mia" },
      members: [{ userId: "user-1", displayName: "Mia", role: "group-owner" }],
    };

    const parsed = parseGroupDetailsResponse(payload);
    expect(parsed.inviteLink).toBeUndefined();
  });

  it("rejects unknown role values", () => {
    const payload = {
      groupId: "group-abc",
      name: "Friends",
      viewerRole: "boss",
      owner: { userId: "user-1", displayName: "Mia" },
      members: [],
    };

    expect(() => parseGroupDetailsResponse(payload)).toThrow(/role/i);
  });

  it("rejects missing required fields", () => {
    expect(() => parseGroupDetailsResponse({ groupId: "group-abc" })).toThrow();
  });

  it("rejects unknown top-level fields", () => {
    const payload = {
      groupId: "group-abc",
      name: "Friends",
      viewerRole: "member",
      owner: { userId: "user-1", displayName: "Mia" },
      members: [],
      unexpected: true,
    };

    expect(() => parseGroupDetailsResponse(payload)).toThrow(/unknown field/i);
  });
});
