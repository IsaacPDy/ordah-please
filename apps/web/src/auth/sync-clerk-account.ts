export type ClerkAccountEvent =
  | Readonly<{
      clerkUserId: string;
      displayName: string;
      eventId: string;
      occurredAt: Date;
      type: "user.created" | "user.updated";
    }>
  | Readonly<{
      clerkUserId: string;
      eventId: string;
      occurredAt: Date;
      type: "user.deleted";
    }>;

export interface AccountSyncRepositories {
  readonly auditEvents: {
    appendOnce(input: {
      readonly action: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly idempotencyKey: string;
      readonly resourceId: string;
      readonly resourceType: string;
    }): Promise<{ readonly id: string } | undefined>;
  };
  readonly identityAccess: {
    archiveUserByClerkId(
      clerkUserId: string,
      occurredAt: Date,
    ): Promise<{ readonly id: string } | undefined>;
    upsertUserFromClerk(input: {
      readonly clerkUserId: string;
      readonly displayName: string;
      readonly updatedAt: Date;
    }): Promise<{ readonly id: string }>;
  };
}

export type AccountSyncResult = Readonly<{
  status: "applied" | "duplicate";
}>;

export interface AccountSyncTransactionRunner {
  run<Result>(
    operation: (repositories: AccountSyncRepositories) => Promise<Result>,
  ): Promise<Result>;
}

/** Applies one verified Clerk account event after claiming its audit idempotency key. */
export async function applyClerkAccountEvent(
  event: ClerkAccountEvent,
  repositories: AccountSyncRepositories,
): Promise<AccountSyncResult> {
  const auditEvent = await repositories.auditEvents.appendOnce({
    action: `identity.${event.type}`,
    details: { eventType: event.type },
    idempotencyKey: `clerk:${event.eventId}`,
    resourceId: event.clerkUserId,
    resourceType: "clerk_user",
  });
  if (auditEvent === undefined) {
    return { status: "duplicate" };
  }

  if (event.type !== "user.deleted") {
    await repositories.identityAccess.upsertUserFromClerk({
      clerkUserId: event.clerkUserId,
      displayName: event.displayName,
      updatedAt: event.occurredAt,
    });
    return { status: "applied" };
  }

  await repositories.identityAccess.archiveUserByClerkId(
    event.clerkUserId,
    event.occurredAt,
  );
  return { status: "applied" };
}

/** Synchronizes one verified Clerk event atomically with its immutable audit claim. */
export function syncClerkAccount(
  event: ClerkAccountEvent,
  transactionRunner: AccountSyncTransactionRunner,
): Promise<AccountSyncResult> {
  return transactionRunner.run((repositories) =>
    applyClerkAccountEvent(event, repositories),
  );
}
