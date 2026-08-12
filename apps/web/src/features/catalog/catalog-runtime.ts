import { createDatabaseClient, createRepositories, type Database } from "@ordah-please/db";

import { loadAppIdentity } from "../../auth/load-app-identity";
import { verifySession } from "../../auth/verify-session";

let runtimeDatabase: Database | undefined;

/** Reuses one lazy pooled database across warm authenticated catalog requests. */
function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
}

/** Loads the authenticated user's current product identity from Neon. */
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

export const catalogRuntime = {
  catalog: createRepositories(getRuntimeDatabase()).catalog,
  loadIdentity: loadRuntimeIdentity,
  verifySession,
} as const;
