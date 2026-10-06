import { receiptRoute } from "../../../../../src/features/orders/receipt-route";
export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const params = await context.params;
  return receiptRoute(request, params.orderId, "list");
}
export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const params = await context.params;
  return receiptRoute(request, params.orderId, "settings");
}
