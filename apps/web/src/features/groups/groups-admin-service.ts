import { PublicApiError } from "@ordah-please/contracts";
import type { GroupId, UserId } from "@ordah-please/domain";
import { validateGroupName } from "@ordah-please/domain";

export interface AdminActorRow {
  readonly id: string;
  readonly isPlatformAdmin: boolean;
  readonly archivedAt: Date | null;
}

export interface GroupsAdminRepositories {
  readonly identityAccess: {
    readonly findUserById: (
      userId: string,
    ) => Promise<AdminActorRow | undefined>;
  };
  readonly groupAccess: {
    readonly renameGroup: (input: {
      readonly groupId: string;
      readonly name: string;
    }) => Promise<{ readonly id: string }>;
    readonly archiveGroup: (
      groupId: string,
      archivedAt: Date,
    ) => Promise<boolean>;
  };
  readonly auditEvents: {
    readonly append: (input: {
      readonly action: string;
      readonly actorUserId: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly resourceId: string;
      readonly resourceType: string;
    }) => Promise<{ readonly id: string }>;
  };
}

export interface GroupsAdminTransactionRunner {
  run<Result>(
    operation: (repositories: GroupsAdminRepositories) => Promise<Result>,
  ): Promise<Result>;
}

async function requirePlatformAdmin(
  identityAccess: GroupsAdminRepositories["identityAccess"],
  actorUserId: string,
): Promise<void> {
  const actor = await identityAccess.findUserById(actorUserId);
  if (actor === undefined || !actor.isPlatformAdmin) {
    throw new PublicApiError("FORBIDDEN", "Access denied.");
  }
}

export interface RenameGroupAsAdminCommand {
  readonly actorUserId: UserId;
  readonly groupId: GroupId;
  readonly name: string;
}

/** Platform-admin rename that bypasses group-owner checks; still refuses archived groups. */
export async function renameGroupAsAdmin(
  command: RenameGroupAsAdminCommand,
  transactionRunner: GroupsAdminTransactionRunner,
): Promise<{ readonly groupId: GroupId; readonly name: string }> {
  const name = validateGroupName(command.name);
  return transactionRunner.run(async (repositories) => {
    await requirePlatformAdmin(
      repositories.identityAccess,
      command.actorUserId,
    );

    try {
      await repositories.groupAccess.renameGroup({
        groupId: command.groupId,
        name,
      });
    } catch {
      // renameGroup only refuses to write when the group is missing or archived.
      throw new PublicApiError("CONFLICT", "Group is archived.");
    }

    await repositories.auditEvents.append({
      action: "admin.rename_group",
      actorUserId: command.actorUserId,
      details: { name },
      resourceId: command.groupId,
      resourceType: "group",
    });

    return { groupId: command.groupId, name };
  });
}

export interface ArchiveGroupAsAdminCommand {
  readonly actorUserId: UserId;
  readonly groupId: GroupId;
  readonly now: Date;
}

/** Platform-admin archive setting archivedAt; the group disappears from lists but history is kept. */
export async function archiveGroupAsAdmin(
  command: ArchiveGroupAsAdminCommand,
  transactionRunner: GroupsAdminTransactionRunner,
): Promise<{ readonly groupId: GroupId }> {
  return transactionRunner.run(async (repositories) => {
    await requirePlatformAdmin(
      repositories.identityAccess,
      command.actorUserId,
    );

    const archived = await repositories.groupAccess.archiveGroup(
      command.groupId,
      command.now,
    );
    if (!archived) {
      throw new PublicApiError("CONFLICT", "Group is already archived.");
    }

    await repositories.auditEvents.append({
      action: "admin.archive_group",
      actorUserId: command.actorUserId,
      details: {},
      resourceId: command.groupId,
      resourceType: "group",
    });

    return { groupId: command.groupId };
  });
}
