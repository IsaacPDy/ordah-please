import { patchRestaurantHandler } from "../../../../../../src/features/catalog/restaurant-route-handlers";

/** Lets a Platform Admin edit a restaurant's name or cuisines. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ restaurantId: string }> },
): Promise<Response> {
  const params = await context.params;
  return patchRestaurantHandler(() => params.restaurantId)(request);
}
