import type { GroupId, UserId } from "../types/ids.js";

export const GROUP_NAME_MAX_LENGTH = 60;

export const GROUP_DETAIL_ROLES = [
  "group-owner",
  "manager",
  "member",
] as const;

export type GroupDetailRole = (typeof GROUP_DETAIL_ROLES)[number];

/** Trims and validates a proposed group name; throws on empty or too-long input. */
export function validateGroupName(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Group name is required.");
  }
  if (trimmed.length > GROUP_NAME_MAX_LENGTH) {
    throw new Error(
      `Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters.`,
    );
  }
  return trimmed;
}

export interface GroupMemberSummary {
  readonly userId: UserId;
  readonly displayName: string;
  readonly role: GroupDetailRole;
}

export interface GroupOwnerSummary {
  readonly userId: UserId;
  readonly displayName: string;
}

export interface GroupInviteLinkSummary {
  readonly publicValue: string;
  readonly tokenPrefix: string;
}

export interface GroupDetails {
  readonly groupId: GroupId;
  readonly name: string;
  readonly viewerRole: GroupDetailRole;
  readonly owner: GroupOwnerSummary;
  readonly members: readonly GroupMemberSummary[];
  readonly inviteLink?: GroupInviteLinkSummary;
}
