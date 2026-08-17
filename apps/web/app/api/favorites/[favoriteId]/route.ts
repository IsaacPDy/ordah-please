import { favoritesRuntime } from "../../../../src/features/favorites/favorites-runtime";
import { createRemoveFavoriteHandler } from "../../../../src/features/favorites/favorites-route-handlers";

/** Removes one of the signed-in member's favorites. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ favoriteId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createRemoveFavoriteHandler(
    {
      loadIdentity: favoritesRuntime.loadIdentity,
      removeFavoriteMeal: favoritesRuntime.removeFavoriteMeal,
      verifySession: favoritesRuntime.verifySession,
    },
    () => params.favoriteId,
  )(request);
}
