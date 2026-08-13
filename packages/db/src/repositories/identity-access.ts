import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

import { authUsers, memberships, users } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

// authUserId/displayName are persisted to users; email/imageUrl pass through to AppIdentity (Better Auth owns them).
export interface AuthIdentityInput {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}

export interface UserMembershipSummaryRow {
  readonly groupId: string;
  readonly role: "owner" | "manager" | "member";
}

export interface UserSummaryRow {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly imageUrl: string | null;
  readonly isPlatformAdmin: boolean;
  readonly archivedAt: Date | null;
  readonly memberships: readonly UserMembershipSummaryRow[];
}

export interface IdentityAccessRepository {
  addMembership(
    input: typeof memberships.$inferInsert,
  ): Promise<typeof memberships.$inferSelect | undefined>;
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
  listUsers(): Promise<
    readonly { readonly id: string; readonly displayName: string }[]
  >;
  setPlatformAdminFlag(userId: string, value: boolean): Promise<boolean>;
  listUsersWithSummary(): Promise<readonly UserSummaryRow[]>;
}

/** Creates identity and access persistence operations without making permission decisions. */
export function createIdentityAccessRepository(
  database: RepositoryDatabase,
): IdentityAccessRepository {
  return {
    addMembership: async (input) => {
      const [membership] = await database
        .insert(memberships)
        .values(input)
        .onConflictDoUpdate({
          set: {
            joinedAt: input.joinedAt ?? new Date(),
            removedAt: null,
            role: input.role,
          },
          setWhere: isNotNull(memberships.removedAt),
          target: [memberships.groupId, memberships.userId],
        })
        .returning();

      return membership;
    },
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
        )
        .orderBy(asc(memberships.groupId)),
    listUsers: () =>
      database
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .orderBy(asc(users.displayName)),
    setPlatformAdminFlag: async (userId, value) => {
      const [updated] = await database
        .update(users)
        .set({ isPlatformAdmin: value })
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      return updated !== undefined;
    },
    listUsersWithSummary: async () => {
      const userRows = await database
        .select({
          archivedAt: users.archivedAt,
          displayName: users.displayName,
          email: authUsers.email,
          id: users.id,
          imageUrl: authUsers.image,
          isPlatformAdmin: users.isPlatformAdmin,
        })
        .from(users)
        .leftJoin(authUsers, eq(users.authUserId, authUsers.id))
        .where(isNull(users.archivedAt))
        .orderBy(asc(users.displayName));

      const membershipRows = await database
        .select({
          groupId: memberships.groupId,
          role: memberships.role,
          userId: memberships.userId,
        })
        .from(memberships)
        .where(isNull(memberships.removedAt));

      const membershipsByUser = new Map<
        string,
        { groupId: string; role: "owner" | "manager" | "member" }[]
      >();
      for (const membership of membershipRows) {
        const list = membershipsByUser.get(membership.userId);
        if (list === undefined) {
          membershipsByUser.set(membership.userId, [
            {
              groupId: membership.groupId,
              role: membership.role,
            },
          ]);
        } else {
          list.push({ groupId: membership.groupId, role: membership.role });
        }
      }

      return userRows.map((row) => ({
        archivedAt: row.archivedAt,
        displayName: row.displayName,
        email: row.email,
        id: row.id,
        imageUrl: row.imageUrl,
        isPlatformAdmin: row.isPlatformAdmin,
        memberships: membershipsByUser.get(row.id) ?? [],
      }));
    },
  };
}
