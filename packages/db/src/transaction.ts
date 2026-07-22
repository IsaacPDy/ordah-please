import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgTransaction } from "drizzle-orm/node-postgres";

import type { Database } from "./client.js";
import * as schema from "./schema/index.js";

export type DatabaseTransaction = NodePgTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/** Runs a multi-record operation atomically so every write commits or every write rolls back. */
export async function withTransaction<TResult>(
  database: Database,
  operation: (transaction: DatabaseTransaction) => Promise<TResult>,
): Promise<TResult> {
  return database.transaction(operation);
}
