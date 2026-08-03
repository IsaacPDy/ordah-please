import type { GroupId } from "@ordah-please/domain";

import {
  parseArray,
  parseBoolean,
  parseEnum,
  parseNonNegativeInteger,
  parseRecordId,
  parseStrictObject,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

const GROUP_MEMBERSHIP_ROLES = ["group-owner", "manager", "member"] as const;

export type AppIdentitySummary = Readonly<{
  isPlatformAdmin: boolean;
  memberships: readonly Readonly<{
    groupId: GroupId;
    role: (typeof GROUP_MEMBERSHIP_ROLES)[number];
  }>[];
  pendingAdminRequestCount: number;
}>;

/** Parses one group-scoped role entry from the authenticated identity response. */
function parseGroupMembership(
  value: unknown,
): AppIdentitySummary["memberships"][number] {
  const object = parseStrictObject(value, "Identity membership");
  rejectUnknownFields(object, ["groupId", "role"], "Identity membership");

  return {
    groupId: parseRecordId<GroupId>(object.groupId, "Identity group id"),
    role: parseEnum(
      object.role,
      GROUP_MEMBERSHIP_ROLES,
      "Identity membership role",
    ),
  };
}

/** Validates the minimal authenticated identity shared by web and native clients. */
export function parseAppIdentitySummary(value: unknown): AppIdentitySummary {
  const object = parseStrictObject(value, "App identity summary");
  rejectUnknownFields(
    object,
    ["isPlatformAdmin", "memberships", "pendingAdminRequestCount"],
    "App identity summary",
  );
  const memberships = parseArray(
    object.memberships,
    "Identity memberships",
    parseGroupMembership,
  );
  const uniqueGroupIds = new Set(memberships.map(({ groupId }) => groupId));
  if (uniqueGroupIds.size !== memberships.length) {
    throw new TypeError("Identity memberships contain a duplicate group id.");
  }

  return {
    isPlatformAdmin: parseBoolean(
      object.isPlatformAdmin,
      "Platform Admin state",
    ),
    memberships,
    pendingAdminRequestCount: parseNonNegativeInteger(
      object.pendingAdminRequestCount,
      "Pending admin request count",
    ),
  };
}
