import { notifications } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface NotificationsRepository {
  create(
    input: typeof notifications.$inferInsert,
  ): Promise<typeof notifications.$inferSelect>;
}

/** Creates notification records without contacting or selecting a delivery provider. */
export function createNotificationsRepository(
  database: RepositoryDatabase,
): NotificationsRepository {
  return {
    create: async (input) =>
      requireWrittenRow(
        await database.insert(notifications).values(input).returning(),
      ),
  };
}
