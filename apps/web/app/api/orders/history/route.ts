import { createOrderHistoryPageHandler } from "../../../../src/features/orders/orders-route-handlers";
import { ordersRuntime } from "../../../../src/features/orders/orders-runtime";

/** Returns one compact authenticated order-history page. */
export async function GET(request: Request): Promise<Response> {
  return createOrderHistoryPageHandler({
    listOrderSummaryPage: ordersRuntime.listOrderSummaryPage,
    loadIdentity: ordersRuntime.loadIdentity,
    verifySession: ordersRuntime.verifySession,
  })(request);
}
