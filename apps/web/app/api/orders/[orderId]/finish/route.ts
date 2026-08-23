import { ordersRuntime } from "../../../../../src/features/orders/orders-runtime";
import { createFinishOrderHandler } from "../../../../../src/features/orders/orders-route-handlers";

/** Finishes one order early: rank-1 defaults ordered, order marked ordered. */
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createFinishOrderHandler(
    {
      finishOrder: ordersRuntime.finishOrder,
      loadIdentity: ordersRuntime.loadIdentity,
      verifySession: ordersRuntime.verifySession,
    },
    () => params.orderId,
  )(request);
}
