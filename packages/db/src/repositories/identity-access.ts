import { and, eq, isNull, lte } from "drizzle-orm";

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
  archiveUserByClerkId(
    clerkUserId: string,
    occurredAt: Date,
  ): Promise<typeof users.$inferSelect | undefined>;
  findUserByClerkId(
    clerkUserId: string,
  ): Promise<typeof users.$inferSelect | undefined>;
  listActiveMemberships(
    userId: string,
  ): Promise<readonly (typeof memberships.$inferSelect)[]>;
  upsertUserFromClerk(input: {
    readonly clerkUserId: string;
    readonly displayName: string;
    readonly updatedAt: Date;
  }): Promise<typeof users.$inferSelect>;
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
    archiveUserByClerkId: async (clerkUserId, occurredAt) => {
      const [writtenUser] = await database
        .insert(users)
        .values({
          archivedAt: occurredAt,
          clerkUserId,
          displayName: "Deleted member",
          updatedAt: occurredAt,
        })
        .onConflictDoUpdate({
          set: { archivedAt: occurredAt, updatedAt: occurredAt },
          target: users.clerkUserId,
          where: lte(users.updatedAt, occurredAt),
        })
        .returning();
      if (writtenUser !== undefined) {
        return writtenUser;
      }

      const [newerUser] = await database
        .select()
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1);
      return newerUser;
    },
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
    upsertUserFromClerk: async (input) => {
      const [writtenUser] = await database
        .insert(users)
        .values(input)
        .onConflictDoUpdate({
          set: {
            archivedAt: null,
            displayName: input.displayName,
            updatedAt: input.updatedAt,
          },
          target: users.clerkUserId,
          where: lte(users.updatedAt, input.updatedAt),
        })
        .returning();
      if (writtenUser !== undefined) {
        return writtenUser;
      }

      const [newerUser] = await database
        .select()
        .from(users)
        .where(eq(users.clerkUserId, input.clerkUserId))
        .limit(1);
      return requireWrittenRow(newerUser === undefined ? [] : [newerUser]);
    },
  };
}
