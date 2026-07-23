import { PublicApiError } from "@ordah-please/contracts";
import type { IdentityAccessRepository } from "@ordah-please/db";
import {
  parseId,
  type ApplicationRole,
  type GroupId,
  type UserId,
} from "@ordah-please/domain";

export type IdentityReader = Pick<
  IdentityAccessRepository,
  "findUserByClerkId" | "listActiveMemberships"
>;

export interface AppIdentity {
  readonly clerkUserId: string;
  readonly groupId?: GroupId;
  readonly roles: readonly ApplicationRole[];
  readonly userId: UserId;
}

const MEMBERSHIP_ROLE_MAP = {
  member: "member",
  organizer: "organizer",
  owner: "group-owner",
} as const satisfies Readonly<Record<string, ApplicationRole>>;

/** Loads the internal Neon identity required before any product authorization decision. */
export async function loadAppIdentity(
  clerkUserId: string,
  repository: IdentityReader,
): Promise<AppIdentity> {
  const user = await repository.findUserByClerkId(clerkUserId);
  if (user === undefined || user.archivedAt !== null) {
    throw new PublicApiError("UNAVAILABLE", "Your account is not ready yet.");
  }

  const [membership] = await repository.listActiveMemberships(user.id);
  const roles: ApplicationRole[] = [];
  if (membership !== undefined) {
    roles.push(MEMBERSHIP_ROLE_MAP[membership.role]);
  }
  if (user.isPlatformAdmin) {
    roles.push("platform-admin");
  }

  const baseIdentity = {
    clerkUserId,
    roles,
    userId: parseId<UserId>(user.id),
  };
  if (membership === undefined) {
    return baseIdentity;
  }

  return {
    ...baseIdentity,
    groupId: parseId<GroupId>(membership.groupId),
  };
}
