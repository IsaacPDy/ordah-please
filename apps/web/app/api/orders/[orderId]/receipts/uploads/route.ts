import { receiptRoute } from "../../../../../../src/features/orders/receipt-route";
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const params = await context.params;
  return receiptRoute(request, params.orderId, "prepare");
}
