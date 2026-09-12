"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { formatCentavos } from "@ordah-please/domain";

import {
  formatHistoryDate,
  formatStateLabel,
} from "../../../src/features/orders/order-format";
import type {
  CompactOrderSummary,
  OrderHistoryDetail,
  OrderSummaryPage,
} from "../../../src/features/orders/orders-service";

interface ApiSuccess<Value> {
  readonly data: Value;
  readonly ok: true;
}

interface OrderHistoryListProps {
  readonly initialHistory: readonly CompactOrderSummary[];
  readonly initialNextCursor: string | null;
}

type WireCompactOrderSummary = Omit<CompactOrderSummary, "completedAt"> & {
  readonly completedAt: string | null;
};

type WireOrderSummaryPage = Omit<OrderSummaryPage, "history"> & {
  readonly history: readonly WireCompactOrderSummary[];
};

/** Reads one JSON API response and rejects unsuccessful envelopes. */
async function readApiData<Value>(response: Response): Promise<Value> {
  if (!response.ok) throw new Error("Request failed");
  const body = (await response.json()) as ApiSuccess<Value>;
  if (body.ok !== true) throw new Error("Request failed");
  return body.data;
}

/** Restores Date objects after a compact history page crosses the JSON boundary. */
function restoreHistoryDates(
  summary: WireCompactOrderSummary,
): CompactOrderSummary {
  return {
    ...summary,
    completedAt:
      summary.completedAt === null ? null : new Date(summary.completedAt),
  };
}

/** Progressively loads terminal-order details and later compact pages on demand. */
export function OrderHistoryList({
  initialHistory,
  initialNextCursor,
}: OrderHistoryListProps) {
  const [history, setHistory] = useState(initialHistory);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [detailByOrderId, setDetailByOrderId] = useState<
    Readonly<Record<string, OrderHistoryDetail>>
  >({});
  const [loadingDetailIds, setLoadingDetailIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [detailErrorIds, setDetailErrorIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const detailRequestsInFlight = useRef(new Set<string>());
  const loadMoreInFlight = useRef(false);

  /** Fetches one log once and keeps it cached while this list remains mounted. */
  async function loadDetail(orderId: string): Promise<void> {
    if (
      detailByOrderId[orderId] !== undefined ||
      detailRequestsInFlight.current.has(orderId)
    ) {
      return;
    }
    detailRequestsInFlight.current.add(orderId);
    setLoadingDetailIds((current) => new Set(current).add(orderId));
    setDetailErrorIds((current) => {
      const next = new Set(current);
      next.delete(orderId);
      return next;
    });
    try {
      const response = await fetch(`/api/orders/${orderId}/history`, {
        method: "GET",
      });
      const detail = await readApiData<OrderHistoryDetail>(response);
      setDetailByOrderId((current) => ({ ...current, [orderId]: detail }));
    } catch {
      setDetailErrorIds((current) => new Set(current).add(orderId));
    } finally {
      detailRequestsInFlight.current.delete(orderId);
      setLoadingDetailIds((current) => {
        const next = new Set(current);
        next.delete(orderId);
        return next;
      });
    }
  }

  /** Opens or closes one card and begins its first detail request when needed. */
  function toggleOrder(orderId: string): void {
    const isOpening = !openIds.has(orderId);
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
    if (isOpening) void loadDetail(orderId);
  }

  /** Appends one cursor page without removing already visible summaries. */
  async function loadMore(): Promise<void> {
    if (nextCursor === null || loadMoreInFlight.current) return;
    loadMoreInFlight.current = true;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const response = await fetch(
        `/api/orders/history?cursor=${encodeURIComponent(nextCursor)}`,
        { method: "GET" },
      );
      const page = await readApiData<WireOrderSummaryPage>(response);
      setHistory((current) => {
        const existingIds = new Set(current.map((order) => order.orderId));
        return [
          ...current,
          ...page.history
            .filter((order) => !existingIds.has(order.orderId))
            .map(restoreHistoryDates),
        ];
      });
      setNextCursor(page.nextCursor);
    } catch {
      setLoadMoreFailed(true);
    } finally {
      loadMoreInFlight.current = false;
      setLoadingMore(false);
    }
  }

  return (
    <div className="history-list">
      {history.map((order) => {
        const restaurant = order.restaurantName ?? "Restaurant pending";
        const isOpen = openIds.has(order.orderId);
        const detail = detailByOrderId[order.orderId];
        return (
          <article className="history-card" key={order.orderId}>
            <button
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Hide" : "Show"} order log for ${restaurant}`}
              className="history-card__toggle"
              onClick={() => toggleOrder(order.orderId)}
              type="button"
            >
              <span className="history-card__summary">
                <span
                  className={
                    order.state === "ordered"
                      ? "status-pill status-pill--complete"
                      : "status-pill status-pill--muted"
                  }
                >
                  {formatStateLabel(order.state)}
                </span>
                <strong>{restaurant}</strong>
                <small>
                  {order.groupName} ·{" "}
                  {order.completedAt === null
                    ? "Completion date unavailable"
                    : formatHistoryDate(order.completedAt)}{" "}
                  · {order.participantsTotal}{" "}
                  {order.participantsTotal === 1 ? "person" : "people"}
                </small>
              </span>
            </button>
            {isOpen ? (
              <div className="history-card__content">
                {loadingDetailIds.has(order.orderId) ? (
                  <p role="status">Loading order log…</p>
                ) : detailErrorIds.has(order.orderId) ? (
                  <p role="status">
                    Couldn’t load this order log.{" "}
                    <button
                      onClick={() => void loadDetail(order.orderId)}
                      type="button"
                    >
                      Retry
                    </button>
                  </p>
                ) : detail !== undefined ? (
                  <HistoryLog detail={detail} />
                ) : null}
                <Link
                  className="history-card__detail"
                  href={`/orders/${order.orderId}`}
                >
                  View exact items
                </Link>
              </div>
            ) : null}
          </article>
        );
      })}
      {nextCursor !== null ? (
        <button
          className="secondary-action"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          type="button"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
      {loadMoreFailed ? (
        <p role="status">
          Couldn’t load more orders.{" "}
          <button onClick={() => void loadMore()} type="button">
            Retry
          </button>
        </p>
      ) : null}
    </div>
  );
}

/** Renders the authorized person totals returned for one expanded order. */
function HistoryLog({ detail }: { readonly detail: OrderHistoryDetail }) {
  return (
    <ul className="history-log">
      {detail.participants.map((participant) => {
        const hasNoSelection =
          participant.foodResponse === "pending" && participant.itemCount === 0;
        const status =
          participant.foodResponse === "declined"
            ? "Not eating"
            : participant.itemCount === 0
              ? "No food selected"
              : `${participant.itemCount} ${participant.itemCount === 1 ? "item" : "items"}`;
        return (
          <li key={participant.userId}>
            <span>
              <strong>{participant.displayName}</strong>
              <small>{status}</small>
            </span>
            {hasNoSelection ? null : (
              <strong className="history-log__subtotal">
                {formatCentavos(participant.subtotalCentavos)}
              </strong>
            )}
          </li>
        );
      })}
    </ul>
  );
}
