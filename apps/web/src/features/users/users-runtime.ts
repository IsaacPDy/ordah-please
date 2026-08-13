import {
  createDatabaseClient,
  createRepositories,
  type Database,
} from "@ordah-please/db";

let runtimeDatabase: Database | undefined;

/** Reuses one lazy pooled database across warm authenticated admin requests. */
function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
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

export const usersRuntime = {
  /** Lists every active product user with profile fields and group-name-resolved memberships, for the admin portal. */
  listUsersForAdmin: async (): Promise<readonly AdminUserSummary[]> => {
    const repositories = createRepositories(getRuntimeDatabase());
    const summaries = await repositories.identityAccess.listUsersWithSummary();
    return Promise.all(
      summaries.map(async (user) => {
        const memberships = await Promise.all(
          user.memberships.map(async (membership) => {
            const groupSummary =
              await repositories.groupAccess.findGroupSummary(membership.groupId);
            return {
              groupId: membership.groupId,
              groupName: groupSummary?.name ?? "Group",
              role: MEMBERSHIP_ROLE_MAP[membership.role],
            };
          }),
        );
        return {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          imageUrl: user.imageUrl,
          isPlatformAdmin: user.isPlatformAdmin,
          memberships,
        };
      }),
    );
  },
} as const;
