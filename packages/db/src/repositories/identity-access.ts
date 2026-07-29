import { and, eq, isNull } from "drizzle-orm";

import { memberships, users } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface AuthIdentityInput {
  readonly authUserId: string;
  readonly displayName: string;
}

export interface IdentityAccessRepository {
  addMembership(
    input: typeof memberships.$inferInsert,
  ): Promise<typeof memberships.$inferSelect>;
  createUser(
    input: typeof users.$inferInsert,
  ): Promise<typeof users.$inferSelect>;
  ensureUserForAuthIdentity(
    input: AuthIdentityInput,
  ): Promise<typeof users.$inferSelect>;
  findUserByAuthUserId(
    authUserId: string,
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
    ensureUserForAuthIdentity: async (input) => {
      const [writtenUser] = await database
        .insert(users)
        .values(input)
        .onConflictDoUpdate({
          set: {
            displayName: input.displayName,
            updatedAt: new Date(),
          },
          target: users.authUserId,
        })
        .returning();

      return requireWrittenRow(writtenUser === undefined ? [] : [writtenUser]);
    },
    findUserByAuthUserId: async (authUserId) => {
      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.authUserId, authUserId))
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
