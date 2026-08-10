import { and, asc, eq, isNull } from "drizzle-orm";

import {
  adminAccessRequests,
  groupInviteLinks,
  groups,
  invitations,
  memberships,
  users,
} from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface AdminAccessDecisionInput {
  readonly requestId: string;
  readonly decision: "approved" | "rejected";
  readonly decidedByUserId: string;
  readonly decidedAt: Date;
  readonly reason?: string;
}

export interface PendingAdminAccessRequestRow {
  readonly id: string;
  readonly requesterUserId: string;
  readonly requesterDisplayName: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly status: "pending" | "approved" | "rejected";
  readonly createdAt: Date;
}

export interface GroupSummaryRow {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string | null;
}

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
  createGroup(
    input: { name: string; createdByUserId: string },
  ): Promise<typeof groups.$inferSelect>;
  createInviteLink(
    input: typeof groupInviteLinks.$inferInsert,
  ): Promise<typeof groupInviteLinks.$inferSelect>;
  decideAdminAccessRequest(
    input: AdminAccessDecisionInput,
  ): Promise<typeof adminAccessRequests.$inferSelect>;
  findActiveInviteLinkByHash(
    tokenHash: string,
  ): Promise<typeof groupInviteLinks.$inferSelect | undefined>;
  findActiveInviteLinkForGroup(
    groupId: string,
  ): Promise<typeof groupInviteLinks.$inferSelect | undefined>;
  findAdminAccessRequestById(
    requestId: string,
  ): Promise<typeof adminAccessRequests.$inferSelect | undefined>;
  findGroupSummary(groupId: string): Promise<GroupSummaryRow | undefined>;
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
  listPendingAdminAccessRequests(): Promise<
    readonly PendingAdminAccessRequestRow[]
  >;
  markInviteLinkRotated(linkId: string, rotatedAt: Date): Promise<boolean>;
  promoteToPlatformAdmin(userId: string): Promise<boolean>;
  removeMembership(
    groupId: string,
    userId: string,
    removedAt: Date,
  ): Promise<boolean>;
  renameGroup(input: {
    readonly groupId: string;
    readonly name: string;
  }): Promise<{ readonly id: string }>;
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
    createGroup: async (input) =>
      requireWrittenRow(
        await database
          .insert(groups)
          .values({
            name: input.name,
            createdByUserId: input.createdByUserId,
          })
          .returning(),
      ),
    createInviteLink: async (input) =>
      requireWrittenRow(
        await database.insert(groupInviteLinks).values(input).returning(),
      ),
    createAdminAccessRequest: async (input) =>
      requireWrittenRow(
        await database.insert(adminAccessRequests).values(input).returning(),
      ),
    decideAdminAccessRequest: async (input) => {
      const [updated] = await database
        .update(adminAccessRequests)
        .set({
          status: input.decision,
          decidedAt: input.decidedAt,
          decidedByUserId: input.decidedByUserId,
          decisionReason: input.reason ?? null,
        })
        .where(
          and(
            eq(adminAccessRequests.id, input.requestId),
            eq(adminAccessRequests.status, "pending"),
          ),
        )
        .returning();
      if (updated === undefined) {
        throw new Error("Admin access request is no longer pending.");
      }
      return updated;
    },
    findAdminAccessRequestById: async (requestId) => {
      const [row] = await database
        .select()
        .from(adminAccessRequests)
        .where(eq(adminAccessRequests.id, requestId))
        .limit(1);
      return row;
    },
    findInvitationByTokenHash: async (tokenHash) => {
      const [invitation] = await database
        .select()
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .limit(1);
      return invitation;
    },
    findActiveInviteLinkByHash: async (tokenHash) => {
      const [link] = await database
        .select()
        .from(groupInviteLinks)
        .where(
          and(
            eq(groupInviteLinks.tokenHash, tokenHash),
            eq(groupInviteLinks.status, "active"),
          ),
        )
        .limit(1);
      return link;
    },
    findActiveInviteLinkForGroup: async (groupId) => {
      const [link] = await database
        .select()
        .from(groupInviteLinks)
        .where(
          and(
            eq(groupInviteLinks.groupId, groupId),
            eq(groupInviteLinks.status, "active"),
          ),
        )
        .limit(1);
      return link;
    },
    findGroupSummary: async (groupId) => {
      const [row] = await database
        .select({
          id: groups.id,
          name: groups.name,
          ownerUserId: memberships.userId,
        })
        .from(groups)
        .leftJoin(
          memberships,
          and(
            eq(memberships.groupId, groups.id),
            eq(memberships.role, "owner"),
            isNull(memberships.removedAt),
          ),
        )
        .where(eq(groups.id, groupId))
        .limit(1);
      return row === undefined ? undefined : row;
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
    listPendingAdminAccessRequests: () =>
      database
        .select({
          createdAt: adminAccessRequests.createdAt,
          groupId: adminAccessRequests.groupId,
          groupName: groups.name,
          id: adminAccessRequests.id,
          requesterDisplayName: users.displayName,
          requesterUserId: adminAccessRequests.requesterUserId,
          status: adminAccessRequests.status,
        })
        .from(adminAccessRequests)
        .innerJoin(users, eq(users.id, adminAccessRequests.requesterUserId))
        .innerJoin(groups, eq(groups.id, adminAccessRequests.groupId))
        .where(eq(adminAccessRequests.status, "pending"))
        .orderBy(asc(adminAccessRequests.createdAt)),
    markInviteLinkRotated: async (linkId, rotatedAt) => {
      const [updated] = await database
        .update(groupInviteLinks)
        .set({ status: "rotated", rotatedAt })
        .where(
          and(
            eq(groupInviteLinks.id, linkId),
            eq(groupInviteLinks.status, "active"),
          ),
        )
        .returning({ id: groupInviteLinks.id });
      return updated !== undefined;
    },
    promoteToPlatformAdmin: async (userId) => {
      const [updated] = await database
        .update(users)
        .set({ isPlatformAdmin: true })
        .where(eq(users.id, userId))
        .returning({ id: users.id });
      return updated !== undefined;
    },
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
    renameGroup: async (input) =>
      requireWrittenRow(
        await database
          .update(groups)
          .set({ name: input.name, updatedAt: new Date() })
          .where(
            and(eq(groups.id, input.groupId), isNull(groups.archivedAt)),
          )
          .returning({ id: groups.id }),
      ),
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
