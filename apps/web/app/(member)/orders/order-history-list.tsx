"use client";

import { ChevronDown, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { formatCentavos, parseCentavos } from "@ordah-please/domain";

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
  readonly groupId?: string;
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
  groupId,
}: OrderHistoryListProps) {
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(groupId ?? "");
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

  const groups = Array.from(
    new Map(history.map((order) => [order.groupId, order.groupName])).entries(),
  );
  const monthOf = (date: Date | null) =>
    date === null
      ? "Date unavailable"
      : new Intl.DateTimeFormat("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "Asia/Manila",
        }).format(date);
  const months = Array.from(
    new Set(history.map((order) => monthOf(order.completedAt))),
  );
  const visibleHistory = history.filter(
    (order) =>
      (!selectedGroup || order.groupId === selectedGroup) &&
      (!selectedMonth || monthOf(order.completedAt) === selectedMonth),
  );
  return (
    <div className="history-list history-reference">
      <div className="history-filters">
        {!groupId && groups.length > 0 ? (
          <label className="history-filter">
            <span className="sr-only">Filter history by group</span>
            <select
              value={selectedGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
            >
              <option value="">All groups</option>
              {groups.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="history-filter">
          <span className="sr-only">Filter history by month</span>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          >
            <option value="">All time</option>
            {months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>
      </div>
      {visibleHistory.map((order, index) => {
        const restaurant = order.restaurantName ?? "Restaurant pending";
        const isOpen = openIds.has(order.orderId);
        const detail = detailByOrderId[order.orderId];
        return (
          <div key={order.orderId}>
            {index === 0 ||
            monthOf(visibleHistory[index - 1]!.completedAt) !==
              monthOf(order.completedAt) ? (
              <div className="history-month-heading">
                <h2 className="history-month">{monthOf(order.completedAt)}</h2>
                <small>
                  {
                    visibleHistory.filter(
                      (item) =>
                        monthOf(item.completedAt) ===
                        monthOf(order.completedAt),
                    ).length
                  }{" "}
                  loaded orders
                </small>
              </div>
            ) : null}
            <article className="history-card">
              <button
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Hide" : "Show"} order log for ${restaurant}`}
                className="history-card__toggle"
                onClick={() => toggleOrder(order.orderId)}
                type="button"
              >
                <span
                  className="history-date"
                  aria-label={
                    order.completedAt
                      ? formatHistoryDate(order.completedAt)
                      : "Date unavailable"
                  }
                >
                  {order.completedAt ? (
                    <>
                      <small>
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          timeZone: "Asia/Manila",
                        }).format(order.completedAt)}
                      </small>
                      <strong>
                        {new Intl.DateTimeFormat("en-US", {
                          day: "2-digit",
                          timeZone: "Asia/Manila",
                        }).format(order.completedAt)}
                      </strong>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className="history-card__thumbnail" aria-hidden="true">
                  {order.restaurantImageUrl ? (
                    <Image
                      src={order.restaurantImageUrl}
                      alt=""
                      width={72}
                      height={82}
                    />
                  ) : (
                    <Store size={28} />
                  )}
                </span>
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
                <span className="history-row-total">
                  {detail ? (
                    <>
                      <strong>
                        {formatCentavos(
                          parseCentavos(
                            detail.participants.reduce(
                              (sum, participant) =>
                                sum + participant.subtotalCentavos,
                              0,
                            ),
                          ),
                        )}
                      </strong>
                      <small>Visible food subtotal</small>
                    </>
                  ) : (
                    <small>View food subtotal</small>
                  )}
                  <small>
                    {order.participantsTotal}{" "}
                    {order.participantsTotal === 1 ? "person" : "people"}
                  </small>
                </span>
                <ChevronDown size={18} aria-hidden="true" />
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
          </div>
        );
      })}
      {visibleHistory.length === 0 ? (
        <p className="restaurant-empty">
          No orders in this group on the loaded pages.
        </p>
      ) : null}
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
