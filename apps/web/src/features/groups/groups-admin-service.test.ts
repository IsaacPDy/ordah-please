import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import {
  archiveGroupAsAdmin,
  renameGroupAsAdmin,
  type GroupsAdminRepositories,
  type GroupsAdminTransactionRunner,
} from "./groups-admin-service";

const NOW = new Date("2026-08-13T12:00:00.000Z");

function adminUser() {
  return { id: "admin-1", isPlatformAdmin: true, archivedAt: null };
}

function regularUser() {
  return { id: "user-actor", isPlatformAdmin: false, archivedAt: null };
}

type RenameGroupFn = GroupsAdminRepositories["groupAccess"]["renameGroup"];
type ArchiveGroupFn = GroupsAdminRepositories["groupAccess"]["archiveGroup"];
type AppendAuditFn = GroupsAdminRepositories["auditEvents"]["append"];

function makeRepos(overrides: {
  readonly actor?: { readonly id: string; readonly isPlatformAdmin: boolean; readonly archivedAt: Date | null } | undefined;
  readonly renameGroup?: RenameGroupFn;
  readonly archiveGroup?: ArchiveGroupFn;
  readonly append?: AppendAuditFn;
} = {}): GroupsAdminRepositories {
  return {
    identityAccess: {
      findUserById: vi.fn((id: string) =>
        Promise.resolve(
          "actor" in overrides
            ? overrides.actor
            : id === "admin-1"
              ? adminUser()
              : undefined,
        ),
      ),
    },
    groupAccess: {
      renameGroup:
        overrides.renameGroup ??
        vi.fn(() => Promise.resolve({ id: "group-1" })),
      archiveGroup:
        overrides.archiveGroup ?? vi.fn(() => Promise.resolve(true)),
    },
    auditEvents: {
      append: overrides.append ?? vi.fn(() => Promise.resolve({ id: "audit-1" })),
    },
  };
}

function makeRunner(
  repos: GroupsAdminRepositories,
): GroupsAdminTransactionRunner {
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

describe("renameGroupAsAdmin", () => {
  const command = {
    actorUserId: parseId<UserId>("admin-1"),
    groupId: parseId<GroupId>("group-1"),
    name: "New Name",
  };

  it("throws FORBIDDEN when the actor is not a Platform Admin", async () => {
    const repos = makeRepos({ actor: regularUser() });
    await expectPublicError(
      () => renameGroupAsAdmin(command, makeRunner(repos)),
      "FORBIDDEN",
      "Access denied.",
    );
    expect(repos.groupAccess.renameGroup).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when the actor does not exist", async () => {
    const repos = makeRepos({ actor: undefined });
    await expectPublicError(
      () => renameGroupAsAdmin(command, makeRunner(repos)),
      "FORBIDDEN",
      "Access denied.",
    );
  });

  it("trims the name before renaming", async () => {
    const repos = makeRepos();
    const result = await renameGroupAsAdmin(
      { ...command, name: "  New Name  " },
      makeRunner(repos),
    );
    expect(result).toEqual({ groupId: "group-1", name: "New Name" });
    expect(repos.groupAccess.renameGroup).toHaveBeenCalledWith({
      groupId: "group-1",
      name: "New Name",
    });
  });

  it("throws CONFLICT when the group write reports archived or missing", async () => {
    const repos = makeRepos({
      renameGroup: vi.fn(() => Promise.reject(new Error("no row written"))),
    });
    await expectPublicError(
      () => renameGroupAsAdmin(command, makeRunner(repos)),
      "CONFLICT",
      "Group is archived.",
    );
    expect(repos.auditEvents.append).not.toHaveBeenCalled();
  });

  it("renames the group and appends an audit event", async () => {
    const repos = makeRepos();
    const result = await renameGroupAsAdmin(command, makeRunner(repos));
    expect(result).toEqual({ groupId: "group-1", name: "New Name" });
    expect(repos.auditEvents.append).toHaveBeenCalledWith({
      action: "admin.rename_group",
      actorUserId: "admin-1",
      details: { name: "New Name" },
      resourceId: "group-1",
      resourceType: "group",
    });
  });
});

describe("archiveGroupAsAdmin", () => {
  const command = {
    actorUserId: parseId<UserId>("admin-1"),
    groupId: parseId<GroupId>("group-1"),
    now: NOW,
  };

  it("throws FORBIDDEN when the actor is not a Platform Admin", async () => {
    const repos = makeRepos({ actor: regularUser() });
    await expectPublicError(
      () => archiveGroupAsAdmin(command, makeRunner(repos)),
      "FORBIDDEN",
      "Access denied.",
    );
    expect(repos.groupAccess.archiveGroup).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when the group is already archived", async () => {
    const repos = makeRepos({
      archiveGroup: vi.fn(() => Promise.resolve(false)),
    });
    await expectPublicError(
      () => archiveGroupAsAdmin(command, makeRunner(repos)),
      "CONFLICT",
      "Group is already archived.",
    );
    expect(repos.auditEvents.append).not.toHaveBeenCalled();
  });

  it("archives the group and appends an audit event", async () => {
    const repos = makeRepos();
    const result = await archiveGroupAsAdmin(command, makeRunner(repos));
    expect(result).toEqual({ groupId: "group-1" });
    expect(repos.groupAccess.archiveGroup).toHaveBeenCalledWith(
      "group-1",
      NOW,
    );
    expect(repos.auditEvents.append).toHaveBeenCalledWith({
      action: "admin.archive_group",
      actorUserId: "admin-1",
      details: {},
      resourceId: "group-1",
      resourceType: "group",
    });
  });
});
