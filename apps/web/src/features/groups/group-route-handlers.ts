import {
  parseAcceptInvitationRequest,
  parseCreateGroupRequest,
  parseRenameGroupRequest,
  PublicApiError,
  type CreateGroupRequest,
  type RenameGroupRequest,
} from "@ordah-please/contracts";
import type { GroupDetails, GroupId } from "@ordah-please/domain";
import { parseId } from "@ordah-please/domain";

import { executeRoute } from "../../application/execute-route";
import { requireGroupMembership } from "../../application/group-authorization";
import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";
import type {
  AcceptInviteLinkCommand,
  CreateGroupCommand,
  CreateGroupResult,
  LoadGroupDetailsCommand,
  RenameGroupCommand,
  RotateInviteLinkCommand,
} from "./group-service";

type MaybePromise<Value> = Value | Promise<Value>;

interface GroupRouteHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface LoadGroupDetailsHandlerDependencies
  extends GroupRouteHandlerDependencies {
  readonly loadGroupDetails: (
    command: LoadGroupDetailsCommand,
  ) => Promise<GroupDetails>;
}

export interface RenameGroupHandlerDependencies
  extends GroupRouteHandlerDependencies {
  readonly renameGroup: (
    command: RenameGroupCommand,
  ) => Promise<{ readonly groupId: GroupId; readonly name: string }>;
  readonly now: () => Date;
}

export interface RotateInviteLinkHandlerDependencies
  extends GroupRouteHandlerDependencies {
  readonly rotateInviteLink: (
    command: RotateInviteLinkCommand,
  ) => Promise<{ readonly publicValue: string; readonly tokenPrefix: string }>;
  readonly now: () => Date;
}

export interface CreateGroupHandlerDependencies
  extends GroupRouteHandlerDependencies {
  readonly createGroup: (command: CreateGroupCommand) => Promise<CreateGroupResult>;
}

export interface AcceptInviteLinkHandlerDependencies {
  readonly acceptInviteLink: (
    command: AcceptInviteLinkCommand,
  ) => Promise<{ readonly groupId: string; readonly role: "member" }>;
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly now: () => Date;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
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

/** Creates the GET handler that returns one group's details for any of its members. */
export function createLoadGroupDetailsHandler(
  dependencies: LoadGroupDetailsHandlerDependencies,
  getGroupId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ groupId: GroupId }>, GroupDetails>(
      request,
      {
        authorize: ({ identity, input }) => {
          requireGroupMembership(identity, input.groupId);
          return true;
        },
        execute: ({ identity, input }) => {
          const membership = requireGroupMembership(identity, input.groupId);
          return dependencies.loadGroupDetails({
            groupId: input.groupId,
            viewerRole: membership.role,
          });
        },
        validate: (incomingRequest) => ({
          groupId: parseGroupIdParam(getGroupId(incomingRequest)),
        }),
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the POST handler that lets a group Owner rename the group. */
export function createRenameGroupHandler(
  dependencies: RenameGroupHandlerDependencies,
  getGroupId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      RenameGroupRequest & Readonly<{ groupId: GroupId }>,
      { readonly groupId: GroupId; readonly name: string }
    >(
      request,
      {
        authorize: ({ identity, input }) =>
          requireGroupMembership(identity, input.groupId).role === "group-owner",
        execute: ({ identity, input }) =>
          dependencies.renameGroup({
            actorUserId: identity.userId,
            groupId: input.groupId,
            name: input.name,
          }),
        validate: async (incomingRequest) => ({
          groupId: parseGroupIdParam(getGroupId(incomingRequest)),
          ...(await parseRequestBody(incomingRequest, parseRenameGroupRequest)),
        }),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the POST handler that lets a group Owner rotate the persistent invite link. */
export function createRotateInviteLinkHandler(
  dependencies: RotateInviteLinkHandlerDependencies,
  getGroupId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ groupId: GroupId }>,
      { readonly publicValue: string; readonly tokenPrefix: string }
    >(
      request,
      {
        authorize: ({ identity, input }) =>
          requireGroupMembership(identity, input.groupId).role === "group-owner",
        execute: ({ identity, input }) =>
          dependencies.rotateInviteLink({
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

/** Creates the POST handler that lets a Platform Admin create a new group. */
export function createAdminCreateGroupHandler(
  dependencies: CreateGroupHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<CreateGroupRequest, CreateGroupResult>(
      request,
      {
        authorize: ({ identity }) => identity.isPlatformAdmin,
        execute: ({ identity, input }) =>
          dependencies.createGroup({
            actorUserId: identity.userId,
            name: input.name,
            ownerId: input.ownerId,
          }),
        validate: (incomingRequest) =>
          parseRequestBody(incomingRequest, parseCreateGroupRequest),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the POST handler that accepts a persistent invite link into group membership. */
export function createAcceptInviteLinkHandler(
  dependencies: AcceptInviteLinkHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ token: string }>,
      { readonly groupId: string; readonly role: "member" }
    >(
      request,
      {
        authorize: () => true,
        execute: ({ identity, input }) =>
          dependencies.acceptInviteLink({
            actorUserId: identity.userId,
            now: dependencies.now(),
            publicValue: input.token,
          }),
        validate: (incomingRequest) =>
          parseRequestBody(incomingRequest, parseAcceptInvitationRequest),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}
