import { and, eq } from "drizzle-orm";

import { menuVersions } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";

export interface CatalogRepository {
  findPublishedMenuVersion(
    branchId: string,
  ): Promise<typeof menuVersions.$inferSelect | undefined>;
}

/** Creates read operations for versioned catalog records without deciding publication policy. */
export function createCatalogRepository(
  database: RepositoryDatabase,
): CatalogRepository {
  return {
    findPublishedMenuVersion: async (branchId) => {
      const [menuVersion] = await database
        .select()
        .from(menuVersions)
        .where(
          and(
            eq(menuVersions.branchId, branchId),
            eq(menuVersions.status, "published"),
          ),
        )
        .limit(1);
      return menuVersion;
    },
  };
}
