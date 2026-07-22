import { fileRecords } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface FilesRepository {
  create(
    input: typeof fileRecords.$inferInsert,
  ): Promise<typeof fileRecords.$inferSelect>;
}

/** Creates file-metadata writes while object transfer remains owned by the storage package. */
export function createFilesRepository(
  database: RepositoryDatabase,
): FilesRepository {
  return {
    create: async (input) =>
      requireWrittenRow(
        await database.insert(fileRecords).values(input).returning(),
      ),
  };
}
