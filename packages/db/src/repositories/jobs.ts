import { eq } from "drizzle-orm";

import { jobs } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface JobsRepository {
  create(input: typeof jobs.$inferInsert): Promise<typeof jobs.$inferSelect>;
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<typeof jobs.$inferSelect | undefined>;
}

/** Creates durable job operations while scheduling and retry policy remain outside persistence. */
export function createJobsRepository(
  database: RepositoryDatabase,
): JobsRepository {
  return {
    create: async (input) =>
      requireWrittenRow(await database.insert(jobs).values(input).returning()),
    findByIdempotencyKey: async (idempotencyKey) => {
      const [job] = await database
        .select()
        .from(jobs)
        .where(eq(jobs.idempotencyKey, idempotencyKey))
        .limit(1);
      return job;
    },
  };
}
