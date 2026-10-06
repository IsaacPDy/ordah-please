import { PublicApiError } from "@ordah-please/contracts";
import type { GroupAccessRepository } from "@ordah-please/db";

type Repositories = {
  identityAccess: {
    findUserById: (
      id: string,
    ) => Promise<
      { isPlatformAdmin: boolean; archivedAt: Date | null } | undefined
    >;
  };
  groupAccess: Pick<
    GroupAccessRepository,
    "findGroupSummary" | "listActiveMembers" | "setMembershipRole"
  >;
  auditEvents: {
    append: (input: {
      actorUserId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      details: Record<string, unknown>;
    }) => Promise<unknown>;
  };
};
export interface GroupMembersAdminRunner {
  run<T>(operation: (repositories: Repositories) => Promise<T>): Promise<T>;
}
async function requireAdmin(repositories: Repositories, actorUserId: string) {
  const actor = await repositories.identityAccess.findUserById(actorUserId);
  if (!actor?.isPlatformAdmin || actor.archivedAt !== null)
    throw new PublicApiError("FORBIDDEN", "Access denied.");
}
/** Loads private member cards after verifying the live admin record. */
export async function loadGroupMembersAsAdmin(
  command: { actorUserId: string; groupId: string },
  runner: GroupMembersAdminRunner,
) {
  return runner.run(async (repositories) => {
    await requireAdmin(repositories, command.actorUserId);
    const group = await repositories.groupAccess.findGroupSummary(
      command.groupId,
    );
    if (!group) throw new PublicApiError("NOT_FOUND", "Group not found.");
    const members = await repositories.groupAccess.listActiveMembers(
      command.groupId,
    );
    return { ...group, members };
  });
}
/** Changes only Member/Manager roles and records the change atomically. Ownership is protected. */
export async function setGroupMemberRoleAsAdmin(
  command: {
    actorUserId: string;
    groupId: string;
    userId: string;
    expectedRole: "member" | "manager";
    role: "member" | "manager";
  },
  runner: GroupMembersAdminRunner,
) {
  return runner.run(async (repositories) => {
    await requireAdmin(repositories, command.actorUserId);
    if (
      !["member", "manager"].includes(command.expectedRole) ||
      !["member", "manager"].includes(command.role)
    )
      throw new PublicApiError("INVALID_INPUT", "Choose Member or Manager.");
    const group = await repositories.groupAccess.findGroupSummary(
      command.groupId,
    );
    if (!group) throw new PublicApiError("NOT_FOUND", "Group not found.");
    if (group.archivedAt !== null)
      throw new PublicApiError("CONFLICT", "Group is archived.");
    if (group.ownerUserId === command.userId)
      throw new PublicApiError(
        "CONFLICT",
        "The group owner's role cannot be changed.",
      );
    const target = await repositories.identityAccess.findUserById(
      command.userId,
    );
    if (!target) throw new PublicApiError("NOT_FOUND", "User not found.");
    if (target.archivedAt !== null)
      throw new PublicApiError("CONFLICT", "User is suspended.");
    const changed = await repositories.groupAccess.setMembershipRole(
      command.groupId,
      command.userId,
      command.expectedRole,
      command.role,
    );
    if (!changed)
      throw new PublicApiError(
        "CONFLICT",
        "Membership changed. Refresh the group and try again.",
      );
    await repositories.auditEvents.append({
      actorUserId: command.actorUserId,
      action: "admin.set_member_role",
      resourceType: "membership",
      resourceId: `${command.groupId}:${command.userId}`,
      details: { previousRole: command.expectedRole, role: command.role },
    });
    return {
      groupId: command.groupId,
      userId: command.userId,
      role: command.role,
    };
  });
}
