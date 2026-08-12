import { describe, expect, it } from "vitest";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../auth/load-app-identity";

const identity = {
  authUserId: "auth-user-1",
  displayName: "Avery",
  email: "avery@example.com",
  imageUrl: null,
  isPlatformAdmin: true,
  memberships: [
    { groupId: parseId<GroupId>("group-a"), role: "manager" },
    { groupId: parseId<GroupId>("group-b"), role: "member" },
  ],
  userId: parseId<UserId>("user-1"),
} as const satisfies AppIdentity;

type GroupAuthorizationModule = Readonly<{
  findGroupMembership?: (
    identity: AppIdentity,
    groupId: GroupId,
  ) => AppIdentity["memberships"][number] | undefined;
  requireGroupMembership?: (
    identity: AppIdentity,
    groupId: GroupId,
  ) => AppIdentity["memberships"][number];
  requireGroupRole?: (
    identity: AppIdentity,
    groupId: GroupId,
    allowedRoles: readonly AppIdentity["memberships"][number]["role"][],
  ) => AppIdentity["memberships"][number];
}>;

/** Loads the planned authorization module while keeping the first RED run executable. */
async function loadAuthorization(): Promise<GroupAuthorizationModule> {
  const modulePath: string = "./group-authorization.js";
  try {
    return (await import(modulePath)) as GroupAuthorizationModule;
  } catch {
    return {};
  }
}

describe("group authorization", () => {
  it("finds only the membership belonging to the requested group", async () => {
    const { findGroupMembership } = await loadAuthorization();
    expect(findGroupMembership).toBeTypeOf("function");

    expect(
      findGroupMembership?.(identity, parseId<GroupId>("group-a")),
    ).toEqual({
      groupId: "group-a",
      role: "manager",
    });
    expect(
      findGroupMembership?.(identity, parseId<GroupId>("group-c")),
    ).toBeUndefined();
  });

  it("rejects a role borrowed from another group", async () => {
    const { requireGroupRole } = await loadAuthorization();
    expect(requireGroupRole).toBeTypeOf("function");

    expect(() =>
      requireGroupRole?.(identity, parseId<GroupId>("group-b"), ["manager"]),
    ).toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "You do not have access to this action.",
      }),
    );
  });

  it("does not turn Platform Admin into a group Manager", async () => {
    const { requireGroupRole } = await loadAuthorization();
    expect(requireGroupRole).toBeTypeOf("function");

    expect(() =>
      requireGroupRole?.(identity, parseId<GroupId>("group-c"), ["manager"]),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("returns the membership when the viewer belongs to the requested group", async () => {
    const { requireGroupMembership } = await loadAuthorization();
    expect(requireGroupMembership).toBeTypeOf("function");

    expect(
      requireGroupMembership?.(identity, parseId<GroupId>("group-a")),
    ).toEqual({ groupId: "group-a", role: "manager" });
  });

  it("rejects when the viewer has no membership in the requested group", async () => {
    const { requireGroupMembership } = await loadAuthorization();
    expect(requireGroupMembership).toBeTypeOf("function");

    expect(() =>
      requireGroupMembership?.(identity, parseId<GroupId>("group-c")),
    ).toThrowError(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: "You do not have access to this action.",
      }),
    );
  });
});
