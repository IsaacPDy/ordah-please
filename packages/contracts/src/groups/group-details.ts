import type {
  GroupDetails,
  GroupInviteLinkSummary,
  GroupMemberSummary,
  GroupId,
  UserId,
} from "@ordah-please/domain";
import { GROUP_DETAIL_ROLES } from "@ordah-please/domain";

import {
  parseArray,
  parseEnum,
  parseRecordId,
  parseStrictObject,
  parseString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

/** Parses one member entry in a Group details response. */
function parseGroupMember(value: unknown): GroupMemberSummary {
  const object = parseStrictObject(value, "Group member");
  rejectUnknownFields(object, ["userId", "displayName", "role"], "Group member");

  return {
    userId: parseRecordId<UserId>(object.userId, "Group member user id"),
    displayName: parseString(object.displayName, "Group member display name"),
    role: parseEnum(object.role, GROUP_DETAIL_ROLES, "Group member role"),
  };
}

/** Parses the invite-link section of a Group details response. */
function parseInviteLink(value: unknown): GroupInviteLinkSummary {
  const object = parseStrictObject(value, "Group invite link");
  rejectUnknownFields(
    object,
    ["publicValue", "tokenPrefix"],
    "Group invite link",
  );

  return {
    publicValue: parseString(object.publicValue, "Group invite link public value"),
    tokenPrefix: parseString(object.tokenPrefix, "Group invite link prefix"),
  };
}

/** Validates the Group details response shared by web and native clients. */
export function parseGroupDetailsResponse(value: unknown): GroupDetails {
  const object = parseStrictObject(value, "Group details");
  rejectUnknownFields(
    object,
    ["groupId", "name", "viewerRole", "owner", "members", "inviteLink"],
    "Group details",
  );

  const ownerObject = parseStrictObject(object.owner, "Group owner");
  rejectUnknownFields(ownerObject, ["userId", "displayName"], "Group owner");

  const viewerRole = parseEnum(
    object.viewerRole,
    GROUP_DETAIL_ROLES,
    "Group viewer role",
  );
  const inviteLink =
    object.inviteLink === undefined ? undefined : parseInviteLink(object.inviteLink);

  return {
    groupId: parseRecordId<GroupId>(object.groupId, "Group id"),
    name: parseString(object.name, "Group name"),
    viewerRole,
    owner: {
      userId: parseRecordId<UserId>(ownerObject.userId, "Group owner user id"),
      displayName: parseString(ownerObject.displayName, "Group owner display name"),
    },
    members: parseArray(object.members, "Group members", parseGroupMember),
    ...(inviteLink === undefined ? {} : { inviteLink }),
  };
}
