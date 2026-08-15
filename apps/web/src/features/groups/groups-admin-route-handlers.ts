import {
  parseRenameGroupRequest,
  PublicApiError,
} from "@ordah-please/contracts";
import type { GroupId } from "@ordah-please/domain";
import { parseId } from "@ordah-please/domain";

import { executeRoute } from "../../application/execute-route";
import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";

type MaybePromise<Value> = Value | Promise<Value>;

interface GroupsAdminHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface RenameGroupAsAdminHandlerDependencies
  extends GroupsAdminHandlerDependencies {
  readonly renameGroupAsAdmin: (
    command: Parameters<
      typeof import("./groups-admin-service").renameGroupAsAdmin
    >[0],
  ) => Promise<{ readonly groupId: GroupId; readonly name: string }>;
}

export interface ArchiveGroupHandlerDependencies
  extends GroupsAdminHandlerDependencies {
  readonly archiveGroupAsAdmin: (
    command: Parameters<
      typeof import("./groups-admin-service").archiveGroupAsAdmin
    >[0],
  ) => Promise<{ readonly groupId: GroupId }>;
  readonly now: () => Date;
}

/** Reads one JSON request and surfaces a stable invalid-input error for malformed bodies. */
async function parseJsonRequest(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new PublicApiError("INVALID_INPUT", "Invalid request body.");
  }
}

/** Converts contract parser failures into one stable public request-body error. */
async function parseRequestBody<Value>(
  request: Request,
  parser: (value: unknown) => Value,
): Promise<Value> {
  try {
    return parser(await parseJsonRequest(request));
  } catch (error) {
    if (error instanceof PublicApiError) {
      throw error;
    }
    throw new PublicApiError("INVALID_INPUT", "Invalid request body.");
  }
}

/** Rejects browser cross-site mutations while allowing native requests without Origin. */
function verifyTrustedMutationRequest(request: Request): void {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    throw new PublicApiError("FORBIDDEN", "You do not have access to this action.");
  }
  const origin = request.headers.get("origin");
  if (origin === null) {
    return;
  }
  try {
    if (new URL(origin).origin === new URL(request.url).origin) {
      return;
    }
  } catch {
    // Invalid or opaque browser origins fail closed below.
  }
  throw new PublicApiError("FORBIDDEN", "You do not have access to this action.");
}

/** Parses and brands the groupId URL parameter. */
function parseGroupIdParam(raw: string | undefined): GroupId {
  if (raw === undefined || raw.trim().length === 0) {
    throw new PublicApiError("INVALID_INPUT", "Group id is required.");
  }
  try {
    return parseId<GroupId>(raw);
  } catch {
    throw new PublicApiError("INVALID_INPUT", "Group id is invalid.");
  }
}

/** Creates the POST handler that lets a Platform Admin rename any active group. */
export function createRenameGroupAsAdminHandler(
  dependencies: RenameGroupAsAdminHandlerDependencies,
  getGroupId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ groupId: GroupId; name: string }>,
      { readonly groupId: GroupId; readonly name: string }
    >(
      request,
      {
        authorize: ({ identity }) => identity.isPlatformAdmin,
        execute: ({ identity, input }) =>
          dependencies.renameGroupAsAdmin({
            actorUserId: identity.userId,
            groupId: input.groupId,
            name: input.name,
          }),
        validate: async (incomingRequest) => ({
          groupId: parseGroupIdParam(getGroupId(incomingRequest)),
          ...(await parseRequestBody(
            incomingRequest,
            parseRenameGroupRequest,
          )),
        }),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the POST handler that lets a Platform Admin archive a group. */
export function createArchiveGroupHandler(
  dependencies: ArchiveGroupHandlerDependencies,
  getGroupId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ groupId: GroupId }>,
      { readonly groupId: GroupId }
    >(
      request,
      {
        authorize: ({ identity }) => identity.isPlatformAdmin,
        execute: ({ identity, input }) =>
          dependencies.archiveGroupAsAdmin({
            actorUserId: identity.userId,
            groupId: input.groupId,
            now: dependencies.now(),
          }),
        validate: (incomingRequest) => ({
          groupId: parseGroupIdParam(getGroupId(incomingRequest)),
        }),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}
