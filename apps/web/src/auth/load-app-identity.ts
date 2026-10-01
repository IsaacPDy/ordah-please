import { PublicApiError } from "@ordah-please/contracts";
import type {
  AuthIdentityInput,
  IdentityAccessRepository,
} from "@ordah-please/db";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

export type IdentityReader = Pick<
  IdentityAccessRepository,
  "ensureUserForAuthIdentity" | "findIdentityByAuthUserId"
>;

export interface GroupMembershipIdentity {
  readonly groupId: GroupId;
  readonly role: "group-owner" | "manager" | "member";
}

export interface AppIdentity {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
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
  let row = await repository.findIdentityByAuthUserId(authIdentity.authUserId);
  if (row !== undefined && row.user.archivedAt !== null) {
    throw new PublicApiError("UNAVAILABLE", "Your account is not available.");
  }
  if (row === undefined || row.user.displayName !== authIdentity.displayName) {
    await repository.ensureUserForAuthIdentity(authIdentity);
    row = await repository.findIdentityByAuthUserId(authIdentity.authUserId);
  }
  if (row === undefined || row.user.archivedAt !== null) {
    throw new PublicApiError("UNAVAILABLE", "Your account is not available.");
  }
  const { user } = row;

  const memberships = row.memberships
    .map((membership) => ({
      groupId: parseId<GroupId>(membership.groupId),
      role: MEMBERSHIP_ROLE_MAP[membership.role],
    }))
    .sort((left, right) => left.groupId.localeCompare(right.groupId));

  return {
    authUserId: authIdentity.authUserId,
    displayName: authIdentity.displayName,
    email: authIdentity.email,
    imageUrl: authIdentity.imageUrl,
    isPlatformAdmin: user.isPlatformAdmin,
    memberships,
    userId: parseId<UserId>(user.id),
  };
}
