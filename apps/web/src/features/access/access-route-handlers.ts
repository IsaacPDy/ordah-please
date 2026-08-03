import {
  parseCreateAdminAccessRequest,
  parseAcceptInvitationRequest,
  parseDecideAdminAccessRequestRequest,
  parseIssueInvitationRequest,
  parseAppIdentitySummary,
  parseListPendingAdminAccessRequestsResponse,
  parseMemberActionRequest,
  PublicApiError,
  type AcceptInvitationRequest,
  type CreateAdminAccessRequest,
  type DecideAdminAccessRequestRequest,
  type IssueInvitationRequest,
  type AppIdentitySummary,
  type ListPendingAdminAccessRequestsResponse,
  type MemberActionRequest,
} from "@ordah-please/contracts";
import { parseId, type GroupId } from "@ordah-please/domain";

import { executeRoute } from "../../application/execute-route";
import { findGroupMembership } from "../../application/group-authorization";
import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";
import type {
  AcceptGroupInvitationCommand,
  DecideAdminAccessRequestCommand,
  IssueGroupInvitationCommand,
  ManageGroupMemberCommand,
  SubmitAdminAccessRequestCommand,
} from "./access-service";

type MaybePromise<Value> = Value | Promise<Value>;

export interface AcceptInvitationHandlerDependencies {
  readonly acceptInvitation: (
    command: AcceptGroupInvitationCommand,
  ) => Promise<{ readonly groupId: string; readonly role: "member" }>;
  readonly deploymentId: string;
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly now: () => Date;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface ManageMemberHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly manageMember: (command: ManageGroupMemberCommand) => Promise<{
    readonly role: "manager" | "member" | null;
    readonly userId: string;
  }>;
  readonly now: () => Date;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

interface OwnerHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface IssueInvitationHandlerDependencies extends OwnerHandlerDependencies {
  readonly deploymentId: string;
  readonly issueInvitation: (command: IssueGroupInvitationCommand) => Promise<{
    readonly expiresAt: string;
    readonly invitationId: string;
    readonly publicToken: string;
  }>;
  readonly now: () => Date;
}

type GroupMember = Readonly<{
  displayName: string;
  role: "owner" | "manager" | "member";
  userId: string;
}>;

export interface ListMembersHandlerDependencies extends OwnerHandlerDependencies {
  readonly listMembers: (groupId: string) => Promise<readonly GroupMember[]>;
}

export interface AdminRequestHandlerDependencies extends OwnerHandlerDependencies {
  readonly submitAdminRequest: (
    command: SubmitAdminAccessRequestCommand,
  ) => Promise<{ readonly requestId: string; readonly status: "pending" }>;
}

export interface DecideAdminRequestHandlerDependencies {
  readonly decideAdminRequest: (
    command: DecideAdminAccessRequestCommand,
  ) => Promise<{
    readonly requestId: string;
    readonly status: "approved" | "rejected";
  }>;
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly now: () => Date;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface ListPendingAdminRequestsHandlerDependencies {
  readonly listPendingAdminRequests: () => Promise<
    readonly {
      readonly id: string;
      readonly requesterUserId: string;
      readonly requesterDisplayName: string;
      readonly groupId: string;
      readonly groupName: string;
      readonly status: "pending";
      readonly createdAt: string;
    }[]
  >;
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface IdentityMeHandlerDependencies {
  readonly countPendingAdminRequests: () => Promise<readonly unknown[]>;
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

/** Reads one JSON request and exposes only a stable invalid-input error for malformed bodies. */
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

/** Reads the single explicit group identifier from a member-list query. */
function parseGroupQuery(request: Request): Readonly<{ groupId: GroupId }> {
  const searchParams = new URL(request.url).searchParams;
  const keys = [...searchParams.keys()];
  const groupIds = searchParams.getAll("groupId");
  if (keys.length !== 1 || keys[0] !== "groupId" || groupIds.length !== 1) {
    throw new PublicApiError("INVALID_INPUT", "Invalid group query.");
  }
  try {
    return { groupId: parseId<GroupId>(groupIds[0]) };
  } catch {
    throw new PublicApiError("INVALID_INPUT", "Invalid group query.");
  }
}

/** Rejects browser cross-site mutations while allowing native requests that do not send Origin. */
function verifyTrustedMutationRequest(request: Request): void {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    throw new PublicApiError(
      "FORBIDDEN",
      "You do not have access to this action.",
    );
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
  throw new PublicApiError(
    "FORBIDDEN",
    "You do not have access to this action.",
  );
}

/** Creates the authenticated invitation-acceptance route used by both Android and PWA clients. */
export function createAcceptInvitationHandler(
  dependencies: AcceptInvitationHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      AcceptInvitationRequest,
      { readonly groupId: string; readonly role: "member" }
    >(
      request,
      {
        authorize: () => true,
        execute: ({ identity, input }) =>
          dependencies.acceptInvitation({
            deploymentId: dependencies.deploymentId,
            now: dependencies.now(),
            publicToken: input.token,
            userId: identity.userId,
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

/** Creates one owner-only promote, demote, or remove route over the shared member-action contract. */
export function createManageMemberHandler(
  action: ManageGroupMemberCommand["action"],
  dependencies: ManageMemberHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      MemberActionRequest,
      {
        readonly role: "manager" | "member" | null;
        readonly userId: string;
      }
    >(
      request,
      {
        authorize: ({ identity, input }) =>
          findGroupMembership(identity, input.groupId)?.role === "group-owner",
        execute: ({ identity, input }) => {
          return dependencies.manageMember({
            action,
            actorUserId: identity.userId,
            groupId: input.groupId,
            now: dependencies.now(),
            targetUserId: input.userId,
          });
        },
        validate: (incomingRequest) =>
          parseRequestBody(incomingRequest, parseMemberActionRequest),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the Group Owner or Platform Admin route that issues a private invitation. */
export function createIssueInvitationHandler(
  dependencies: IssueInvitationHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      IssueInvitationRequest,
      {
        readonly expiresAt: string;
        readonly invitationId: string;
        readonly publicToken: string;
      }
    >(
      request,
      {
        authorize: ({ identity, input }) =>
          identity.isPlatformAdmin ||
          findGroupMembership(identity, input.groupId)?.role === "group-owner",
        execute: ({ identity, input }) =>
          dependencies.issueInvitation({
            actorUserId: identity.userId,
            deploymentId: dependencies.deploymentId,
            expiresAt: new Date(input.expiresAt),
            groupId: input.groupId,
            now: dependencies.now(),
          }),
        validate: (incomingRequest) =>
          parseRequestBody(incomingRequest, parseIssueInvitationRequest),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the owner-only route that lists current group memberships and roles. */
export function createListMembersHandler(
  dependencies: ListMembersHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ groupId: GroupId }>, readonly GroupMember[]>(
      request,
      {
        authorize: ({ identity, input }) =>
          findGroupMembership(identity, input.groupId)?.role === "group-owner",
        execute: ({ input }) => dependencies.listMembers(input.groupId),
        validate: parseGroupQuery,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the owner-only V1-05 route that submits but never decides a platform-admin request. */
export function createAdminRequestHandler(
  dependencies: AdminRequestHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      CreateAdminAccessRequest,
      { readonly requestId: string; readonly status: "pending" }
    >(
      request,
      {
        authorize: ({ identity, input }) =>
          findGroupMembership(identity, input.groupId)?.role === "group-owner",
        execute: ({ identity, input }) =>
          dependencies.submitAdminRequest({
            actorUserId: identity.userId,
            groupId: input.groupId,
          }),
        validate: (incomingRequest) =>
          parseRequestBody(incomingRequest, parseCreateAdminAccessRequest),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the platform-admin route that approves or rejects one pending admin request. */
export function createDecideAdminRequestHandler(
  dependencies: DecideAdminRequestHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      DecideAdminAccessRequestRequest,
      { readonly requestId: string; readonly status: "approved" | "rejected" }
    >(
      request,
      {
        authorize: ({ identity }) => identity.isPlatformAdmin,
        execute: ({ identity, input }) =>
          dependencies.decideAdminRequest({
            actorUserId: identity.userId,
            requestId: input.requestId,
            decision: input.decision,
            ...(input.reason === undefined ? {} : { reason: input.reason }),
            now: dependencies.now(),
          }),
        validate: (incomingRequest) =>
          parseRequestBody(
            incomingRequest,
            parseDecideAdminAccessRequestRequest,
          ),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the platform-admin route that lists all pending admin requests. */
export function createListPendingAdminRequestsHandler(
  dependencies: ListPendingAdminRequestsHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<undefined, ListPendingAdminAccessRequestsResponse>(
      request,
      {
        authorize: ({ identity }) => identity.isPlatformAdmin,
        execute: async () => {
          const requests = await dependencies.listPendingAdminRequests();
          return parseListPendingAdminAccessRequestsResponse({ requests });
        },
        validate: () => undefined,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the signed-in identity summary route consumed by the native Home card. */
export function createIdentityMeHandler(
  dependencies: IdentityMeHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<undefined, AppIdentitySummary>(
      request,
      {
        authorize: () => true,
        execute: async ({ identity }) => {
          if (identity.isPlatformAdmin) {
            const pending = await dependencies.countPendingAdminRequests();
            return parseAppIdentitySummary({
              isPlatformAdmin: true,
              memberships: identity.memberships,
              pendingAdminRequestCount: pending.length,
            });
          }
          return parseAppIdentitySummary({
            isPlatformAdmin: false,
            memberships: identity.memberships,
            pendingAdminRequestCount: 0,
          });
        },
        validate: () => undefined,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}
