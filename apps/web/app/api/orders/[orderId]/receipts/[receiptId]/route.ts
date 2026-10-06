import { receiptRoute } from "../../../../../../src/features/orders/receipt-route";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string; receiptId: string }> },
) {
  const params = await context.params;
  return receiptRoute(request, params.orderId, "edit", params.receiptId);
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ orderId: string; receiptId: string }> },
) {
  const params = await context.params;
  return receiptRoute(request, params.orderId, "delete", params.receiptId);
}
