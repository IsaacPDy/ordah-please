import { listRestaurantsHandler } from "../../../../src/features/catalog/restaurant-route-handlers";

/** Returns all published restaurants for member browse. */
export function GET(request: Request): Promise<Response> {
  return listRestaurantsHandler(request);
}
