import { ordersRuntime } from "../../../../../src/features/orders/orders-runtime";
import { createFoodResponseHandler } from "../../../../../src/features/orders/orders-route-handlers";

/** Saves the participant's food pick, decline, or reset for one order. */
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createFoodResponseHandler(
    {
      submitFoodResponse: ordersRuntime.submitFoodResponse,
      loadIdentity: ordersRuntime.loadIdentity,
      verifySession: ordersRuntime.verifySession,
    },
    () => params.orderId,
  )(request);
}
