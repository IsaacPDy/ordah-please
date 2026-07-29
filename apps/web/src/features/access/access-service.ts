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
