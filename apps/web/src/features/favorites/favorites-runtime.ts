import {
  createDatabaseClient,
  createRepositories,
  withTransaction,
  type Database,
} from "@ordah-please/db";

import { loadAppIdentity } from "../../auth/load-app-identity";
import { verifySession } from "../../auth/verify-session";
import type { FavoritesServiceRepositories } from "./favorites-service";
import {
  removeFavoriteMeal,
  saveFavoriteMeal,
} from "./favorites-service";

let runtimeDatabase: Database | undefined;

/** Reuses one lazy pooled database across warm authenticated favorites requests. */
function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
}

/** Runs one favorites mutation with catalog and favorites repositories sharing one transaction. */
function runFavoritesTransaction<Result>(
  operation: (repositories: FavoritesServiceRepositories) => Promise<Result>,
): Promise<Result> {
  return withTransaction(getRuntimeDatabase(), (transaction) =>
    operation(createRepositories(transaction)),
  );
}

/** Loads the authenticated user's current product identity from Neon. */
export function loadRuntimeIdentity(session: {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}) {
  return loadAppIdentity(
    session,
    createRepositories(getRuntimeDatabase()).identityAccess,
  );
}

export const favoritesRuntime = {
  saveFavoriteMeal: (command: Parameters<typeof saveFavoriteMeal>[0]) =>
    saveFavoriteMeal(command, { run: runFavoritesTransaction }),
  removeFavoriteMeal: (command: Parameters<typeof removeFavoriteMeal>[0]) =>
    removeFavoriteMeal(command, { run: runFavoritesTransaction }),
  /** Lists every favorite for the signed-in member, for the Favorites page. */
  listFavoritesForUser: (userId: string) =>
    createRepositories(getRuntimeDatabase()).favorites.listForUser(userId),
  loadIdentity: loadRuntimeIdentity,
  verifySession,
} as const;
