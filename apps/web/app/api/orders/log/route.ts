import { sessionLogRoute } from "../../../../src/features/orders/session-log-route";
export const POST = (request: Request) => sessionLogRoute(request, "create");
