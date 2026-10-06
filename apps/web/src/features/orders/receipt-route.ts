import { after } from "next/server";
import {
  createReceiptsRepository,
  getRuntimeDatabase,
  withTransaction,
} from "@ordah-please/db";
import {
  createReceiptStorage,
  type ReceiptStorage,
} from "@ordah-please/storage";
import { PublicApiError } from "@ordah-please/contracts";
import { executeRoute } from "../../application/execute-route";
import { ordersRuntime } from "./orders-runtime";
import { verifyTrustedMutationRequest } from "./orders-route-handlers";
import {
  executeReceiptAction,
  cleanupReceiptObjects,
  type ReceiptRunner,
} from "./receipt-service";
export const receiptRunner: ReceiptRunner = {
  run: (operation) =>
    withTransaction(getRuntimeDatabase(), (tx) =>
      operation(createReceiptsRepository(tx)),
    ),
};
export function receiptStorage(): ReceiptStorage {
  try {
    return createReceiptStorage();
  } catch {
    throw new PublicApiError(
      "UNAVAILABLE",
      "Private receipt storage is not configured. Contact the group owner.",
    );
  }
}
export async function receiptRoute(
  request: Request,
  orderId: string,
  action: string,
  id?: string,
) {
  const read = action === "list" || action === "file";
  const response = await executeRoute(
    request,
    {
      authorize: () => true,
      ...(!read ? { verifyRequest: verifyTrustedMutationRequest } : {}),
      validate: async () => {
        if (read) return {};
        try {
          return (await request.json()) as unknown;
        } catch {
          throw new PublicApiError("INVALID_INPUT", "Invalid receipt request.");
        }
      },
      execute: ({ identity, input }) =>
        executeReceiptAction(
          {
            orderId,
            userId: identity.userId,
            action,
            input,
            ...(id ? { receiptId: id } : {}),
          },
          receiptRunner,
          receiptStorage,
        ),
    },
    {
      loadIdentity: ordersRuntime.loadIdentity,
      verifySession: () => ordersRuntime.verifySession(request),
    },
  );
  if (response.ok) {
    after(async () => {
      try {
        await cleanupReceiptObjects(receiptRunner, receiptStorage());
      } catch {
        /* Durable cleanup remains queued when storage is unavailable. */
      }
    });
    if (action === "file") {
      const result = (await response.json()) as { data: { url: string } };
      return new Response(null, {
        status: 307,
        headers: {
          Location: result.data.url,
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
