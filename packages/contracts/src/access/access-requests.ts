import type { UserId, UtcTimestamp } from "@ordah-please/domain";

import {
  parseRecordId,
  parseStrictObject,
  parseString,
  parseUtcString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

export type AcceptInvitationRequest = Readonly<{ token: string }>;
export type IssueInvitationRequest = Readonly<{ expiresAt: UtcTimestamp }>;
export type MemberActionRequest = Readonly<{ userId: UserId }>;
export type CreateAdminAccessRequest = Readonly<Record<string, never>>;

/** Validates the public token submitted by an authenticated invitation recipient. */
export function parseAcceptInvitationRequest(
  value: unknown,
): AcceptInvitationRequest {
  const object = parseStrictObject(value, "Invitation acceptance request");
  rejectUnknownFields(object, ["token"], "Invitation acceptance request");
  return { token: parseString(object.token, "Invitation token") };
}

/** Validates the expiry selected by a group owner issuing an invitation. */
export function parseIssueInvitationRequest(
  value: unknown,
): IssueInvitationRequest {
  const object = parseStrictObject(value, "Invitation issue request");
  rejectUnknownFields(object, ["expiresAt"], "Invitation issue request");
  return {
    expiresAt: parseUtcString(object.expiresAt, "Invitation expiry"),
  };
}

/** Validates the member targeted by an owner role or removal action. */
export function parseMemberActionRequest(value: unknown): MemberActionRequest {
  const object = parseStrictObject(value, "Member action request");
  rejectUnknownFields(object, ["userId"], "Member action request");
  return {
    userId: parseRecordId<UserId>(object.userId, "Target member id"),
  };
}

/** Requires admin-access submission to carry no client-controlled decision fields. */
export function parseCreateAdminAccessRequest(
  value: unknown,
): CreateAdminAccessRequest {
  const object = parseStrictObject(value, "Admin access request");
  rejectUnknownFields(object, [], "Admin access request");
  return {};
}
