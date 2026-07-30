import {
  type AuditEventsRepository,
  createDatabaseClient,
  createRepositories,
  type Database,
  type GroupAccessRepository,
  type IdentityAccessRepository,
  withTransaction,
} from "@ordah-please/db";

import { loadAppIdentity } from "../../auth/load-app-identity";
import { verifySession } from "../../auth/verify-session";
import {
  acceptGroupInvitation,
  decideAdminAccessRequest,
  issueGroupInvitation,
  listPendingAdminAccessRequests,
  manageGroupMember,
  submitAdminAccessRequest,
} from "./access-service";

let runtimeDatabase: Database | undefined;

type AccessRepositories = Readonly<{
  access: GroupAccessRepository &
    Pick<IdentityAccessRepository, "addMembership" | "listActiveMemberships">;
  auditEvents: AuditEventsRepository;
}>;

/** Reuses one lazy pooled database across warm authenticated access requests. */
function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
}

/** Runs one access mutation with group and identity repositories sharing the same transaction. */
function runAccessTransaction<Result>(
  operation: (repositories: AccessRepositories) => Promise<Result>,
): Promise<Result> {
  return withTransaction(getRuntimeDatabase(), (transaction) => {
    const repositories = createRepositories(transaction);
    return operation({
      access: {
        ...repositories.groupAccess,
        addMembership: (input) =>
          repositories.identityAccess.addMembership(input),
        listActiveMemberships: (userId) =>
          repositories.identityAccess.listActiveMemberships(userId),
      },
      auditEvents: repositories.auditEvents,
    });
  });
}

/** Provisions and loads the authenticated user's current product identity from Neon. */
export function loadRuntimeIdentity(session: {
  readonly authUserId: string;
  readonly displayName: string;
}) {
  return loadAppIdentity(
    {
      authUserId: session.authUserId,
      displayName: session.displayName,
    },
    createRepositories(getRuntimeDatabase()).identityAccess,
  );
}

/** Reads the canonical non-secret deployment origin used to bind invitation tokens. */
export function readDeploymentId(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const baseUrl = environment.APP_BASE_URL;
  if (baseUrl === undefined || baseUrl.trim() === "") {
    throw new Error("APP_BASE_URL is required on the server.");
  }
  try {
    return new URL(baseUrl).origin;
  } catch {
    throw new Error("APP_BASE_URL must be a valid absolute URL.");
  }
}

export const accessRuntime = {
  acceptInvitation: (command: Parameters<typeof acceptGroupInvitation>[0]) =>
    acceptGroupInvitation(command, { run: runAccessTransaction }),
  decideAdminRequest: (
    command: Parameters<typeof decideAdminAccessRequest>[0],
  ) => decideAdminAccessRequest(command, { run: runAccessTransaction }),
  issueInvitation: (command: Parameters<typeof issueGroupInvitation>[0]) =>
    issueGroupInvitation(command, { run: runAccessTransaction }),
  listMembers: (groupId: string) =>
    createRepositories(getRuntimeDatabase()).groupAccess.listActiveMembers(
      groupId,
    ),
  listPendingAdminRequests: async () =>
    (
      await listPendingAdminAccessRequests({ run: runAccessTransaction })
    ).requests,
  loadIdentity: loadRuntimeIdentity,
  manageMember: (command: Parameters<typeof manageGroupMember>[0]) =>
    manageGroupMember(command, { run: runAccessTransaction }),
  submitAdminRequest: (
    command: Parameters<typeof submitAdminAccessRequest>[0],
  ) => submitAdminAccessRequest(command, { run: runAccessTransaction }),
  verifySession,
};
