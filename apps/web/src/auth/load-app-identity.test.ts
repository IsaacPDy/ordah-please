import { describe, expect, it } from "vitest";

import { loadAppIdentity } from "./load-app-identity";

const AUTH_USER_ID = "10000000-0000-4000-8000-000000000001";

describe("loadAppIdentity", () => {
  it("provisions a groupless product user on the first authenticated request", async () => {
    const timestamp = new Date("2026-07-29T04:00:00.000Z");
    const repository = {
      ensureUserForAuthIdentity: () =>
        Promise.resolve({
          archivedAt: null,
          authUserId: AUTH_USER_ID,
          createdAt: timestamp,
          displayName: "Avery",
          id: "internal-user-1",
          isPlatformAdmin: false,
          updatedAt: timestamp,
        }),
      listActiveMemberships: () => Promise.resolve([]),
    };

    await expect(
      loadAppIdentity(
        { authUserId: AUTH_USER_ID, displayName: "Avery" },
        repository,
      ),
    ).resolves.toEqual({
      authUserId: AUTH_USER_ID,
      isPlatformAdmin: false,
      memberships: [],
      userId: "internal-user-1",
    });
  });

  it("rejects an archived product identity even when its auth session is valid", async () => {
    const timestamp = new Date("2026-07-29T04:00:00.000Z");
    const repository = {
      ensureUserForAuthIdentity: () =>
        Promise.resolve({
          archivedAt: timestamp,
          authUserId: AUTH_USER_ID,
          createdAt: timestamp,
          displayName: "Archived member",
          id: "internal-user-1",
          isPlatformAdmin: false,
          updatedAt: timestamp,
        }),
      listActiveMemberships: () => Promise.resolve([]),
    };

    await expect(
      loadAppIdentity(
        { authUserId: AUTH_USER_ID, displayName: "Archived member" },
        repository,
      ),
    ).rejects.toMatchObject({
      code: "UNAVAILABLE",
      message: "Your account is not available.",
    });
  });

  it("maps every active Neon membership and the platform-admin flag", async () => {
    const timestamp = new Date("2026-07-29T05:00:00.000Z");
    const repository = {
      ensureUserForAuthIdentity: (input: {
        readonly authUserId: string;
        readonly displayName: string;
      }) =>
        Promise.resolve({
          archivedAt: null,
          authUserId: input.authUserId,
          createdAt: timestamp,
          displayName: input.displayName,
          id: "internal-user-1",
          isPlatformAdmin: true,
          updatedAt: timestamp,
        }),
      listActiveMemberships: () =>
        Promise.resolve([
          {
            groupId: "group-2",
            joinedAt: timestamp,
            removedAt: null,
            role: "member" as const,
            userId: "internal-user-1",
          },
          {
            groupId: "group-1",
            joinedAt: timestamp,
            removedAt: null,
            role: "manager" as const,
            userId: "internal-user-1",
          },
        ]),
    };

    await expect(
      loadAppIdentity(
        { authUserId: AUTH_USER_ID, displayName: "Avery" },
        repository,
      ),
    ).resolves.toEqual({
      authUserId: AUTH_USER_ID,
      isPlatformAdmin: true,
      memberships: [
        { groupId: "group-1", role: "manager" },
        { groupId: "group-2", role: "member" },
      ],
      userId: "internal-user-1",
    });
  });
});
