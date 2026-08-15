import type { GroupId } from "@ordah-please/domain";

import {
  parseRecordId,
  parseStrictObject,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

export type AddUserToGroupRequest = Readonly<{ groupId: GroupId }>;

/** Validates the body of POST /api/admin/users/[userId]/memberships. */
export function parseAddUserToGroupRequest(
  value: unknown,
): AddUserToGroupRequest {
  const object = parseStrictObject(value, "Add user to group request");
  rejectUnknownFields(object, ["groupId"], "Add user to group request");

  return { groupId: parseRecordId<GroupId>(object.groupId, "Group id") };
}
