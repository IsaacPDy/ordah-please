import { describe, expect, it, vi } from "vitest";

import { listUsersForAdminWith } from "./users-runtime";

describe("listUsersForAdminWith", () => {
  it("resolves every membership name with one group query", async () => {
    const repositories = {
      groupAccess: {
        listGroupSummaries: vi.fn(() =>
          Promise.resolve([
            {
              archivedAt: null,
              id: "group-1",
              name: "Friends",
              ownerUserId: "user-1",
            },
            {
              archivedAt: null,
              id: "group-2",
              name: "Studio",
              ownerUserId: "user-3",
            },
          ]),
        ),
      },
      identityAccess: {
        listUsersWithSummary: vi.fn(() =>
          Promise.resolve([
            {
              archivedAt: null,
              displayName: "Fiona",
              email: "fiona@example.test",
              id: "user-1",
              imageUrl: null,
              isPlatformAdmin: true,
              memberships: [
                { groupId: "group-1", role: "owner" as const },
                { groupId: "group-2", role: "manager" as const },
              ],
            },
          ]),
        ),
      },
    };

    const result = await listUsersForAdminWith(repositories);

    expect(repositories.groupAccess.listGroupSummaries).toHaveBeenCalledTimes(1);
    expect(result[0]?.memberships).toStrictEqual([
      { groupId: "group-1", groupName: "Friends", role: "group-owner" },
      { groupId: "group-2", groupName: "Studio", role: "manager" },
    ]);
  });
});
