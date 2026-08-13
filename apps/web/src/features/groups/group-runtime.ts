import {
  createDatabaseClient,
  createRepositories,
  groups as groupsSchema,
  type Database,
  type GroupAccessRepository,
  type AuditEventsRepository,
  type IdentityAccessRepository,
  withTransaction,
} from "@ordah-please/db";
import { asc } from "drizzle-orm";

import { loadAppIdentity } from "../../auth/load-app-identity";
import { verifySession } from "../../auth/verify-session";
import {
  acceptInviteLink,
  createGroup,
  loadGroupDetails,
  renameGroup,
  rotateInviteLink,
} from "./group-service";

/** Reads every group row in display order. */
async function listAllGroupRows(database: Database) {
  return database
    .select({ id: groupsSchema.id, name: groupsSchema.name })
    .from(groupsSchema)
    .orderBy(asc(groupsSchema.name));
}

let runtimeDatabase: Database | undefined;

type GroupRepositories = Readonly<{
  groupAccess: GroupAccessRepository;
  auditEvents: AuditEventsRepository;
  identityAccess: Pick<IdentityAccessRepository, "addMembership" | "listActiveMemberships">;
}>;

/** Reuses one lazy pooled database across warm authenticated group requests. */
function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
}

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
  createGroup: (command: Parameters<typeof createGroup>[0]) =>
    createGroup(command, { run: runGroupTransaction }),
  loadGroupDetails: (command: Parameters<typeof loadGroupDetails>[0]) =>
    loadGroupDetails(command, { run: runGroupTransaction }),
  renameGroup: (command: Parameters<typeof renameGroup>[0]) =>
    renameGroup(command, { run: runGroupTransaction }),
  rotateInviteLink: (command: Parameters<typeof rotateInviteLink>[0]) =>
    rotateInviteLink(command, { run: runGroupTransaction }),
  /** Loads name, role, and member preview for each membership in the viewer's identity. */
  listViewerGroupSummaries: async (
    memberships: readonly { readonly groupId: string; readonly role: string }[],
  ): Promise<
    readonly {
      readonly groupId: string;
      readonly name: string;
      readonly role: string;
      readonly memberCount: number;
      readonly memberPreviews: readonly {
        readonly displayName: string;
      }[];
    }[]
  > => {
    const groupAccess = createRepositories(getRuntimeDatabase()).groupAccess;
    const summaries = await Promise.all(
      memberships.map(async (membership) => {
        const summary = await groupAccess.findGroupSummary(membership.groupId);
        const members = await groupAccess.listActiveMembers(membership.groupId);
        return {
          groupId: membership.groupId,
          name: summary?.name ?? "Group",
          role: membership.role,
          memberCount: members.length,
          memberPreviews: members.map((member) => ({
            displayName: member.displayName,
          })),
        };
      }),
    );
    return summaries;
  },
  /** Lists every group with its owner's display name and current member count, for the admin portal. */
  listAllGroupsForAdmin: async (): Promise<
    readonly {
      readonly groupId: string;
      readonly name: string;
      readonly ownerDisplayName: string | null;
      readonly memberCount: number;
    }[]
  > => {
    const repositories = createRepositories(getRuntimeDatabase());
    const groupAccess = repositories.groupAccess;
    // listAllGroups isn't on the repo; query groups directly via a one-off select.
    const allGroups = await listAllGroupRows(getRuntimeDatabase());
    return Promise.all(
      allGroups.map(async (group) => {
        const members = await groupAccess.listActiveMembers(group.id);
        const owner = members.find((member) => member.role === "owner");
        return {
          groupId: group.id,
          name: group.name,
          ownerDisplayName: owner?.displayName ?? null,
          memberCount: members.length,
        };
      }),
    );
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
