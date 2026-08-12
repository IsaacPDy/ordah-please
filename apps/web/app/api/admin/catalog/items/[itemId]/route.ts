import { patchMenuItemHandler } from "../../../../../../src/features/catalog/restaurant-route-handlers";

/** Lets a Platform Admin edit a menu item. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
): Promise<Response> {
  const params = await context.params;
  return patchMenuItemHandler(() => params.itemId)(request);
}
