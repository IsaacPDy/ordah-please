import { verifyWebhook as verifyClerkWebhook } from "@clerk/backend/webhooks";
import {
  apiFailure,
  apiSuccess,
  PublicApiError,
} from "@ordah-please/contracts";
import {
  createDatabaseClient,
  createRepositories,
  type Database,
  withTransaction,
} from "@ordah-please/db";

import {
  type AccountSyncTransactionRunner,
  type AccountSyncResult,
  type ClerkAccountEvent,
  syncClerkAccount,
} from "../../../../src/auth/sync-clerk-account";

let runtimeDatabase: Database | undefined;

/** Reuses one lazy pooled database across warm serverless webhook requests. */
function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
}

const accountSyncTransactionRunner: AccountSyncTransactionRunner = {
  run: (operation) =>
    withTransaction(getRuntimeDatabase(), (transaction) =>
      operation(createRepositories(transaction)),
    ),
};

export interface ClerkWebhookDependencies {
  readonly syncAccount: (
    event: ClerkAccountEvent,
  ) => Promise<AccountSyncResult>;
  readonly verifyWebhook: (request: Request) => Promise<unknown>;
}

/** Returns the one safe response for invalid Clerk signatures or payloads. */
function invalidWebhookResponse(): Response {
  return Response.json(
    apiFailure(new PublicApiError("INVALID_INPUT", "Invalid webhook request.")),
    { status: 400 },
  );
}

/** Narrows untrusted verified payload fields before they reach account synchronization. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

/** Builds the stable human-readable name stored for a Clerk identity. */
function displayNameForUser(data: Readonly<Record<string, unknown>>): string {
  const nameParts = [data.first_name, data.last_name].filter(
    (value): value is string =>
      typeof value === "string" && value.trim() !== "",
  );
  const fullName = nameParts.join(" ").trim();
  if (fullName !== "") {
    return fullName;
  }
  if (typeof data.username === "string" && data.username.trim() !== "") {
    return data.username.trim();
  }
  return "Member";
}

/** Reads Clerk's current Svix delivery header with a Standard Webhooks fallback. */
function deliveryHeader(
  request: Request,
  name: "id" | "timestamp",
): string | null {
  return (
    request.headers.get(`svix-${name}`) ??
    request.headers.get(`webhook-${name}`)
  );
}

/** Converts a verified Clerk user event and signed delivery headers into the internal sync command. */
function clerkAccountEventFrom(
  verifiedEvent: unknown,
  request: Request,
): ClerkAccountEvent {
  if (!isRecord(verifiedEvent) || !isRecord(verifiedEvent.data)) {
    throw new PublicApiError("INVALID_INPUT", "Invalid webhook request.");
  }
  const eventId = deliveryHeader(request, "id");
  const type = verifiedEvent.type;
  const { data } = verifiedEvent;
  if (
    eventId === null ||
    eventId.trim() === "" ||
    typeof data.id !== "string" ||
    data.id.trim() === ""
  ) {
    throw new PublicApiError("INVALID_INPUT", "Invalid webhook request.");
  }
  if (type === "user.deleted") {
    const timestamp = deliveryHeader(request, "timestamp");
    const timestampSeconds =
      timestamp === null ? Number.NaN : Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
      throw new PublicApiError("INVALID_INPUT", "Invalid webhook request.");
    }
    return {
      clerkUserId: data.id,
      eventId,
      occurredAt: new Date(timestampSeconds * 1_000),
      type,
    };
  }
  if (
    (type !== "user.created" && type !== "user.updated") ||
    typeof data.updated_at !== "number" ||
    !Number.isFinite(data.updated_at)
  ) {
    throw new PublicApiError("INVALID_INPUT", "Invalid webhook request.");
  }

  return {
    clerkUserId: data.id,
    displayName: displayNameForUser(data),
    eventId,
    occurredAt: new Date(data.updated_at),
    type,
  };
}

/** Creates the Clerk callback handler with injectable verification and synchronization boundaries. */
export function createClerkWebhookHandler(
  dependencies: ClerkWebhookDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    let verifiedEvent: unknown;
    try {
      verifiedEvent = await dependencies.verifyWebhook(request);
    } catch {
      return invalidWebhookResponse();
    }

    let event: ClerkAccountEvent;
    try {
      event = clerkAccountEventFrom(verifiedEvent, request);
    } catch {
      return invalidWebhookResponse();
    }

    try {
      const result = await dependencies.syncAccount(event);
      return Response.json(apiSuccess(result));
    } catch (error) {
      return Response.json(apiFailure(error), { status: 500 });
    }
  };
}

export const POST = createClerkWebhookHandler({
  syncAccount: (event) => syncClerkAccount(event, accountSyncTransactionRunner),
  verifyWebhook: (request) => verifyClerkWebhook(request),
});
