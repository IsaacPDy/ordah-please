import { describe, expect, it } from "vitest";

import { parseAppIdentitySummary } from "./identity-summary";

describe("parseAppIdentitySummary", () => {
  it("parses all group memberships and the account-wide admin state", () => {
    expect(
      parseAppIdentitySummary({
        displayName: "Mia Tan",
        email: "mia@example.com",
        imageUrl: null,
        isPlatformAdmin: true,
        memberships: [
          { groupId: "group-a", role: "group-owner" },
          { groupId: "group-b", role: "manager" },
        ],
        pendingAdminRequestCount: 2,
      }),
    ).toEqual({
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: null,
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
        displayName: "Mia Tan",
        email: "mia@example.com",
        imageUrl: null,
        isPlatformAdmin: false,
        memberships: [],
        pendingAdminRequestCount: 0,
      }),
    ).toEqual({
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [],
      pendingAdminRequestCount: 0,
    });
  });

  it.each([
    {
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [
        { groupId: "group-a", role: "member" },
        { groupId: "group-a", role: "manager" },
      ],
      pendingAdminRequestCount: 0,
    },
    {
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [{ groupId: "group-a", role: "organizer" }],
      pendingAdminRequestCount: 0,
    },
    {
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [],
      pendingAdminRequestCount: -1,
    },
    {
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [],
      pendingAdminRequestCount: 0,
      unexpected: true,
    },
  ])("rejects ambiguous or malformed identity responses", (value) => {
    expect(() => parseAppIdentitySummary(value)).toThrow(TypeError);
  });

  it("surfaces the auth user's profile fields on the identity summary", () => {
    expect(
      parseAppIdentitySummary({
        displayName: "Mia Tan",
        email: "mia@example.com",
        imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
        isPlatformAdmin: false,
        memberships: [],
        pendingAdminRequestCount: 0,
      }),
    ).toEqual({
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
      isPlatformAdmin: false,
      memberships: [],
      pendingAdminRequestCount: 0,
    });
  });

  it("accepts a null image url", () => {
    expect(
      parseAppIdentitySummary({
        displayName: "Mia Tan",
        email: "mia@example.com",
        imageUrl: null,
        isPlatformAdmin: false,
        memberships: [],
        pendingAdminRequestCount: 0,
      }).imageUrl,
    ).toBeNull();
  });
});
