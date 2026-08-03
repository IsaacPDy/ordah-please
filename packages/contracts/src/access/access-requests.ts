import type {
  AdminAccessRequestId,
  GroupId,
  UserId,
  UtcTimestamp,
} from "@ordah-please/domain";

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

export type AdminAccessDecision = "approved" | "rejected";

export type DecideAdminAccessRequestRequest = Readonly<{
  requestId: AdminAccessRequestId;
  decision: AdminAccessDecision;
  reason?: string;
}>;

export type AdminAccessRequestSummary = Readonly<{
  id: AdminAccessRequestId;
  requesterUserId: UserId;
  requesterDisplayName: string;
  groupId: GroupId;
  groupName: string;
  status: "pending";
  createdAt: UtcTimestamp;
}>;

export type ListPendingAdminAccessRequestsResponse = Readonly<{
  requests: readonly AdminAccessRequestSummary[];
}>;

/** Validates the body of a platform-admin's decide action on a pending request. */
export function parseDecideAdminAccessRequestRequest(
  value: unknown,
): DecideAdminAccessRequestRequest {
  const object = parseStrictObject(value, "Admin access decision request");
  rejectUnknownFields(
    object,
    ["requestId", "decision", "reason"],
    "Admin access decision request",
  );
  const requestId = parseRecordId<AdminAccessRequestId>(
    object.requestId,
    "Admin access request id",
  );
  if (object.decision !== "approved" && object.decision !== "rejected") {
    throw new TypeError("Admin access decision must be approved or rejected.");
  }
  const decision: AdminAccessDecision = object.decision;
  let reason: string | undefined;
  if (object.reason !== undefined) {
    if (typeof object.reason !== "string") {
      throw new TypeError("Admin access decision reason must be a string.");
    }
    const trimmed = object.reason.trim();
    if (trimmed === "") {
      throw new TypeError("Admin access decision reason must not be empty.");
    }
    if (trimmed.length > 500) {
      throw new TypeError(
        "Admin access decision reason must be at most 500 characters.",
      );
    }
    reason = trimmed;
  }
  return reason === undefined
    ? { requestId, decision }
    : { requestId, decision, reason };
}

/** Validates the typed list returned to a platform-admin deciding pending requests. */
export function parseListPendingAdminAccessRequestsResponse(
  value: unknown,
): ListPendingAdminAccessRequestsResponse {
  const object = parseStrictObject(
    value,
    "List pending admin access requests response",
  );
  rejectUnknownFields(
    object,
    ["requests"],
    "List pending admin access requests response",
  );
  if (!Array.isArray(object.requests)) {
    throw new TypeError("Pending admin access requests must be an array.");
  }
  const requests = object.requests.map((entry) => {
    const row = parseStrictObject(
      entry,
      "Pending admin access request summary",
    );
    rejectUnknownFields(
      row,
      [
        "id",
        "requesterUserId",
        "requesterDisplayName",
        "groupId",
        "groupName",
        "status",
        "createdAt",
      ],
      "Pending admin access request summary",
    );
    if (row.status !== "pending") {
      throw new TypeError(
        "Pending admin access request status must be pending.",
      );
    }
    return {
      id: parseRecordId<AdminAccessRequestId>(
        row.id,
        "Admin access request id",
      ),
      requesterUserId: parseRecordId<UserId>(
        row.requesterUserId,
        "Requester user id",
      ),
      requesterDisplayName: parseString(
        row.requesterDisplayName,
        "Requester display name",
      ),
      groupId: parseRecordId<GroupId>(row.groupId, "Group id"),
      groupName: parseString(row.groupName, "Group name"),
      status: "pending" as const,
      createdAt: parseUtcString(row.createdAt, "Request created at"),
    };
  });
  return { requests };
}
