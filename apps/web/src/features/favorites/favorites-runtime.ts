import {
  getRuntimeDatabase,
  createRepositories,
  withTransaction,
} from "@ordah-please/db";

import { loadAppIdentity } from "../../auth/load-app-identity";
import { verifySession } from "../../auth/verify-session";
import type { FavoritesServiceRepositories } from "./favorites-service";
import { removeFavoriteMeal, saveFavoriteMeal } from "./favorites-service";

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
  /** Lists only the signed-in member's bounded favorites for one restaurant branch. */
  listFavoritesForBranch: (userId: string, branchId: string) =>
    createRepositories(
      getRuntimeDatabase(),
    ).favorites.listForUserAndBranchWithItems(userId, branchId),
  loadIdentity: loadRuntimeIdentity,
  verifySession,
} as const;
