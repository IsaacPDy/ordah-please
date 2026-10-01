import {
  getRuntimeDatabase,
  type Database,
  createRepositories,
  groups as groupsSchema,
  type GroupAccessRepository,
  type OrdersRepository,
  type AuditEventsRepository,
  type IdentityAccessRepository,
  withTransaction,
} from "@ordah-please/db";
import { asc, isNull } from "drizzle-orm";

import { loadAppIdentity } from "../../auth/load-app-identity";
import { verifySession } from "../../auth/verify-session";
import {
  archiveGroupAsAdmin,
  renameGroupAsAdmin,
} from "./groups-admin-service";
import {
  acceptInviteLink,
  createGroup,
  loadGroupDetails,
  renameGroup,
  rotateInviteLink,
} from "./group-service";

export interface ViewerGroupSummary {
  readonly groupId: string;
  readonly memberCount: number;
  readonly memberPreviews: readonly { readonly displayName: string }[];
  readonly name: string;
  readonly role: string;
}

export interface AdminGroupSummary {
  readonly activeOrderCount: number;
  readonly groupId: string;
  readonly memberCount: number;
  readonly name: string;
  readonly ownerDisplayName: string | null;
}

/** Builds every member group card from two set-based repository reads. */
export async function listViewerGroupSummariesWith(
  groupAccess: Pick<
    GroupAccessRepository,
    "listActiveMembersForGroups" | "listGroupSummaries"
  >,
  memberships: readonly { readonly groupId: string; readonly role: string }[],
): Promise<readonly ViewerGroupSummary[]> {
  const groupIds = memberships.map((membership) => membership.groupId);
  const [groups, members] = await Promise.all([
    groupAccess.listGroupSummaries(groupIds),
    groupAccess.listActiveMembersForGroups(groupIds),
  ]);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const membersByGroup = new Map<string, typeof members>();
  for (const member of members) {
    membersByGroup.set(member.groupId, [
      ...(membersByGroup.get(member.groupId) ?? []),
      member,
    ]);
  }

  return memberships.map((membership) => {
    const groupMembers = membersByGroup.get(membership.groupId) ?? [];
    return {
      groupId: membership.groupId,
      memberCount: groupMembers.length,
      memberPreviews: groupMembers.slice(0, 3).map(({ displayName }) => ({
        displayName,
      })),
      name: groupById.get(membership.groupId)?.name ?? "Group",
      role: membership.role,
    };
  });
}

/** Builds all admin group rows from one group read and one member read. */
export async function listAllGroupsForAdminWith(dependencies: {
  readonly groupAccess: Pick<
    GroupAccessRepository,
    "listActiveMembersForGroups"
  >;
  readonly listAllGroups: () => Promise<
    readonly { readonly id: string; readonly name: string }[]
  >;
  readonly orders: Pick<OrdersRepository, "listActiveCountsForGroups">;
}): Promise<readonly AdminGroupSummary[]> {
  const allGroups = await dependencies.listAllGroups();
  const groupIds = allGroups.map((group) => group.id);
  const [members, activeOrderCounts] = await Promise.all([
    dependencies.groupAccess.listActiveMembersForGroups(groupIds),
    dependencies.orders.listActiveCountsForGroups(groupIds),
  ]);
  const activeCountByGroup = new Map(
    activeOrderCounts.map((row) => [row.groupId, row.activeOrderCount]),
  );
  const membersByGroup = new Map<string, typeof members>();
  for (const member of members) {
    membersByGroup.set(member.groupId, [
      ...(membersByGroup.get(member.groupId) ?? []),
      member,
    ]);
  }

  return allGroups.map((group) => {
    const groupMembers = membersByGroup.get(group.id) ?? [];
    return {
      activeOrderCount: activeCountByGroup.get(group.id) ?? 0,
      groupId: group.id,
      memberCount: groupMembers.length,
      name: group.name,
      ownerDisplayName:
        groupMembers.find((member) => member.role === "owner")?.displayName ??
        null,
    };
  });
}

/** Reads every active (non-archived) group row in display order. */
async function listAllGroupRows(database: Database) {
  return database
    .select({ id: groupsSchema.id, name: groupsSchema.name })
    .from(groupsSchema)
    .where(isNull(groupsSchema.archivedAt))
    .orderBy(asc(groupsSchema.name));
}

type GroupRepositories = Readonly<{
  groupAccess: GroupAccessRepository;
  auditEvents: AuditEventsRepository;
  identityAccess: Pick<
    IdentityAccessRepository,
    "addMembership" | "listActiveMemberships"
  >;
}>;

/** Runs one group mutation with group, identity, and audit repositories sharing one transaction. */
function runGroupTransaction<Result>(
  operation: (repositories: GroupRepositories) => Promise<Result>,
): Promise<Result> {
  return withTransaction(getRuntimeDatabase(), (transaction) => {
    const repositories = createRepositories(transaction);
    return operation({
      groupAccess: repositories.groupAccess,
      auditEvents: repositories.auditEvents,
      identityAccess: repositories.identityAccess,
    });
  });
}

type GroupsAdminRuntimeRepositories = Readonly<{
  identityAccess: IdentityAccessRepository;
  groupAccess: GroupAccessRepository;
  auditEvents: AuditEventsRepository;
}>;

/** Runs one groups-admin mutation with full identity, group, and audit repositories in one transaction. */
function runGroupsAdminTransaction<Result>(
  operation: (repositories: GroupsAdminRuntimeRepositories) => Promise<Result>,
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

/** Provisions and loads the authenticated user's current product identity from Neon. */
export function loadRuntimeIdentity(session: {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}) {
  return loadAppIdentity(
    {
      authUserId: session.authUserId,
      displayName: session.displayName,
      email: session.email,
      imageUrl: session.imageUrl,
    },
    createRepositories(getRuntimeDatabase()).identityAccess,
  );
}

export const groupRuntime = {
  acceptInviteLink: (command: Parameters<typeof acceptInviteLink>[0]) =>
    acceptInviteLink(command, { run: runGroupTransaction }),
  archiveGroupAsAdmin: (command: Parameters<typeof archiveGroupAsAdmin>[0]) =>
    archiveGroupAsAdmin(command, { run: runGroupsAdminTransaction }),
  createGroup: (command: Parameters<typeof createGroup>[0]) =>
    createGroup(command, { run: runGroupTransaction }),
  loadGroupDetails: (command: Parameters<typeof loadGroupDetails>[0]) =>
    loadGroupDetails(command, { run: runGroupTransaction }),
  renameGroup: (command: Parameters<typeof renameGroup>[0]) =>
    renameGroup(command, { run: runGroupTransaction }),
  renameGroupAsAdmin: (command: Parameters<typeof renameGroupAsAdmin>[0]) =>
    renameGroupAsAdmin(command, { run: runGroupsAdminTransaction }),
  rotateInviteLink: (command: Parameters<typeof rotateInviteLink>[0]) =>
    rotateInviteLink(command, { run: runGroupTransaction }),
  /** Loads name, role, and member preview for each membership in the viewer's identity. */
  listViewerGroupSummaries: (
    memberships: readonly { readonly groupId: string; readonly role: string }[],
  ): Promise<readonly ViewerGroupSummary[]> => {
    const groupAccess = createRepositories(getRuntimeDatabase()).groupAccess;
    return listViewerGroupSummariesWith(groupAccess, memberships);
  },
  /** Lists every group with its owner's display name and current member count, for the admin portal. */
  listAllGroupsForAdmin: (): Promise<readonly AdminGroupSummary[]> => {
    const repositories = createRepositories(getRuntimeDatabase());
    return listAllGroupsForAdminWith({
      groupAccess: repositories.groupAccess,
      listAllGroups: () => listAllGroupRows(getRuntimeDatabase()),
      orders: repositories.orders,
    });
  },
  /** Lists every product user — used to populate the Owner picker in the admin create-group dialog. */
  listAllUsers: async (): Promise<
    readonly { readonly id: string; readonly displayName: string }[]
  > => {
    const repositories = createRepositories(getRuntimeDatabase());
    return repositories.identityAccess.listUsers();
  },
  loadIdentity: loadRuntimeIdentity,
  verifySession,
  now: () => new Date(),
};
