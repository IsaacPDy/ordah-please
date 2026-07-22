import { and, asc, eq } from "drizzle-orm";

import { favorites } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";

export interface FavoritesRepository {
  listForUserAndBranch(
    userId: string,
    branchId: string,
  ): Promise<readonly (typeof favorites.$inferSelect)[]>;
}

/** Creates ranked-favorite reads while leaving replacement decisions to the domain layer. */
export function createFavoritesRepository(
  database: RepositoryDatabase,
): FavoritesRepository {
  return {
    listForUserAndBranch: (userId, branchId) =>
      database
        .select()
        .from(favorites)
        .where(
          and(eq(favorites.userId, userId), eq(favorites.branchId, branchId)),
        )
        .orderBy(asc(favorites.rank)),
  };
}
