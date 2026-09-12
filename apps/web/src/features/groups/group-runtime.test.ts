import { describe, expect, it, vi } from "vitest";

import {
  listAllGroupsForAdminWith,
  listViewerGroupSummariesWith,
} from "./group-runtime";

describe("listViewerGroupSummariesWith", () => {
  it("loads every membership with two batched repository reads", async () => {
    const groupAccess = {
      listActiveMembersForGroups: vi.fn(() =>
        Promise.resolve([
          {
            displayName: "Fiona",
            groupId: "group-1",
            role: "owner" as const,
            userId: "user-1",
          },
          {
            displayName: "Mia",
            groupId: "group-1",
            role: "member" as const,
            userId: "user-2",
          },
          {
            displayName: "Jamie",
            groupId: "group-2",
            role: "manager" as const,
            userId: "user-3",
          },
        ]),
      ),
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
            ownerUserId: "user-4",
          },
        ]),
      ),
    };

    const result = await listViewerGroupSummariesWith(groupAccess, [
      { groupId: "group-1", role: "group-owner" },
      { groupId: "group-2", role: "member" },
    ]);

    expect(groupAccess.listGroupSummaries).toHaveBeenCalledTimes(1);
    expect(groupAccess.listActiveMembersForGroups).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual([
      {
        groupId: "group-1",
        memberCount: 2,
        memberPreviews: [{ displayName: "Fiona" }, { displayName: "Mia" }],
        name: "Friends",
        role: "group-owner",
      },
      {
        groupId: "group-2",
        memberCount: 1,
        memberPreviews: [{ displayName: "Jamie" }],
        name: "Studio",
        role: "member",
      },
    ]);
  });
});

describe("listAllGroupsForAdminWith", () => {
  it("loads all group members with one batched repository read", async () => {
    const listAllGroups = vi.fn(() =>
      Promise.resolve([
        { id: "group-1", name: "Friends" },
        { id: "group-2", name: "Studio" },
      ]),
    );
    const groupAccess = {
      listActiveMembersForGroups: vi.fn(() =>
        Promise.resolve([
          {
            displayName: "Fiona",
            groupId: "group-1",
            role: "owner" as const,
            userId: "user-1",
          },
          {
            displayName: "Mia",
            groupId: "group-1",
            role: "member" as const,
            userId: "user-2",
          },
        ]),
      ),
    };
    const orders = {
      listActiveCountsForGroups: vi.fn(() =>
        Promise.resolve([{ activeOrderCount: 2, groupId: "group-1" }]),
      ),
    };

    const result = await listAllGroupsForAdminWith({
      groupAccess,
      listAllGroups,
      orders,
    });

    expect(listAllGroups).toHaveBeenCalledTimes(1);
    expect(groupAccess.listActiveMembersForGroups).toHaveBeenCalledTimes(1);
    expect(orders.listActiveCountsForGroups).toHaveBeenCalledWith([
      "group-1",
      "group-2",
    ]);
    expect(result).toStrictEqual([
      {
        activeOrderCount: 2,
        groupId: "group-1",
        memberCount: 2,
        name: "Friends",
        ownerDisplayName: "Fiona",
      },
      {
        activeOrderCount: 0,
        groupId: "group-2",
        memberCount: 0,
        name: "Studio",
        ownerDisplayName: null,
      },
    ]);
  });
});
