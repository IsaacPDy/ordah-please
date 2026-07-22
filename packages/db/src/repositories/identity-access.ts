import { and, eq, isNull } from "drizzle-orm";

import { memberships, users } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface IdentityAccessRepository {
  addMembership(
    input: typeof memberships.$inferInsert,
  ): Promise<typeof memberships.$inferSelect>;
  createUser(
    input: typeof users.$inferInsert,
  ): Promise<typeof users.$inferSelect>;
  findUserByClerkId(
    clerkUserId: string,
  ): Promise<typeof users.$inferSelect | undefined>;
  listActiveMemberships(
    userId: string,
  ): Promise<readonly (typeof memberships.$inferSelect)[]>;
}

/** Creates identity and access persistence operations without making permission decisions. */
export function createIdentityAccessRepository(
  database: RepositoryDatabase,
): IdentityAccessRepository {
  return {
    addMembership: async (input) =>
      requireWrittenRow(
        await database.insert(memberships).values(input).returning(),
      ),
    createUser: async (input) =>
      requireWrittenRow(await database.insert(users).values(input).returning()),
    findUserByClerkId: async (clerkUserId) => {
      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1);
      return user;
    },
    listActiveMemberships: (userId) =>
      database
        .select()
        .from(memberships)
        .where(
          and(eq(memberships.userId, userId), isNull(memberships.removedAt)),
        ),
  };
}
