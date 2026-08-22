import {
  createDatabaseClient,
  createRepositories,
  withTransaction,
  type Database,
} from "@ordah-please/db";

import { loadAppIdentity } from "../../auth/load-app-identity";
import { verifySession } from "../../auth/verify-session";
import type { OrdersServiceRepositories } from "./orders-service";
import {
  completeOrder,
  createGroupOrder,
  listOrderSummaries,
  loadOrderDetail,
} from "./orders-service";

let runtimeDatabase: Database | undefined;

/** Reuses one lazy pooled database across warm authenticated order requests. */
function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
}

/** Runs one order mutation with every repository sharing one transaction. */
function runOrdersTransaction<Result>(
  operation: (repositories: OrdersServiceRepositories) => Promise<Result>,
): Promise<Result> {
  return withTransaction(getRuntimeDatabase(), (transaction) =>
    operation(createRepositories(transaction)),
  );
}

/** Loads the authenticated user's current product identity from Neon. */
export function loadRuntimeIdentity(session: {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}) {
  return loadAppIdentity(
    session,
    createRepositories(getRuntimeDatabase()).identityAccess,
  );
}

export const ordersRuntime = {
  completeOrder: (command: Parameters<typeof completeOrder>[0]) =>
    completeOrder(command, { run: runOrdersTransaction }),
  createGroupOrder: (command: Parameters<typeof createGroupOrder>[0]) =>
    createGroupOrder(command, { run: runOrdersTransaction }),
  /** Lists the viewer's active and historical orders for the Orders page. */
  listOrderSummaries: (userId: string) =>
    listOrderSummaries(
      { userId },
      { orders: createRepositories(getRuntimeDatabase()).orders },
    ),
  /** Loads one order detail view for the living order page. */
  loadOrderDetailView: (
    identity: Parameters<typeof loadOrderDetail>[0]["identity"],
    orderId: string,
  ) =>
    loadOrderDetail(
      { identity, now: new Date(), orderId },
      { orders: createRepositories(getRuntimeDatabase()).orders },
    ),
  loadIdentity: loadRuntimeIdentity,
  verifySession,
} as const;
