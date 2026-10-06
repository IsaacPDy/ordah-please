import { sessionLogRoute } from "../../../../../src/features/orders/session-log-route";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return sessionLogRoute(request, "edit", (await context.params).orderId);
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  return sessionLogRoute(request, "delete", (await context.params).orderId);
}
