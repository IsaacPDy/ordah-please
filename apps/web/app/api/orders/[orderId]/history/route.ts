import { createOrderHistoryDetailHandler } from "../../../../../src/features/orders/orders-route-handlers";
import { ordersRuntime } from "../../../../../src/features/orders/orders-runtime";

/** Returns one authorized terminal-order participant log. */
export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly orderId: string }> },
): Promise<Response> {
  const { orderId } = await context.params;
  return createOrderHistoryDetailHandler(
    {
      loadIdentity: ordersRuntime.loadIdentity,
      loadOrderHistoryDetail: ordersRuntime.loadOrderHistoryDetail,
      verifySession: ordersRuntime.verifySession,
    },
    () => orderId,
  )(request);
}
