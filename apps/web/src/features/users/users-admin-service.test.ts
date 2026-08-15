import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import {
  addUserToGroupAsAdmin,
  removeUserFromGroupAsAdmin,
  suspendUserAsAdmin,
  type UsersAdminRepositories,
  type UsersAdminTransactionRunner,
} from "./users-admin-service";

const ARCHIVED_AT = new Date("2026-08-13T12:00:00.000Z");

function adminUser() {
  return { id: "admin-1", isPlatformAdmin: true, archivedAt: null };
}

function regularUser() {
  return { id: "user-actor", isPlatformAdmin: false, archivedAt: null };
}

function suspendedUser() {
  return { id: "user-2", isPlatformAdmin: false, archivedAt: ARCHIVED_AT };
}

function activeGroupRow() {
  return {
    archivedAt: null as Date | null,
    id: "group-1",
    name: "Phoenix",
    ownerUserId: "other-1" as string | null,
  };
}

type AddMembershipFn = UsersAdminRepositories["identityAccess"]["addMembership"];
type RemoveMembershipFn = UsersAdminRepositories["groupAccess"]["removeMembership"];
type ArchiveUserFn = UsersAdminRepositories["identityAccess"]["archiveUser"];
type AppendAuditFn = UsersAdminRepositories["auditEvents"]["append"];

function makeRepos(overrides: {
  readonly actor?: { readonly id: string; readonly isPlatformAdmin: boolean; readonly archivedAt: Date | null } | undefined;
  readonly target?: { readonly id: string; readonly isPlatformAdmin: boolean; readonly archivedAt: Date | null } | undefined;
  readonly group?: {
    readonly archivedAt: Date | null;
    readonly id: string;
    readonly name: string;
    readonly ownerUserId: string | null;
  } | undefined;
  readonly addMembership?: AddMembershipFn;
  readonly removeMembership?: RemoveMembershipFn;
  readonly archiveUser?: ArchiveUserFn;
  readonly append?: AppendAuditFn;
} = {}): UsersAdminRepositories {
  return {
    identityAccess: {
      findUserById: vi.fn((id: string) =>
        Promise.resolve(
          id === "admin-1"
            ? ("actor" in overrides ? overrides.actor : adminUser())
            : id === "user-2"
              ? ("target" in overrides ? overrides.target : regularUser())
              : undefined,
        ),
      ),
      addMembership:
        overrides.addMembership ??
        vi.fn(() => Promise.resolve({ userId: "user-2" })),
      archiveUser:
        overrides.archiveUser ?? vi.fn(() => Promise.resolve(true)),
    },
    groupAccess: {
      findGroupSummary: vi.fn(() =>
        Promise.resolve(
          "group" in overrides ? overrides.group : activeGroupRow(),
        ),
      ),
      removeMembership:
        overrides.removeMembership ?? vi.fn(() => Promise.resolve(true)),
    },
    auditEvents: {
      append:
        overrides.append ?? vi.fn(() => Promise.resolve({ id: "audit-1" })),
    },
  };
}

function makeRunner(
  repos: UsersAdminRepositories,
): UsersAdminTransactionRunner {
  return { run: (operation) => operation(repos) };
}

async function expectPublicError(
  run: () => Promise<unknown>,
  code: string,
  message: string,
): Promise<void> {
  let caught: unknown;
  try {
    await run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PublicApiError);
  expect(caught).toMatchObject({ code, message });
}

describe("addUserToGroupAsAdmin", () => {
  const command = {
    actorUserId: parseId<UserId>("admin-1"),
    groupId: parseId<GroupId>("group-1"),
    userId: parseId<UserId>("user-2"),
  };

  it("throws FORBIDDEN when the actor is not a Platform Admin", async () => {
    const repos = makeRepos({ actor: regularUser() });
    await expectPublicError(
      () => addUserToGroupAsAdmin(command, makeRunner(repos)),
      "FORBIDDEN",
      "Access denied.",
    );
    expect(repos.identityAccess.addMembership).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when the actor does not exist", async () => {
    const repos = makeRepos({ actor: undefined });
    await expectPublicError(
      () => addUserToGroupAsAdmin(command, makeRunner(repos)),
      "FORBIDDEN",
      "Access denied.",
    );
  });

  it("throws NOT_FOUND when the group does not exist", async () => {
    const repos = makeRepos({ group: undefined });
    await expectPublicError(
      () => addUserToGroupAsAdmin(command, makeRunner(repos)),
      "NOT_FOUND",
      "Group not found.",
    );
  });

  it("throws CONFLICT when the group is archived", async () => {
    const repos = makeRepos({
      group: { ...activeGroupRow(), archivedAt: ARCHIVED_AT },
    });
    await expectPublicError(
      () => addUserToGroupAsAdmin(command, makeRunner(repos)),
      "CONFLICT",
      "Group is archived.",
    );
    expect(repos.identityAccess.addMembership).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the target user does not exist", async () => {
    const repos = makeRepos({ target: undefined });
    await expectPublicError(
      () => addUserToGroupAsAdmin(command, makeRunner(repos)),
      "NOT_FOUND",
      "User not found.",
    );
  });

  it("throws CONFLICT when the target user is suspended", async () => {
    const repos = makeRepos({ target: suspendedUser() });
    await expectPublicError(
      () => addUserToGroupAsAdmin(command, makeRunner(repos)),
      "CONFLICT",
      "User is suspended.",
    );
    expect(repos.identityAccess.addMembership).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when the user is already a member", async () => {
    const repos = makeRepos({
      addMembership: vi.fn(() => Promise.resolve(undefined)),
    });
    await expectPublicError(
      () => addUserToGroupAsAdmin(command, makeRunner(repos)),
      "CONFLICT",
      "Already a member.",
    );
    expect(repos.auditEvents.append).not.toHaveBeenCalled();
  });

  it("adds the user as a member and appends an audit event", async () => {
    const repos = makeRepos();
    const result = await addUserToGroupAsAdmin(command, makeRunner(repos));
    expect(result).toEqual({ groupId: "group-1", userId: "user-2" });
    expect(repos.identityAccess.addMembership).toHaveBeenCalledWith({
      groupId: "group-1",
      role: "member",
      userId: "user-2",
    });
    expect(repos.auditEvents.append).toHaveBeenCalledWith({
      action: "admin.add_member",
      actorUserId: "admin-1",
      details: {},
      resourceId: "group-1:user-2",
      resourceType: "membership",
    });
  });
});

describe("removeUserFromGroupAsAdmin", () => {
  const command = {
    actorUserId: parseId<UserId>("admin-1"),
    groupId: parseId<GroupId>("group-1"),
    now: ARCHIVED_AT,
    userId: parseId<UserId>("user-2"),
  };

  it("throws FORBIDDEN when the actor is not a Platform Admin", async () => {
    const repos = makeRepos({ actor: regularUser() });
    await expectPublicError(
      () => removeUserFromGroupAsAdmin(command, makeRunner(repos)),
      "FORBIDDEN",
      "Access denied.",
    );
    expect(repos.groupAccess.removeMembership).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the group does not exist", async () => {
    const repos = makeRepos({ group: undefined });
    await expectPublicError(
      () => removeUserFromGroupAsAdmin(command, makeRunner(repos)),
      "NOT_FOUND",
      "Group not found.",
    );
  });

  it("throws CONFLICT when removing the group's owner", async () => {
    const repos = makeRepos({
      group: { ...activeGroupRow(), ownerUserId: "user-2" },
    });
    await expectPublicError(
      () => removeUserFromGroupAsAdmin(command, makeRunner(repos)),
      "CONFLICT",
      "Reassign ownership first.",
    );
    expect(repos.groupAccess.removeMembership).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the membership does not exist", async () => {
    const repos = makeRepos({
      removeMembership: vi.fn(() => Promise.resolve(false)),
    });
    await expectPublicError(
      () => removeUserFromGroupAsAdmin(command, makeRunner(repos)),
      "NOT_FOUND",
      "Membership not found.",
    );
    expect(repos.auditEvents.append).not.toHaveBeenCalled();
  });

  it("removes the membership and appends an audit event", async () => {
    const repos = makeRepos();
    const result = await removeUserFromGroupAsAdmin(command, makeRunner(repos));
    expect(result).toEqual({ groupId: "group-1", userId: "user-2" });
    expect(repos.groupAccess.removeMembership).toHaveBeenCalledWith(
      "group-1",
      "user-2",
      ARCHIVED_AT,
    );
    expect(repos.auditEvents.append).toHaveBeenCalledWith({
      action: "admin.remove_member",
      actorUserId: "admin-1",
      details: {},
      resourceId: "group-1:user-2",
      resourceType: "membership",
    });
  });
});

describe("suspendUserAsAdmin", () => {
  const command = {
    actorUserId: parseId<UserId>("admin-1"),
    now: ARCHIVED_AT,
    userId: parseId<UserId>("user-2"),
  };

  it("throws FORBIDDEN when the actor is not a Platform Admin", async () => {
    const repos = makeRepos({ actor: regularUser() });
    await expectPublicError(
      () => suspendUserAsAdmin(command, makeRunner(repos)),
      "FORBIDDEN",
      "Access denied.",
    );
    expect(repos.identityAccess.archiveUser).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when suspending yourself", async () => {
    const selfCommand = {
      ...command,
      userId: parseId<UserId>("admin-1"),
    };
    const repos = makeRepos();
    await expectPublicError(
      () => suspendUserAsAdmin(selfCommand, makeRunner(repos)),
      "CONFLICT",
      "You can't suspend your own account.",
    );
    expect(repos.identityAccess.archiveUser).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the target user does not exist", async () => {
    const repos = makeRepos({ target: undefined });
    await expectPublicError(
      () => suspendUserAsAdmin(command, makeRunner(repos)),
      "NOT_FOUND",
      "User not found.",
    );
  });

  it("throws CONFLICT when the target is already suspended", async () => {
    const repos = makeRepos({ target: suspendedUser() });
    await expectPublicError(
      () => suspendUserAsAdmin(command, makeRunner(repos)),
      "CONFLICT",
      "User is already suspended.",
    );
    expect(repos.identityAccess.archiveUser).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when the archive write reports already archived", async () => {
    const repos = makeRepos({
      archiveUser: vi.fn(() => Promise.resolve(false)),
    });
    await expectPublicError(
      () => suspendUserAsAdmin(command, makeRunner(repos)),
      "CONFLICT",
      "User is already suspended.",
    );
    expect(repos.auditEvents.append).not.toHaveBeenCalled();
  });

  it("archives the user and appends an audit event", async () => {
    const repos = makeRepos();
    const result = await suspendUserAsAdmin(command, makeRunner(repos));
    expect(result).toEqual({ userId: "user-2" });
    expect(repos.identityAccess.archiveUser).toHaveBeenCalledWith(
      "user-2",
      ARCHIVED_AT,
    );
    expect(repos.auditEvents.append).toHaveBeenCalledWith({
      action: "admin.suspend_user",
      actorUserId: "admin-1",
      details: {},
      resourceId: "user-2",
      resourceType: "user",
    });
  });
});
