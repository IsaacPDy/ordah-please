import { ordersRuntime } from "../../../../../src/features/orders/orders-runtime";
import { createCompleteOrderHandler } from "../../../../../src/features/orders/orders-route-handlers";

/** Marks one order ordered or cancelled for the managing member. */
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createCompleteOrderHandler(
    {
      completeOrder: ordersRuntime.completeOrder,
      loadIdentity: ordersRuntime.loadIdentity,
      verifySession: ordersRuntime.verifySession,
    },
    () => params.orderId,
  )(request);
}
