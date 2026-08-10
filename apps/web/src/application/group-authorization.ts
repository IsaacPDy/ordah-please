import { PublicApiError } from "@ordah-please/contracts";
import type { GroupId } from "@ordah-please/domain";

import type {
  AppIdentity,
  GroupMembershipIdentity,
} from "../auth/load-app-identity";

const FORBIDDEN_MESSAGE = "You do not have access to this action.";

/** Finds the authenticated user's active membership for exactly one requested group. */
export function findGroupMembership(
  identity: AppIdentity,
  groupId: GroupId,
): GroupMembershipIdentity | undefined {
  return identity.memberships.find(
    (membership) => membership.groupId === groupId,
  );
}

/** Returns the requested-group membership for any role, or throws FORBIDDEN if the viewer is not in the group. */
export function requireGroupMembership(
  identity: AppIdentity,
  groupId: GroupId,
): GroupMembershipIdentity {
  const membership = findGroupMembership(identity, groupId);
  if (membership === undefined) {
    throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
  }
  return membership;
}

/** Returns the requested-group membership only when its role is explicitly allowed. */
export function requireGroupRole(
  identity: AppIdentity,
  groupId: GroupId,
  allowedRoles: readonly GroupMembershipIdentity["role"][],
): GroupMembershipIdentity {
  const membership = findGroupMembership(identity, groupId);
  if (membership === undefined || !allowedRoles.includes(membership.role)) {
    throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
  }
  return membership;
}
