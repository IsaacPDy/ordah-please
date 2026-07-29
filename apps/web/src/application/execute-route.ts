import {
  apiFailure,
  apiSuccess,
  type ApiErrorCode,
  PublicApiError,
} from "@ordah-please/contracts";

import type { AppIdentity } from "../auth/load-app-identity";
import type { VerifiedSession } from "../auth/verify-session";
import {
  authorize as enforceAuthorization,
  type AuthorizationPolicy,
} from "./authorize";

type MaybePromise<Value> = Value | Promise<Value>;

const PUBLIC_ERROR_STATUS = {
  CONFLICT: 409,
  FORBIDDEN: 403,
  INTERNAL_FAILURE: 500,
  INVALID_INPUT: 400,
  UNAUTHENTICATED: 401,
  UNAVAILABLE: 503,
} as const satisfies Readonly<Record<ApiErrorCode, number>>;

export interface RouteContext<Input> {
  readonly identity: AppIdentity;
  readonly input: Input;
  readonly request: Request;
}

export interface RouteDefinition<Input, Output> {
  readonly authorize: AuthorizationPolicy<RouteContext<Input>>;
  readonly execute: (context: RouteContext<Input>) => MaybePromise<Output>;
  readonly validate: (request: Request) => MaybePromise<Input>;
}

export interface RouteDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: () => MaybePromise<VerifiedSession>;
}

/** Executes one API use case through the repository's required trust-boundary sequence. */
export async function executeRoute<Input, Output>(
  request: Request,
  definition: RouteDefinition<Input, Output>,
  dependencies: RouteDependencies,
): Promise<Response> {
  try {
    const session = await dependencies.verifySession();
    const identity = await dependencies.loadIdentity(session);
    const input = await definition.validate(request);
    const context = { identity, input, request };
    await enforceAuthorization(context, definition.authorize);
    const output = await definition.execute(context);

    return Response.json(apiSuccess(output));
  } catch (error) {
    if (error instanceof PublicApiError) {
      return Response.json(apiFailure(error), {
        status: PUBLIC_ERROR_STATUS[error.code],
      });
    }

    return Response.json(apiFailure(error), { status: 500 });
  }
}
