import { PublicApiError } from "@ordah-please/contracts";
import type {
  GroupDetails,
  GroupDetailRole,
  GroupId,
  GroupInviteLinkSummary,
  UserId,
} from "@ordah-please/domain";
import { parseId, validateGroupName } from "@ordah-please/domain";

import {
  hashPublicValue,
  mintInviteLink,
  type MintedInviteLink,
} from "./invite-link";

const MEMBERSHIP_ROLE_TO_DETAIL_ROLE: Readonly<
  Record<string, GroupDetailRole>
> = {
  manager: "manager",
  member: "member",
  owner: "group-owner",
};

interface GroupSummaryRow {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string | null;
}

interface ActiveMemberRow {
  readonly displayName: string;
  readonly role: "manager" | "member" | "owner";
  readonly userId: string;
}

interface InviteLinkRow {
  readonly id: string;
  readonly groupId: string;
  readonly tokenHash: string;
  readonly tokenPrefix: string;
}

interface GroupDetailsRepositories {
  readonly groupAccess: {
    findGroupSummary(groupId: string): Promise<GroupSummaryRow | undefined>;
    listActiveMembers(groupId: string): Promise<readonly ActiveMemberRow[]>;
    findActiveInviteLinkForGroup(
      groupId: string,
    ): Promise<InviteLinkRow | undefined>;
  };
}

interface GroupDetailsTransactionRunner {
  run<Result>(
    operation: (repositories: GroupDetailsRepositories) => Promise<Result>,
  ): Promise<Result>;
}

export interface LoadGroupDetailsCommand {
  readonly groupId: GroupId;
  readonly viewerRole: GroupDetailRole;
}

/** Reads one group's name, owner, active members, and (for owners) the active invite link. */
export async function loadGroupDetails(
  command: LoadGroupDetailsCommand,
  transactionRunner: GroupDetailsTransactionRunner,
): Promise<GroupDetails> {
  return transactionRunner.run(async (repositories) => {
    const summary = await repositories.groupAccess.findGroupSummary(
      command.groupId,
    );
    if (summary === undefined) {
      throw new PublicApiError(
        "NOT_FOUND",
        "This group could not be found.",
      );
    }
    const members = await repositories.groupAccess.listActiveMembers(
      command.groupId,
    );
    const ownerMember = members.find((member) => member.role === "owner");
    const ownerUserId =
      summary.ownerUserId ?? ownerMember?.userId ?? undefined;
    if (ownerUserId === undefined) {
      throw new PublicApiError(
        "UNAVAILABLE",
        "This group is not available right now.",
      );
    }
    const ownerDisplayName = ownerMember?.displayName ?? "";

    const inviteLink =
      command.viewerRole === "group-owner"
        ? mapInviteLink(
            await repositories.groupAccess.findActiveInviteLinkForGroup(
              command.groupId,
            ),
          )
        : undefined;

    return {
      groupId: parseId<GroupId>(summary.id),
      name: summary.name,
      viewerRole: command.viewerRole,
      owner: {
        userId: parseId<UserId>(ownerUserId),
        displayName: ownerDisplayName,
      },
      members: members.map((member) => ({
        userId: parseId<UserId>(member.userId),
        displayName: member.displayName,
        role: mapRole(member.role),
      })),
      ...(inviteLink === undefined ? {} : { inviteLink }),
    };
  });
}

function mapInviteLink(
  link: InviteLinkRow | undefined,
): GroupInviteLinkSummary | undefined {
  if (link === undefined) {
    return undefined;
  }
  // The stored hash is sha256 of the original public value. We surface it as the
  // publicValue field of the summary because the raw public value is never
  // persisted; the route handler treats this as an opaque display token.
  return {
    publicValue: link.tokenHash,
    tokenPrefix: link.tokenPrefix,
  };
}

function mapRole(role: ActiveMemberRow["role"]): GroupDetailRole {
  const mapped = MEMBERSHIP_ROLE_TO_DETAIL_ROLE[role];
  if (mapped === undefined) {
    throw new Error(`Unsupported membership role: ${role}`);
  }
  return mapped;
}

interface RenameGroupRepositories {
  readonly groupAccess: {
    renameGroup(input: {
      readonly groupId: string;
      readonly name: string;
    }): Promise<{ readonly id: string }>;
  };
  readonly auditEvents: {
    append(input: {
      readonly action: string;
      readonly actorUserId: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly resourceId: string;
      readonly resourceType: string;
    }): Promise<{ readonly id: string }>;
  };
}

interface RenameGroupTransactionRunner {
  run<Result>(
    operation: (repositories: RenameGroupRepositories) => Promise<Result>,
  ): Promise<Result>;
}

export interface RenameGroupCommand {
  readonly actorUserId: UserId;
  readonly groupId: GroupId;
  readonly name: string;
}

export interface RenameGroupResult {
  readonly groupId: GroupId;
  readonly name: string;
}

/** Owner-only rename: validates the name, updates the group row, and appends one audit event. */
export async function renameGroup(
  command: RenameGroupCommand,
  transactionRunner: RenameGroupTransactionRunner,
): Promise<RenameGroupResult> {
  const name = validateGroupName(command.name);
  return transactionRunner.run(async (repositories) => {
    await repositories.groupAccess.renameGroup({
      groupId: command.groupId,
      name,
    });
    await repositories.auditEvents.append({
      action: "group.renamed",
      actorUserId: command.actorUserId,
      details: { name },
      resourceId: command.groupId,
      resourceType: "group",
    });
    return { groupId: command.groupId, name };
  });
}

interface RotateInviteLinkRepositories {
  readonly groupAccess: {
    findActiveInviteLinkForGroup(
      groupId: string,
    ): Promise<InviteLinkRow | undefined>;
    markInviteLinkRotated(linkId: string, rotatedAt: Date): Promise<boolean>;
    createInviteLink(input: {
      readonly groupId: string;
      readonly tokenHash: string;
      readonly tokenPrefix: string;
      readonly createdByUserId: string;
      readonly status: "active";
    }): Promise<InviteLinkRow>;
  };
  readonly auditEvents: {
    append(input: {
      readonly action: string;
      readonly actorUserId: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly resourceId: string;
      readonly resourceType: string;
    }): Promise<{ readonly id: string }>;
  };
}

interface RotateInviteLinkTransactionRunner {
  run<Result>(
    operation: (
      repositories: RotateInviteLinkRepositories,
    ) => Promise<Result>,
  ): Promise<Result>;
}

export interface RotateInviteLinkCommand {
  readonly actorUserId: UserId;
  readonly groupId: GroupId;
  readonly now: Date;
}

export interface RotateInviteLinkResult {
  readonly publicValue: string;
  readonly tokenPrefix: string;
}

/** Owner-only invite-link rotation: retires the prior link, mints a new active link, audits both. */
export async function rotateInviteLink(
  command: RotateInviteLinkCommand,
  transactionRunner: RotateInviteLinkTransactionRunner,
  linkIssuer: () => MintedInviteLink = mintInviteLink,
): Promise<RotateInviteLinkResult> {
  return transactionRunner.run(async (repositories) => {
    const priorLink = await repositories.groupAccess.findActiveInviteLinkForGroup(
      command.groupId,
    );
    if (priorLink !== undefined) {
      await repositories.groupAccess.markInviteLinkRotated(
        priorLink.id,
        command.now,
      );
    }

    const minted = linkIssuer();
    await repositories.groupAccess.createInviteLink({
      groupId: command.groupId,
      tokenHash: minted.tokenHash,
      tokenPrefix: minted.tokenPrefix,
      createdByUserId: command.actorUserId,
      status: "active",
    });
    await repositories.auditEvents.append({
      action: "group.invite_link_rotated",
      actorUserId: command.actorUserId,
      details: {
        previousLinkId: priorLink?.id ?? null,
        tokenPrefix: minted.tokenPrefix,
      },
      resourceId: command.groupId,
      resourceType: "group",
    });

    return {
      publicValue: minted.publicValue,
      tokenPrefix: minted.tokenPrefix,
    };
  });
}

interface CreateGroupRepositories {
  readonly groupAccess: {
    createGroup(input: {
      readonly name: string;
      readonly createdByUserId: string;
    }): Promise<{ readonly id: string; readonly name: string }>;
    createInviteLink(input: {
      readonly groupId: string;
      readonly tokenHash: string;
      readonly tokenPrefix: string;
      readonly createdByUserId: string;
      readonly status: "active";
    }): Promise<InviteLinkRow>;
  };
  readonly identityAccess: {
    addMembership(input: {
      readonly groupId: string;
      readonly role: "owner";
      readonly userId: string;
    }): Promise<unknown>;
  };
  readonly auditEvents: {
    append(input: {
      readonly action: string;
      readonly actorUserId: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly resourceId: string;
      readonly resourceType: string;
    }): Promise<{ readonly id: string }>;
  };
}

interface CreateGroupTransactionRunner {
  run<Result>(
    operation: (repositories: CreateGroupRepositories) => Promise<Result>,
  ): Promise<Result>;
}

export interface CreateGroupCommand {
  readonly actorUserId: UserId;
  readonly name: string;
  readonly ownerId: UserId;
}

export interface CreateGroupResult {
  readonly groupId: GroupId;
  readonly name: string;
  readonly ownerId: UserId;
  readonly inviteLink: GroupInviteLinkSummary;
}

/** Platform-admin group creation: group row, owner membership, invite link, and audit rows in one transaction. */
export async function createGroup(
  command: CreateGroupCommand,
  transactionRunner: CreateGroupTransactionRunner,
  linkIssuer: () => MintedInviteLink = mintInviteLink,
): Promise<CreateGroupResult> {
  const name = validateGroupName(command.name);
  return transactionRunner.run(async (repositories) => {
    const group = await repositories.groupAccess.createGroup({
      name,
      createdByUserId: command.actorUserId,
    });
    await repositories.identityAccess.addMembership({
      groupId: group.id,
      role: "owner",
      userId: command.ownerId,
    });

    const minted = linkIssuer();
    await repositories.groupAccess.createInviteLink({
      groupId: group.id,
      tokenHash: minted.tokenHash,
      tokenPrefix: minted.tokenPrefix,
      createdByUserId: command.actorUserId,
      status: "active",
    });

    await repositories.auditEvents.append({
      action: "group.created",
      actorUserId: command.actorUserId,
      details: { name, ownerId: command.ownerId },
      resourceId: group.id,
      resourceType: "group",
    });
    await repositories.auditEvents.append({
      action: "group.invite_link_issued",
      actorUserId: command.actorUserId,
      details: { tokenPrefix: minted.tokenPrefix },
      resourceId: group.id,
      resourceType: "group",
    });

    return {
      groupId: parseId<GroupId>(group.id),
      name: group.name,
      ownerId: command.ownerId,
      inviteLink: {
        publicValue: minted.publicValue,
        tokenPrefix: minted.tokenPrefix,
      },
    };
  });
}

interface AcceptInviteLinkRepositories {
  readonly groupAccess: {
    findActiveInviteLinkByHash(tokenHash: string): Promise<
      | {
          readonly id: string;
          readonly groupId: string;
        }
      | undefined
    >;
  };
  readonly identityAccess: {
    listActiveMemberships(userId: string): Promise<readonly { readonly groupId: string }[]>;
    addMembership(input: {
      readonly groupId: string;
      readonly role: "owner" | "manager" | "member";
      readonly userId: string;
    }): Promise<{ readonly userId: string } | undefined>;
  };
  readonly auditEvents: {
    append(input: {
      readonly action: string;
      readonly actorUserId: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly resourceId: string;
      readonly resourceType: string;
    }): Promise<{ readonly id: string }>;
  };
}

interface AcceptInviteLinkTransactionRunner {
  run<Result>(
    operation: (repositories: AcceptInviteLinkRepositories) => Promise<Result>,
  ): Promise<Result>;
}

export interface AcceptInviteLinkCommand {
  readonly actorUserId: UserId;
  readonly now: Date;
  readonly publicValue: string;
}

const UNAVAILABLE_LINK_MESSAGE = "This invite link is no longer available.";

/** Accepts a persistent, multi-use invite link into one group membership, idempotently for the same user. */
export async function acceptInviteLink(
  command: AcceptInviteLinkCommand,
  transactionRunner: AcceptInviteLinkTransactionRunner,
  hashValue: (publicValue: string) => string = hashPublicValue,
): Promise<{ readonly groupId: string; readonly role: "member" }> {
  const tokenHash = hashValue(command.publicValue);

  return transactionRunner.run(async (repositories) => {
    const link = await repositories.groupAccess.findActiveInviteLinkByHash(tokenHash);
    if (link === undefined) {
      throw new PublicApiError("CONFLICT", UNAVAILABLE_LINK_MESSAGE);
    }

    const alreadyInGroup = (await repositories.identityAccess.listActiveMemberships(
      command.actorUserId,
    )).some((membership) => membership.groupId === link.groupId);
    if (alreadyInGroup) {
      throw new PublicApiError(
        "CONFLICT",
        "Your account already belongs to this group.",
      );
    }

    const membership = await repositories.identityAccess.addMembership({
      groupId: link.groupId,
      role: "member",
      userId: command.actorUserId,
    });
    if (membership === undefined) {
      throw new PublicApiError(
        "CONFLICT",
        "Your account already belongs to this group.",
      );
    }

    await repositories.auditEvents.append({
      action: "group.invite_link_accepted",
      actorUserId: command.actorUserId,
      details: { inviteLinkId: link.id },
      resourceId: link.groupId,
      resourceType: "group",
    });

    return { groupId: link.groupId, role: "member" };
  });
}
