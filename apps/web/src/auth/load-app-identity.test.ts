import { describe, expect, it } from "vitest";

import { loadAppIdentity } from "./load-app-identity";

describe("loadAppIdentity", () => {
  it("rejects an authenticated Clerk user without an internal identity", async () => {
    const repository = {
      findUserByClerkId: () => Promise.resolve(undefined),
      listActiveMemberships: () => Promise.resolve([]),
    };

    await expect(
      loadAppIdentity("user_not_synced", repository),
    ).rejects.toMatchObject({
      code: "UNAVAILABLE",
      message: "Your account is not ready yet.",
    });
  });

  it("maps the active Neon membership and platform-admin flag into app roles", async () => {
    const timestamp = new Date("2026-07-23T05:00:00.000Z");
    const repository = {
      findUserByClerkId: (clerkUserId: string) =>
        Promise.resolve({
          archivedAt: null,
          clerkUserId,
          createdAt: timestamp,
          displayName: "Avery",
          id: "internal-user-1",
          isPlatformAdmin: true,
          updatedAt: timestamp,
        }),
      listActiveMemberships: () =>
        Promise.resolve([
          {
            groupId: "group-1",
            joinedAt: timestamp,
            removedAt: null,
            role: "organizer" as const,
            userId: "internal-user-1",
          },
        ]),
    };

    await expect(
      loadAppIdentity("user_clerk_123", repository),
    ).resolves.toEqual({
      clerkUserId: "user_clerk_123",
      groupId: "group-1",
      roles: ["organizer", "platform-admin"],
      userId: "internal-user-1",
    });
  });
});
