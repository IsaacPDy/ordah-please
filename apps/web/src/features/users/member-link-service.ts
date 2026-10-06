import { PublicApiError } from "@ordah-please/contracts";

export interface MemberLinkOperations {
  requireAdmin(actorUserId: string): Promise<void>;
  createMember(displayName: string): Promise<{ id: string }>;
  linkMember(memberUserId: string, accountUserId: string): Promise<void>;
  appendAudit(
    actorUserId: string,
    action: string,
    userId: string,
    details: Readonly<Record<string, unknown>>,
  ): Promise<void>;
}

/** Called inside one transaction, including the authorization check and audit. */
export async function createMemberAsAdmin(
  actorUserId: string,
  displayName: string,
  operations: MemberLinkOperations,
) {
  await operations.requireAdmin(actorUserId);
  const name = displayName.trim();
  if (name.length === 0 || name.length > 120) {
    throw new PublicApiError(
      "INVALID_INPUT",
      "Enter a name between 1 and 120 characters.",
    );
  }
  const member = await operations.createMember(name);
  await operations.appendAudit(
    actorUserId,
    "admin.create_member",
    member.id,
    {},
  );
  return { userId: member.id };
}

export async function linkMemberAsAdmin(
  actorUserId: string,
  memberUserId: string,
  accountUserId: string,
  operations: MemberLinkOperations,
) {
  await operations.requireAdmin(actorUserId);
  if (memberUserId === accountUserId) {
    throw new PublicApiError(
      "INVALID_INPUT",
      "Choose a separate signed-in account.",
    );
  }
  await operations.linkMember(memberUserId, accountUserId);
  await operations.appendAudit(
    actorUserId,
    "admin.link_member",
    accountUserId,
    { memberUserId },
  );
  return { userId: accountUserId };
}
