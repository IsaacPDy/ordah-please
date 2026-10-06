import { receiptRoute } from "../../../../../../../src/features/orders/receipt-route";
export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string; receiptId: string }> },
) {
  const params = await context.params;
  return receiptRoute(request, params.orderId, "file", params.receiptId);
}
