import { sessionLogRoute } from "../../../../../../src/features/orders/session-log-route";
export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  return sessionLogRoute(
    request,
    "delete-group",
    (await context.params).groupId,
  );
}
