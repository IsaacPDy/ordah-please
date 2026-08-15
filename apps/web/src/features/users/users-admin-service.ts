import { PublicApiError } from "@ordah-please/contracts";
import type { GroupId, UserId } from "@ordah-please/domain";

export interface AdminActorRow {
  readonly id: string;
  readonly isPlatformAdmin: boolean;
  readonly archivedAt: Date | null;
}

export interface UsersAdminRepositories {
  readonly identityAccess: {
    readonly findUserById: (
      userId: string,
    ) => Promise<AdminActorRow | undefined>;
    readonly addMembership: (input: {
      readonly groupId: string;
      readonly role: "owner" | "manager" | "member";
      readonly userId: string;
      readonly joinedAt?: Date;
    }) => Promise<{ readonly userId: string } | undefined>;
    readonly archiveUser: (
      userId: string,
      archivedAt: Date,
    ) => Promise<boolean>;
  };
  readonly groupAccess: {
    readonly findGroupSummary: (
      groupId: string,
    ) => Promise<
      | {
          readonly archivedAt: Date | null;
          readonly id: string;
          readonly name: string;
          readonly ownerUserId: string | null;
        }
      | undefined
    >;
    readonly removeMembership: (
      groupId: string,
      userId: string,
      removedAt: Date,
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

export interface UsersAdminTransactionRunner {
  run<Result>(
    operation: (repositories: UsersAdminRepositories) => Promise<Result>,
  ): Promise<Result>;
}

async function requirePlatformAdmin(
  identityAccess: UsersAdminRepositories["identityAccess"],
  actorUserId: string,
): Promise<void> {
  const actor = await identityAccess.findUserById(actorUserId);
  if (actor === undefined || !actor.isPlatformAdmin) {
    throw new PublicApiError("FORBIDDEN", "Access denied.");
  }
}

export interface AddUserToGroupAsAdminCommand {
  readonly actorUserId: UserId;
  readonly groupId: GroupId;
  readonly userId: UserId;
}

/** Platform-admin action adding one user to a group as a Member, audited in the same transaction. */
export async function addUserToGroupAsAdmin(
  command: AddUserToGroupAsAdminCommand,
  transactionRunner: UsersAdminTransactionRunner,
): Promise<{ readonly groupId: GroupId; readonly userId: UserId }> {
  return transactionRunner.run(async (repositories) => {
    await requirePlatformAdmin(
      repositories.identityAccess,
      command.actorUserId,
    );

    const group = await repositories.groupAccess.findGroupSummary(
      command.groupId,
    );
    if (group === undefined) {
      throw new PublicApiError("NOT_FOUND", "Group not found.");
    }
    if (group.archivedAt !== null) {
      throw new PublicApiError("CONFLICT", "Group is archived.");
    }

    const target = await repositories.identityAccess.findUserById(
      command.userId,
    );
    if (target === undefined) {
      throw new PublicApiError("NOT_FOUND", "User not found.");
    }
    if (target.archivedAt !== null) {
      throw new PublicApiError("CONFLICT", "User is suspended.");
    }

    const membership = await repositories.identityAccess.addMembership({
      groupId: command.groupId,
      role: "member",
      userId: command.userId,
    });
    if (membership === undefined) {
      throw new PublicApiError("CONFLICT", "Already a member.");
    }

    await repositories.auditEvents.append({
      action: "admin.add_member",
      actorUserId: command.actorUserId,
      details: {},
      resourceId: `${command.groupId}:${command.userId}`,
      resourceType: "membership",
    });

    return { groupId: command.groupId, userId: command.userId };
  });
}

export interface RemoveUserFromGroupAsAdminCommand {
  readonly actorUserId: UserId;
  readonly groupId: GroupId;
  readonly now: Date;
  readonly userId: UserId;
}

/** Platform-admin action removing one membership; the group's Owner cannot be removed. */
export async function removeUserFromGroupAsAdmin(
  command: RemoveUserFromGroupAsAdminCommand,
  transactionRunner: UsersAdminTransactionRunner,
): Promise<{ readonly groupId: GroupId; readonly userId: UserId }> {
  return transactionRunner.run(async (repositories) => {
    await requirePlatformAdmin(
      repositories.identityAccess,
      command.actorUserId,
    );

    const group = await repositories.groupAccess.findGroupSummary(
      command.groupId,
    );
    if (group === undefined) {
      throw new PublicApiError("NOT_FOUND", "Group not found.");
    }
    if (group.ownerUserId === command.userId) {
      throw new PublicApiError("CONFLICT", "Reassign ownership first.");
    }

    const removed = await repositories.groupAccess.removeMembership(
      command.groupId,
      command.userId,
      command.now,
    );
    if (!removed) {
      throw new PublicApiError("NOT_FOUND", "Membership not found.");
    }

    await repositories.auditEvents.append({
      action: "admin.remove_member",
      actorUserId: command.actorUserId,
      details: {},
      resourceId: `${command.groupId}:${command.userId}`,
      resourceType: "membership",
    });

    return { groupId: command.groupId, userId: command.userId };
  });
}

export interface SuspendUserAsAdminCommand {
  readonly actorUserId: UserId;
  readonly now: Date;
  readonly userId: UserId;
}

/** Platform-admin action suspending one user by setting archivedAt; history stays intact. */
export async function suspendUserAsAdmin(
  command: SuspendUserAsAdminCommand,
  transactionRunner: UsersAdminTransactionRunner,
): Promise<{ readonly userId: UserId }> {
  return transactionRunner.run(async (repositories) => {
    await requirePlatformAdmin(
      repositories.identityAccess,
      command.actorUserId,
    );

    if (command.actorUserId === command.userId) {
      throw new PublicApiError(
        "CONFLICT",
        "You can't suspend your own account.",
      );
    }

    const target = await repositories.identityAccess.findUserById(
      command.userId,
    );
    if (target === undefined) {
      throw new PublicApiError("NOT_FOUND", "User not found.");
    }
    if (target.archivedAt !== null) {
      throw new PublicApiError("CONFLICT", "User is already suspended.");
    }

    const archived = await repositories.identityAccess.archiveUser(
      command.userId,
      command.now,
    );
    if (!archived) {
      throw new PublicApiError("CONFLICT", "User is already suspended.");
    }

    await repositories.auditEvents.append({
      action: "admin.suspend_user",
      actorUserId: command.actorUserId,
      details: {},
      resourceId: command.userId,
      resourceType: "user",
    });

    return { userId: command.userId };
  });
}
