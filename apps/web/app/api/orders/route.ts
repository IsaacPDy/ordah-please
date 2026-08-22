import { ordersRuntime } from "../../../src/features/orders/orders-runtime";
import { createCreateOrderHandler } from "../../../src/features/orders/orders-route-handlers";

/** Starts a new group order for the signed-in manager or owner. */
export async function POST(request: Request): Promise<Response> {
  return createCreateOrderHandler({
    createGroupOrder: ordersRuntime.createGroupOrder,
    loadIdentity: ordersRuntime.loadIdentity,
    verifySession: ordersRuntime.verifySession,
  })(request);
}
