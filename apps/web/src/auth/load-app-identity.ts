import { PublicApiError } from "@ordah-please/contracts";
import type {
  AuthIdentityInput,
  IdentityAccessRepository,
} from "@ordah-please/db";
import {
  parseId,
  type ApplicationRole,
  type GroupId,
  type UserId,
} from "@ordah-please/domain";

export type IdentityReader = Pick<
  IdentityAccessRepository,
  "ensureUserForAuthIdentity" | "listActiveMemberships"
>;

export interface AppIdentity {
  readonly authUserId: string;
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
  authIdentity: AuthIdentityInput,
  repository: IdentityReader,
): Promise<AppIdentity> {
  const user = await repository.ensureUserForAuthIdentity(authIdentity);
  if (user.archivedAt !== null) {
    throw new PublicApiError("UNAVAILABLE", "Your account is not available.");
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
    authUserId: authIdentity.authUserId,
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
