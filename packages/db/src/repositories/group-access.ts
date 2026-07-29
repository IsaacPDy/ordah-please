import { and, asc, eq, isNull } from "drizzle-orm";

import {
  adminAccessRequests,
  invitations,
  memberships,
  users,
} from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface GroupAccessRepository {
  acceptInvitation(
    invitationId: string,
    userId: string,
    acceptedAt: Date,
  ): Promise<boolean>;
  createAdminAccessRequest(
    input: typeof adminAccessRequests.$inferInsert,
  ): Promise<typeof adminAccessRequests.$inferSelect>;
  createInvitation(
    input: typeof invitations.$inferInsert,
  ): Promise<typeof invitations.$inferSelect>;
  findInvitationByTokenHash(
    tokenHash: string,
  ): Promise<typeof invitations.$inferSelect | undefined>;
  findPendingAdminAccessRequest(
    requesterUserId: string,
  ): Promise<typeof adminAccessRequests.$inferSelect | undefined>;
  listActiveMembers(groupId: string): Promise<
    readonly {
      readonly displayName: string;
      readonly role: typeof memberships.$inferSelect.role;
      readonly userId: string;
    }[]
  >;
  removeMembership(
    groupId: string,
    userId: string,
    removedAt: Date,
  ): Promise<boolean>;
  setMembershipRole(
    groupId: string,
    userId: string,
    expectedRole: typeof memberships.$inferSelect.role,
    role: typeof memberships.$inferSelect.role,
  ): Promise<boolean>;
}

/** Creates private-group invitation persistence without deciding who is authorized to use it. */
export function createGroupAccessRepository(
  database: RepositoryDatabase,
): GroupAccessRepository {
  return {
    acceptInvitation: async (invitationId, userId, acceptedAt) => {
      const [accepted] = await database
        .update(invitations)
        .set({ acceptedAt, acceptedByUserId: userId })
        .where(
          and(eq(invitations.id, invitationId), isNull(invitations.acceptedAt)),
        )
        .returning({ id: invitations.id });
      return accepted !== undefined;
    },
    createInvitation: async (input) =>
      requireWrittenRow(
        await database.insert(invitations).values(input).returning(),
      ),
    createAdminAccessRequest: async (input) =>
      requireWrittenRow(
        await database.insert(adminAccessRequests).values(input).returning(),
      ),
    findInvitationByTokenHash: async (tokenHash) => {
      const [invitation] = await database
        .select()
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .limit(1);
      return invitation;
    },
    findPendingAdminAccessRequest: async (requesterUserId) => {
      const [request] = await database
        .select()
        .from(adminAccessRequests)
        .where(
          and(
            eq(adminAccessRequests.requesterUserId, requesterUserId),
            eq(adminAccessRequests.status, "pending"),
          ),
        )
        .limit(1);
      return request;
    },
    listActiveMembers: (groupId) =>
      database
        .select({
          displayName: users.displayName,
          role: memberships.role,
          userId: users.id,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(eq(memberships.groupId, groupId), isNull(memberships.removedAt)),
        )
        .orderBy(asc(users.displayName)),
    removeMembership: async (groupId, userId, removedAt) => {
      const [removed] = await database
        .update(memberships)
        .set({ removedAt })
        .where(
          and(
            eq(memberships.groupId, groupId),
            eq(memberships.userId, userId),
            isNull(memberships.removedAt),
          ),
        )
        .returning({ userId: memberships.userId });
      return removed !== undefined;
    },
    setMembershipRole: async (groupId, userId, expectedRole, role) => {
      const [updated] = await database
        .update(memberships)
        .set({ role })
        .where(
          and(
            eq(memberships.groupId, groupId),
            eq(memberships.userId, userId),
            eq(memberships.role, expectedRole),
            isNull(memberships.removedAt),
          ),
        )
        .returning({ userId: memberships.userId });
      return updated !== undefined;
    },
  };
}
