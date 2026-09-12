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
  advanceFoodDeadline,
  completeOrder,
  createGroupOrder,
  finishOrder,
  listActiveOrderSummaries,
  listOrderSummaryPage,
  loadOrderHistoryDetail,
  listOrderSummaries,
  loadOrderDetail,
  submitFoodResponse,
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
  listOrderSummaries: (
    identity: Parameters<typeof listOrderSummaries>[0]["identity"],
  ) =>
    listOrderSummaries(
      { identity },
      { orders: createRepositories(getRuntimeDatabase()).orders },
    ),
  /** Lists active cards only, so Home does not touch terminal history. */
  listActiveOrderSummaries: (
    identity: Parameters<typeof listActiveOrderSummaries>[0]["identity"],
  ) =>
    listActiveOrderSummaries(
      { identity },
      { orders: createRepositories(getRuntimeDatabase()).orders },
    ),
  /** Lists one bounded compact Orders page. */
  listOrderSummaryPage: (
    command: Parameters<typeof listOrderSummaryPage>[0],
  ) =>
    listOrderSummaryPage(command, {
      orders: createRepositories(getRuntimeDatabase()).orders,
    }),
  /** Loads one authorized terminal order log when its card opens. */
  loadOrderHistoryDetail: (
    command: Parameters<typeof loadOrderHistoryDetail>[0],
  ) =>
    loadOrderHistoryDetail(command, {
      orders: createRepositories(getRuntimeDatabase()).orders,
    }),
  /** Lazily closes food picks past their deadline before reading the order. */
  advanceFoodDeadline: (command: Parameters<typeof advanceFoodDeadline>[0]) =>
    advanceFoodDeadline(command, { run: runOrdersTransaction }),
  /** Saves the participant's favorites-only food pick. */
  submitFoodResponse: (command: Parameters<typeof submitFoodResponse>[0]) =>
    submitFoodResponse(command, { run: runOrdersTransaction }),
  /** Finishes the order early at the manager's request. */
  finishOrder: (command: Parameters<typeof finishOrder>[0]) =>
    finishOrder(command, { run: runOrdersTransaction }),
  /** Loads one order detail view for the living order page. */
  loadOrderDetailView: async (
    identity: Parameters<typeof loadOrderDetail>[0]["identity"],
    orderId: string,
  ) => {
    const now = new Date();
    const repositories = createRepositories(getRuntimeDatabase());
    const detail = await repositories.orders.findOrderDetail(orderId);
    if (
      detail?.state === "food_confirmation" &&
      detail.foodDeadline.getTime() <= now.getTime()
    ) {
      await advanceFoodDeadline(
        { identity, now, orderId },
        { run: runOrdersTransaction },
      );
    }
    return loadOrderDetail(
      { identity, now, orderId },
      { favorites: repositories.favorites, orders: repositories.orders },
    );
  },
  loadIdentity: loadRuntimeIdentity,
  verifySession,
} as const;
