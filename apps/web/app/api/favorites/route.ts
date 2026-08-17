import { favoritesRuntime } from "../../../src/features/favorites/favorites-runtime";
import { createSaveFavoriteHandler } from "../../../src/features/favorites/favorites-route-handlers";

/** Saves one meal as a favorite for the signed-in member. */
export async function POST(request: Request): Promise<Response> {
  return createSaveFavoriteHandler({
    loadIdentity: favoritesRuntime.loadIdentity,
    saveFavoriteMeal: favoritesRuntime.saveFavoriteMeal,
    verifySession: favoritesRuntime.verifySession,
  })(request);
}
