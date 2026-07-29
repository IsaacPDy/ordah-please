import { PublicApiError } from "@ordah-please/contracts";

import {
  hashInvitationToken,
  issueInvitationToken,
  type IssuedInvitationToken,
} from "./invitation-token";

interface InvitationIssueRepositories {
  readonly access: {
    createInvitation(input: {
      readonly createdByUserId: string;
      readonly expiresAt: Date;
      readonly groupId: string;
      readonly tokenHash: string;
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

interface InvitationIssueTransactionRunner {
  run<Result>(
    operation: (repositories: InvitationIssueRepositories) => Promise<Result>,
  ): Promise<Result>;
}

interface InvitationAcceptanceRepositories {
  readonly access: {
    acceptInvitation(
      invitationId: string,
      userId: string,
      acceptedAt: Date,
    ): Promise<boolean>;
    addMembership(input: {
      readonly groupId: string;
      readonly joinedAt: Date;
      readonly role: "member";
      readonly userId: string;
    }): Promise<unknown>;
    findInvitationByTokenHash(tokenHash: string): Promise<
      | {
          readonly acceptedAt: Date | null;
          readonly expiresAt: Date;
          readonly groupId: string;
          readonly id: string;
        }
      | undefined
    >;
    listActiveMemberships(
      userId: string,
    ): Promise<readonly { readonly groupId: string }[]>;
  };
  readonly auditEvents: InvitationIssueRepositories["auditEvents"];
}

interface InvitationAcceptanceTransactionRunner {
  run<Result>(
    operation: (
      repositories: InvitationAcceptanceRepositories,
    ) => Promise<Result>,
  ): Promise<Result>;
}

type MembershipRole = "owner" | "organizer" | "member";

interface MemberManagementRepositories {
  readonly access: {
    listActiveMembers(groupId: string): Promise<
      readonly {
        readonly displayName: string;
        readonly role: MembershipRole;
        readonly userId: string;
      }[]
    >;
    removeMembership(
      groupId: string,
      userId: string,
      removedAt: Date,
    ): Promise<boolean>;
    setMembershipRole(
      groupId: string,
      userId: string,
      expectedRole: MembershipRole,
      role: MembershipRole,
    ): Promise<boolean>;
  };
  readonly auditEvents: InvitationIssueRepositories["auditEvents"];
}

interface MemberManagementTransactionRunner {
  run<Result>(
    operation: (repositories: MemberManagementRepositories) => Promise<Result>,
  ): Promise<Result>;
}

interface AdminRequestRepositories {
  readonly access: {
    createAdminAccessRequest(input: {
      readonly groupId: string;
      readonly requesterUserId: string;
    }): Promise<{
      readonly id: string;
      readonly status: "pending" | "approved" | "rejected";
    }>;
    findPendingAdminAccessRequest(
      requesterUserId: string,
    ): Promise<{ readonly id: string } | undefined>;
  };
  readonly auditEvents: InvitationIssueRepositories["auditEvents"];
}

interface AdminRequestTransactionRunner {
  run<Result>(
    operation: (repositories: AdminRequestRepositories) => Promise<Result>,
  ): Promise<Result>;
}

export interface IssueGroupInvitationCommand {
  readonly actorUserId: string;
  readonly deploymentId: string;
  readonly expiresAt: Date;
  readonly groupId: string;
  readonly now: Date;
}

export interface AcceptGroupInvitationCommand {
  readonly deploymentId: string;
  readonly now: Date;
  readonly publicToken: string;
  readonly userId: string;
}

export interface ManageGroupMemberCommand {
  readonly action: "promote" | "demote" | "remove";
  readonly actorUserId: string;
  readonly groupId: string;
  readonly now: Date;
  readonly targetUserId: string;
}

export interface SubmitAdminAccessRequestCommand {
  readonly actorUserId: string;
  readonly groupId: string;
}

const UNAVAILABLE_INVITATION_MESSAGE =
  "This invitation link is no longer available.";

/** Issues one future-dated group invitation while persisting only its hash and audit record. */
export async function issueGroupInvitation(
  command: IssueGroupInvitationCommand,
  transactionRunner: InvitationIssueTransactionRunner,
  tokenIssuer: (
    deploymentId: string,
  ) => IssuedInvitationToken = issueInvitationToken,
): Promise<{
  readonly expiresAt: string;
  readonly invitationId: string;
  readonly publicToken: string;
}> {
  if (command.expiresAt.getTime() <= command.now.getTime()) {
    throw new PublicApiError(
      "INVALID_INPUT",
      "Invitation expiry must be in the future.",
    );
  }

  const issuedToken = tokenIssuer(command.deploymentId);
  const invitation = await transactionRunner.run(async (repositories) => {
    const created = await repositories.access.createInvitation({
      createdByUserId: command.actorUserId,
      expiresAt: command.expiresAt,
      groupId: command.groupId,
      tokenHash: issuedToken.tokenHash,
    });
    await repositories.auditEvents.append({
      action: "group.invitation_issued",
      actorUserId: command.actorUserId,
      details: { expiresAt: command.expiresAt.toISOString() },
      resourceId: created.id,
      resourceType: "invitation",
    });
    return created;
  });

  return {
    expiresAt: command.expiresAt.toISOString(),
    invitationId: invitation.id,
    publicToken: issuedToken.publicToken,
  };
}

/** Accepts one usable invitation into group membership without implying participation in any order. */
export async function acceptGroupInvitation(
  command: AcceptGroupInvitationCommand,
  transactionRunner: InvitationAcceptanceTransactionRunner,
  tokenHasher: (
    publicToken: string,
    deploymentId: string,
  ) => string = hashInvitationToken,
): Promise<{ readonly groupId: string; readonly role: "member" }> {
  const tokenHash = tokenHasher(command.publicToken, command.deploymentId);

  return transactionRunner.run(async (repositories) => {
    const invitation =
      await repositories.access.findInvitationByTokenHash(tokenHash);
    if (
      invitation === undefined ||
      invitation.acceptedAt !== null ||
      invitation.expiresAt.getTime() <= command.now.getTime()
    ) {
      throw new PublicApiError("CONFLICT", UNAVAILABLE_INVITATION_MESSAGE);
    }
    if (
      (await repositories.access.listActiveMemberships(command.userId)).length >
      0
    ) {
      throw new PublicApiError(
        "CONFLICT",
        "Your account already belongs to a group.",
      );
    }

    const accepted = await repositories.access.acceptInvitation(
      invitation.id,
      command.userId,
      command.now,
    );
    if (!accepted) {
      throw new PublicApiError("CONFLICT", UNAVAILABLE_INVITATION_MESSAGE);
    }
    await repositories.access.addMembership({
      groupId: invitation.groupId,
      joinedAt: command.now,
      role: "member",
      userId: command.userId,
    });
    await repositories.auditEvents.append({
      action: "group.invitation_accepted",
      actorUserId: command.userId,
      details: { invitationId: invitation.id },
      resourceId: invitation.groupId,
      resourceType: "group",
    });

    return { groupId: invitation.groupId, role: "member" };
  });
}

/** Applies one owner-authorized member role or removal action with an immutable audit event. */
export function manageGroupMember(
  command: ManageGroupMemberCommand,
  transactionRunner: MemberManagementTransactionRunner,
): Promise<{
  readonly role: "organizer" | "member" | null;
  readonly userId: string;
}> {
  return transactionRunner.run(async (repositories) => {
    const target = (
      await repositories.access.listActiveMembers(command.groupId)
    ).find((member) => member.userId === command.targetUserId);
    if (target === undefined || target.role === "owner") {
      throw new PublicApiError(
        "CONFLICT",
        "This member action is not available.",
      );
    }

    const expectedRole =
      command.action === "promote"
        ? "member"
        : command.action === "demote"
          ? "organizer"
          : target.role;
    if (target.role !== expectedRole) {
      throw new PublicApiError(
        "CONFLICT",
        "This member action is not available.",
      );
    }

    const nextRole =
      command.action === "promote"
        ? ("organizer" as const)
        : command.action === "demote"
          ? ("member" as const)
          : null;
    const changed =
      nextRole === null
        ? await repositories.access.removeMembership(
            command.groupId,
            command.targetUserId,
            command.now,
          )
        : await repositories.access.setMembershipRole(
            command.groupId,
            command.targetUserId,
            target.role,
            nextRole,
          );
    if (!changed) {
      throw new PublicApiError(
        "CONFLICT",
        "This member action is not available.",
      );
    }

    const auditAction = {
      demote: "group.member_demoted",
      promote: "group.member_promoted",
      remove: "group.member_removed",
    } as const;
    await repositories.auditEvents.append({
      action: auditAction[command.action],
      actorUserId: command.actorUserId,
      details: { previousRole: target.role, role: nextRole },
      resourceId: command.targetUserId,
      resourceType: "membership",
    });
    return { role: nextRole, userId: command.targetUserId };
  });
}

/** Submits a group owner's platform-admin request without implementing the V1-06 decision flow. */
export function submitAdminAccessRequest(
  command: SubmitAdminAccessRequestCommand,
  transactionRunner: AdminRequestTransactionRunner,
): Promise<{ readonly requestId: string; readonly status: "pending" }> {
  return transactionRunner.run(async (repositories) => {
    if (
      (await repositories.access.findPendingAdminAccessRequest(
        command.actorUserId,
      )) !== undefined
    ) {
      throw new PublicApiError(
        "CONFLICT",
        "A platform-admin request is already pending.",
      );
    }
    const request = await repositories.access.createAdminAccessRequest({
      groupId: command.groupId,
      requesterUserId: command.actorUserId,
    });
    await repositories.auditEvents.append({
      action: "platform_admin.requested",
      actorUserId: command.actorUserId,
      details: { groupId: command.groupId },
      resourceId: request.id,
      resourceType: "admin_access_request",
    });
    return { requestId: request.id, status: "pending" };
  });
}
