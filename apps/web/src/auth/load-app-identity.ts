import { PublicApiError } from "@ordah-please/contracts";
import type {
  AuthIdentityInput,
  IdentityAccessRepository,
} from "@ordah-please/db";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

export type IdentityReader = Pick<
  IdentityAccessRepository,
  "ensureUserForAuthIdentity" | "listActiveMemberships"
>;

export interface GroupMembershipIdentity {
  readonly groupId: GroupId;
  readonly role: "group-owner" | "manager" | "member";
}

export interface AppIdentity {
  readonly authUserId: string;
  readonly isPlatformAdmin: boolean;
  readonly memberships: readonly GroupMembershipIdentity[];
  readonly userId: UserId;
}

const MEMBERSHIP_ROLE_MAP = {
  member: "member",
  manager: "manager",
  owner: "group-owner",
} as const satisfies Readonly<Record<string, GroupMembershipIdentity["role"]>>;

/** Loads the internal Neon identity required before any product authorization decision. */
export async function loadAppIdentity(
  authIdentity: AuthIdentityInput,
  repository: IdentityReader,
): Promise<AppIdentity> {
  const user = await repository.ensureUserForAuthIdentity(authIdentity);
  if (user.archivedAt !== null) {
    throw new PublicApiError("UNAVAILABLE", "Your account is not available.");
  }

  const memberships = (await repository.listActiveMemberships(user.id))
    .map((membership) => ({
      groupId: parseId<GroupId>(membership.groupId),
      role: MEMBERSHIP_ROLE_MAP[membership.role],
    }))
    .sort((left, right) => left.groupId.localeCompare(right.groupId));

  return {
    authUserId: authIdentity.authUserId,
    isPlatformAdmin: user.isPlatformAdmin,
    memberships,
    userId: parseId<UserId>(user.id),
  };
}
