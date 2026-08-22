import {
  parseOrderCompleteRequest,
  parseOrderCreateRequest,
  PublicApiError,
} from "@ordah-please/contracts";
import type { OrderId } from "@ordah-please/domain";
import { parseId } from "@ordah-please/domain";

import { executeRoute } from "../../application/execute-route";
import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";

type MaybePromise<Value> = Value | Promise<Value>;

interface OrdersHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface CreateOrderHandlerDependencies
  extends OrdersHandlerDependencies {
  readonly createGroupOrder: (command: {
    identity: AppIdentity;
    request: ReturnType<typeof parseOrderCreateRequest>;
    now: Date;
  }) => Promise<{ orderId: OrderId }>;
}

export interface CompleteOrderHandlerDependencies
  extends OrdersHandlerDependencies {
  readonly completeOrder: (command: {
    identity: AppIdentity;
    orderId: string;
    result: "ordered" | "cancelled";
    now: Date;
  }) => Promise<Readonly<{ ok: true }>>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses, validates, and brands the orderId URL parameter. */
function parseOrderIdParam(raw: string | undefined): OrderId {
  if (raw === undefined || raw.trim().length === 0) {
    throw new PublicApiError("INVALID_INPUT", "Order id is required.");
  }
  if (!UUID_PATTERN.test(raw)) {
    throw new PublicApiError("INVALID_INPUT", "Order id is invalid.");
  }
  return parseId<OrderId>(raw);
}

/** Reads one JSON request and surfaces a stable invalid-input error for malformed bodies. */
async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
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

/** Creates the POST handler that starts a new group order. */
export function createCreateOrderHandler(
  dependencies: CreateOrderHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<ReturnType<typeof parseOrderCreateRequest>, unknown>(
      request,
      {
        authorize: () => true,
        execute: async ({ identity, input }) =>
          dependencies.createGroupOrder({
            identity,
            now: new Date(),
            request: input,
          }),
        validate: async (currentRequest) => {
          verifyTrustedMutationRequest(currentRequest);
          try {
            return parseOrderCreateRequest(
              await parseJsonBody(currentRequest),
            );
          } catch (error) {
            if (error instanceof PublicApiError) {
              throw error;
            }
            throw new PublicApiError("INVALID_INPUT", "Invalid request body.");
          }
        },
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the POST handler that marks an order ordered or cancelled. */
export function createCompleteOrderHandler(
  dependencies: CompleteOrderHandlerDependencies,
  getOrderId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ orderId: OrderId; result: "ordered" | "cancelled" }>,
      unknown
    >(request, {
      authorize: () => true,
      execute: async ({ identity, input }) =>
        dependencies.completeOrder({
          identity,
          now: new Date(),
          orderId: input.orderId,
          result: input.result,
        }),
      validate: async (currentRequest) => {
        verifyTrustedMutationRequest(currentRequest);
        const orderId = parseOrderIdParam(getOrderId(currentRequest));
        try {
          const parsed = parseOrderCompleteRequest(
            await parseJsonBody(currentRequest),
          );
          return { orderId, result: parsed.result };
        } catch (error) {
          if (error instanceof PublicApiError) {
            throw error;
          }
          throw new PublicApiError("INVALID_INPUT", "Invalid request body.");
        }
      },
    }, {
      loadIdentity: dependencies.loadIdentity,
      verifySession: () => dependencies.verifySession(request),
    });
}
