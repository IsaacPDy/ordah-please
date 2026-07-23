import { and, asc, eq } from "drizzle-orm";

import { auditEvents } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface AuditEventsRepository {
  append(
    input: typeof auditEvents.$inferInsert,
  ): Promise<typeof auditEvents.$inferSelect>;
  appendOnce(
    input: typeof auditEvents.$inferInsert & {
      readonly idempotencyKey: string;
    },
  ): Promise<typeof auditEvents.$inferSelect | undefined>;
  listForResource(
    resourceType: string,
    resourceId: string,
  ): Promise<readonly (typeof auditEvents.$inferSelect)[]>;
}

/** Creates append-and-read audit operations without interpreting whether an action is allowed. */
export function createAuditEventsRepository(
  database: RepositoryDatabase,
): AuditEventsRepository {
  return {
    append: async (input) =>
      requireWrittenRow(
        await database.insert(auditEvents).values(input).returning(),
      ),
    appendOnce: async (input) => {
      const [auditEvent] = await database
        .insert(auditEvents)
        .values(input)
        .onConflictDoNothing({ target: auditEvents.idempotencyKey })
        .returning();
      return auditEvent;
    },
    listForResource: (resourceType, resourceId) =>
      database
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.resourceType, resourceType),
            eq(auditEvents.resourceId, resourceId),
          ),
        )
        .orderBy(asc(auditEvents.createdAt)),
  };
}
