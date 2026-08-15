import {
  parseAddUserToGroupRequest,
  PublicApiError,
} from "@ordah-please/contracts";
import type { GroupId, UserId } from "@ordah-please/domain";
import { parseId } from "@ordah-please/domain";

import { executeRoute } from "../../application/execute-route";
import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";

type MaybePromise<Value> = Value | Promise<Value>;

interface UsersAdminHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface SuspendUserHandlerDependencies
  extends UsersAdminHandlerDependencies {
  readonly suspendUserAsAdmin: (
    command: Parameters<
      typeof import("./users-admin-service").suspendUserAsAdmin
    >[0],
  ) => Promise<{ readonly userId: UserId }>;
  readonly now: () => Date;
}

export interface AddUserToGroupHandlerDependencies
  extends UsersAdminHandlerDependencies {
  readonly addUserToGroupAsAdmin: (
    command: Parameters<
      typeof import("./users-admin-service").addUserToGroupAsAdmin
    >[0],
  ) => Promise<{ readonly groupId: GroupId; readonly userId: UserId }>;
}

export interface RemoveUserFromGroupHandlerDependencies
  extends UsersAdminHandlerDependencies {
  readonly removeUserFromGroupAsAdmin: (
    command: Parameters<
      typeof import("./users-admin-service").removeUserFromGroupAsAdmin
    >[0],
  ) => Promise<{ readonly groupId: GroupId; readonly userId: UserId }>;
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

/** Parses and brands the userId URL parameter. */
function parseUserIdParam(raw: string | undefined): UserId {
  if (raw === undefined || raw.trim().length === 0) {
    throw new PublicApiError("INVALID_INPUT", "User id is required.");
  }
  try {
    return parseId<UserId>(raw);
  } catch {
    throw new PublicApiError("INVALID_INPUT", "User id is invalid.");
  }
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

/** Creates the POST handler that lets a Platform Admin suspend a user account. */
export function createSuspendUserHandler(
  dependencies: SuspendUserHandlerDependencies,
  getUserId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ userId: UserId }>, { readonly userId: UserId }>(
      request,
      {
        authorize: ({ identity }) => identity.isPlatformAdmin,
        execute: ({ identity, input }) =>
          dependencies.suspendUserAsAdmin({
            actorUserId: identity.userId,
            userId: input.userId,
            now: dependencies.now(),
          }),
        validate: (incomingRequest) => ({
          userId: parseUserIdParam(getUserId(incomingRequest)),
        }),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the POST handler that lets a Platform Admin add a user to a group as a member. */
export function createAddUserToGroupHandler(
  dependencies: AddUserToGroupHandlerDependencies,
  getUserId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ groupId: GroupId; userId: UserId }>,
      { readonly groupId: GroupId; readonly userId: UserId }
    >(
      request,
      {
        authorize: ({ identity }) => identity.isPlatformAdmin,
        execute: ({ identity, input }) =>
          dependencies.addUserToGroupAsAdmin({
            actorUserId: identity.userId,
            userId: input.userId,
            groupId: input.groupId,
          }),
        validate: async (incomingRequest) => ({
          userId: parseUserIdParam(getUserId(incomingRequest)),
          ...(await parseRequestBody(
            incomingRequest,
            parseAddUserToGroupRequest,
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

/** Creates the POST handler that lets a Platform Admin remove a user's group membership. */
export function createRemoveUserFromGroupHandler(
  dependencies: RemoveUserFromGroupHandlerDependencies,
  getUserId: (request: Request) => string | undefined,
  getGroupId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ groupId: GroupId; userId: UserId }>,
      { readonly groupId: GroupId; readonly userId: UserId }
    >(
      request,
      {
        authorize: ({ identity }) => identity.isPlatformAdmin,
        execute: ({ identity, input }) =>
          dependencies.removeUserFromGroupAsAdmin({
            actorUserId: identity.userId,
            userId: input.userId,
            groupId: input.groupId,
            now: dependencies.now(),
          }),
        validate: (incomingRequest) => ({
          userId: parseUserIdParam(getUserId(incomingRequest)),
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
