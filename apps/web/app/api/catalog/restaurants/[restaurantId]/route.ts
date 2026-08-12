import { getRestaurantHandler } from "../../../../../src/features/catalog/restaurant-route-handlers";

/** Returns one restaurant with its current menu. */
export async function GET(
  request: Request,
  context: { params: Promise<{ restaurantId: string }> },
): Promise<Response> {
  const params = await context.params;
  return getRestaurantHandler(() => params.restaurantId)(request);
}
