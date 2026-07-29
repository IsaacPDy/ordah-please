import { and, eq, isNull } from "drizzle-orm";

import { invitations } from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
import { requireWrittenRow } from "./rows.js";

export interface GroupAccessRepository {
  acceptInvitation(
    invitationId: string,
    userId: string,
    acceptedAt: Date,
  ): Promise<boolean>;
  createInvitation(
    input: typeof invitations.$inferInsert,
  ): Promise<typeof invitations.$inferSelect>;
  findInvitationByTokenHash(
    tokenHash: string,
  ): Promise<typeof invitations.$inferSelect | undefined>;
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
    findInvitationByTokenHash: async (tokenHash) => {
      const [invitation] = await database
        .select()
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .limit(1);
      return invitation;
    },
  };
}
