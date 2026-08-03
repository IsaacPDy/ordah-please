import { describe, expect, it } from "vitest";

import { parseAppIdentitySummary } from "./identity-summary";

describe("parseAppIdentitySummary", () => {
  it("parses all group memberships and the account-wide admin state", () => {
    expect(
      parseAppIdentitySummary({
        isPlatformAdmin: true,
        memberships: [
          { groupId: "group-a", role: "group-owner" },
          { groupId: "group-b", role: "manager" },
        ],
        pendingAdminRequestCount: 2,
      }),
    ).toEqual({
      isPlatformAdmin: true,
      memberships: [
        { groupId: "group-a", role: "group-owner" },
        { groupId: "group-b", role: "manager" },
      ],
      pendingAdminRequestCount: 2,
    });
  });

  it("accepts an authenticated account with no group memberships", () => {
    expect(
      parseAppIdentitySummary({
        isPlatformAdmin: false,
        memberships: [],
        pendingAdminRequestCount: 0,
      }),
    ).toEqual({
      isPlatformAdmin: false,
      memberships: [],
      pendingAdminRequestCount: 0,
    });
  });

  it.each([
    {
      isPlatformAdmin: false,
      memberships: [
        { groupId: "group-a", role: "member" },
        { groupId: "group-a", role: "manager" },
      ],
      pendingAdminRequestCount: 0,
    },
    {
      isPlatformAdmin: false,
      memberships: [{ groupId: "group-a", role: "organizer" }],
      pendingAdminRequestCount: 0,
    },
    {
      isPlatformAdmin: false,
      memberships: [],
      pendingAdminRequestCount: -1,
    },
    {
      isPlatformAdmin: false,
      memberships: [],
      pendingAdminRequestCount: 0,
      unexpected: true,
    },
  ])("rejects ambiguous or malformed identity responses", (value) => {
    expect(() => parseAppIdentitySummary(value)).toThrow(TypeError);
  });
});
