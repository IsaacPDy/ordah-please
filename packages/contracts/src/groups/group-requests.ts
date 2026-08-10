import type { UserId } from "@ordah-please/domain";
import { validateGroupName } from "@ordah-please/domain";

import {
  parseRecordId,
  parseStrictObject,
  parseString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

export type RenameGroupRequest = Readonly<{ name: string }>;

export type CreateGroupRequest = Readonly<{
  name: string;
  ownerId: UserId;
}>;

export type RotateInviteLinkResponse = Readonly<{
  publicValue: string;
  tokenPrefix: string;
}>;

export type AcceptInviteLinkRequest = Readonly<{
  publicValue: string;
}>;

/** Validates the rename group request body shared by web and native clients. */
export function parseRenameGroupRequest(value: unknown): RenameGroupRequest {
  const object = parseStrictObject(value, "Rename group request");
  rejectUnknownFields(object, ["name"], "Rename group request");

  return { name: validateGroupName(parseString(object.name, "Group name")) };
}

/** Validates the create group request body sent by Platform Admins. */
export function parseCreateGroupRequest(value: unknown): CreateGroupRequest {
  const object = parseStrictObject(value, "Create group request");
  rejectUnknownFields(object, ["name", "ownerId"], "Create group request");

  return {
    name: validateGroupName(parseString(object.name, "Group name")),
    ownerId: parseRecordId<UserId>(object.ownerId, "Group owner id"),
  };
}

/** Validates the rotate-invite-link response shared by web and native clients. */
export function parseRotateInviteLinkResponse(
  value: unknown,
): RotateInviteLinkResponse {
  const object = parseStrictObject(value, "Rotate invite link response");
  rejectUnknownFields(
    object,
    ["publicValue", "tokenPrefix"],
    "Rotate invite link response",
  );

  return {
    publicValue: parseString(
      object.publicValue,
      "Invite link public value",
    ),
    tokenPrefix: parseString(object.tokenPrefix, "Invite link prefix"),
  };
}

/** Validates the invite-link acceptance request body. */
export function parseAcceptInviteLinkRequest(
  value: unknown,
): AcceptInviteLinkRequest {
  const object = parseStrictObject(value, "Accept invite link request");
  rejectUnknownFields(object, ["publicValue"], "Accept invite link request");

  return {
    publicValue: parseString(object.publicValue, "Invite link public value"),
  };
}
