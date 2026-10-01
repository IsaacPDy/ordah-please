import {
  getRuntimeDatabase,
  createRepositories,
  type AuditEventsRepository,
  type GroupAccessRepository,
  type IdentityAccessRepository,
  withTransaction,
} from "@ordah-please/db";

import {
  addUserToGroupAsAdmin,
  removeUserFromGroupAsAdmin,
  suspendUserAsAdmin,
} from "./users-admin-service";

type UsersAdminRuntimeRepositories = Readonly<{
  identityAccess: IdentityAccessRepository;
  groupAccess: GroupAccessRepository;
  auditEvents: AuditEventsRepository;
}>;

/** Runs one users-admin mutation with identity, group, and audit repositories sharing one transaction. */
function runUsersAdminTransaction<Result>(
  operation: (repositories: UsersAdminRuntimeRepositories) => Promise<Result>,
): Promise<Result> {
  return withTransaction(getRuntimeDatabase(), (transaction) => {
    const repositories = createRepositories(transaction);
    return operation({
      identityAccess: repositories.identityAccess,
      groupAccess: repositories.groupAccess,
      auditEvents: repositories.auditEvents,
    });
  });
}

const MEMBERSHIP_ROLE_MAP = {
  manager: "manager",
  member: "member",
  owner: "group-owner",
} as const satisfies Readonly<
  Record<"owner" | "manager" | "member", AdminUserMembershipRole>
>;

export type AdminUserMembershipRole = "group-owner" | "manager" | "member";

export interface AdminUserMembership {
  readonly groupId: string;
  readonly groupName: string;
  readonly role: AdminUserMembershipRole;
}

export interface AdminUserSummary {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly imageUrl: string | null;
  readonly isPlatformAdmin: boolean;
  readonly memberships: readonly AdminUserMembership[];
}

type UsersAdminReadRepositories = Readonly<{
  groupAccess: Pick<GroupAccessRepository, "listGroupSummaries">;
  identityAccess: Pick<IdentityAccessRepository, "listUsersWithSummary">;
}>;

/** Resolves all admin user memberships with one user read and one group read. */
export async function listUsersForAdminWith(
  repositories: UsersAdminReadRepositories,
): Promise<readonly AdminUserSummary[]> {
  const summaries = await repositories.identityAccess.listUsersWithSummary();
  const groupIds = [
    ...new Set(
      summaries.flatMap((user) =>
        user.memberships.map((membership) => membership.groupId),
      ),
    ),
  ];
  const groups = await repositories.groupAccess.listGroupSummaries(groupIds);
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  return summaries.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    imageUrl: user.imageUrl,
    isPlatformAdmin: user.isPlatformAdmin,
    memberships: user.memberships.map((membership) => ({
      groupId: membership.groupId,
      groupName: groupNameById.get(membership.groupId) ?? "Group",
      role: MEMBERSHIP_ROLE_MAP[membership.role],
    })),
  }));
}

export const usersRuntime = {
  addUserToGroupAsAdmin: (
    command: Parameters<typeof addUserToGroupAsAdmin>[0],
  ) => addUserToGroupAsAdmin(command, { run: runUsersAdminTransaction }),
  removeUserFromGroupAsAdmin: (
    command: Parameters<typeof removeUserFromGroupAsAdmin>[0],
  ) => removeUserFromGroupAsAdmin(command, { run: runUsersAdminTransaction }),
  suspendUserAsAdmin: (command: Parameters<typeof suspendUserAsAdmin>[0]) =>
    suspendUserAsAdmin(command, { run: runUsersAdminTransaction }),
  /** Lists every active product user with profile fields and group-name-resolved memberships, for the admin portal. */
  listUsersForAdmin: (): Promise<readonly AdminUserSummary[]> => {
    const repositories = createRepositories(getRuntimeDatabase());
    return listUsersForAdminWith(repositories);
  },
} as const;
