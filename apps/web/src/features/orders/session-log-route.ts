import {
  createRepositories,
  getRuntimeDatabase,
  withTransaction,
} from "@ordah-please/db";
import { PublicApiError } from "@ordah-please/contracts";
import { executeRoute } from "../../application/execute-route";
import { ordersRuntime } from "./orders-runtime";
import { verifyTrustedMutationRequest } from "./orders-route-handlers";
import {
  deleteGroupPermanently,
  deleteSessionLog,
  mutateSessionLog,
  parseSessionLogRequest,
  sessionId,
  type SessionLogRunner,
} from "./session-log-service";
const runner: SessionLogRunner = {
  run: (operation) =>
    withTransaction(getRuntimeDatabase(), (tx) =>
      operation(createRepositories(tx)),
    ),
};
export function sessionLogRoute(
  request: Request,
  action: "create" | "edit" | "delete" | "delete-group",
  id?: string,
) {
  return executeRoute(
    request,
    {
      authorize: () => true,
      verifyRequest: verifyTrustedMutationRequest,
      validate: async () => {
        if (id !== undefined) sessionId(id);
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          throw new PublicApiError("INVALID_INPUT", "Invalid request body.");
        }
        if (action === "delete" || action === "delete-group") {
          if ((body as { confirmed?: unknown })?.confirmed !== true)
            throw new PublicApiError(
              "INVALID_INPUT",
              "Confirm permanent deletion first.",
            );
          return null;
        }
        return parseSessionLogRequest(body);
      },
      execute: async ({ identity, input }) => {
        if (action === "delete-group")
          return deleteGroupPermanently({ identity, groupId: id! }, runner);
        if (action === "delete")
          return deleteSessionLog({ identity, orderId: id! }, runner);
        return mutateSessionLog(
          {
            identity,
            request: input!,
            now: new Date(),
            ...(id ? { orderId: id } : {}),
          },
          runner,
        );
      },
    },
    {
      loadIdentity: ordersRuntime.loadIdentity,
      verifySession: () => ordersRuntime.verifySession(request),
    },
  );
}
