import {
  parseFavoriteSaveRequest,
  PublicApiError,
} from "@ordah-please/contracts";
import type {
  FavoriteId,
  FavoriteRank,
  MenuItemId,
  UserId,
} from "@ordah-please/domain";
import { parseId } from "@ordah-please/domain";

import { executeRoute } from "../../application/execute-route";
import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";

type MaybePromise<Value> = Value | Promise<Value>;

interface FavoritesHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface SaveFavoriteHandlerDependencies
  extends FavoritesHandlerDependencies {
  readonly saveFavoriteMeal: (command: {
    userId: UserId;
    menuItemId: MenuItemId;
  }) => Promise<{ favoriteId: FavoriteId; rank: FavoriteRank }>;
}

export interface RemoveFavoriteHandlerDependencies
  extends FavoritesHandlerDependencies {
  readonly removeFavoriteMeal: (command: {
    userId: UserId;
    favoriteId: FavoriteId;
  }) => Promise<Readonly<{ ok: true }>>;
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses, validates, and brands the favoriteId URL parameter. */
function parseFavoriteIdParam(raw: string | undefined): FavoriteId {
  if (raw === undefined || raw.trim().length === 0) {
    throw new PublicApiError("INVALID_INPUT", "Favorite id is required.");
  }
  if (!UUID_PATTERN.test(raw)) {
    throw new PublicApiError("INVALID_INPUT", "Favorite id is invalid.");
  }
  return parseId<FavoriteId>(raw);
}

/** Creates the POST handler that saves one meal as the member's favorite. */
export function createSaveFavoriteHandler(
  dependencies: SaveFavoriteHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ menuItemId: MenuItemId }>, unknown>(
      request,
      {
        authorize: () => true,
        execute: async ({ identity, input }) =>
          dependencies.saveFavoriteMeal({
            userId: identity.userId,
            menuItemId: input.menuItemId,
          }),
        validate: async (currentRequest) => {
          verifyTrustedMutationRequest(currentRequest);
          try {
            return parseFavoriteSaveRequest(
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

/** Creates the DELETE handler that removes one of the member's favorites. */
export function createRemoveFavoriteHandler(
  dependencies: RemoveFavoriteHandlerDependencies,
  getFavoriteId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ favoriteId: FavoriteId }>, unknown>(
      request,
      {
        authorize: () => true,
        execute: async ({ identity, input }) =>
          dependencies.removeFavoriteMeal({
            userId: identity.userId,
            favoriteId: input.favoriteId,
          }),
        validate: (currentRequest) => {
          verifyTrustedMutationRequest(currentRequest);
          return {
            favoriteId: parseFavoriteIdParam(getFavoriteId(currentRequest)),
          };
        },
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}
