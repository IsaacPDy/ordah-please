"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { OrderSummaryPage } from "../../../src/features/orders/orders-service";
import { SessionCard } from "../../components/session-card";
import { OrderHistoryList } from "./order-history-list";

/** Switches between active sessions and paged, server-authorized history. */
export function SessionsView({
  summaries,
  canStartOrder,
  initialTab = "active",
}: {
  readonly summaries: OrderSummaryPage;
  readonly canStartOrder: boolean;
  readonly initialTab?: "active" | "past";
}) {
  const [tab, setTab] = useState(initialTab);
  function selectTab(next: "active" | "past") {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }
  return (
    <div className="member-page sessions-page">
      <header className="page-intro">
        <h1>{tab === "active" ? "Group sessions" : "Order history"}</h1>
        {tab === "active" ? (
          <p>Create, join, and check past sessions.</p>
        ) : (
          <p>A record of good food and great company.</p>
        )}
      </header>
      <div className="filter-chips" aria-label="Session filters">
        <button
          type="button"
          aria-pressed={tab === "active"}
          onClick={() => selectTab("active")}
        >
          Active
        </button>
        <button
          type="button"
          aria-pressed={tab === "past"}
          onClick={() => selectTab("past")}
        >
          Past
        </button>
      </div>
      <section
        aria-label="Active sessions"
        hidden={tab !== "active"}
        className="session-list"
      >
        {summaries.active.length ? (
          summaries.active.map((order) => (
            <SessionCard key={order.orderId} order={order} />
          ))
        ) : (
          <p className="restaurant-empty">No active sessions right now.</p>
        )}
        {canStartOrder ? (
          <Link className="start-session-card" href="/orders/new">
            <Plus size={24} aria-hidden="true" />
            <strong>Start a group order</strong>
            <small>Choose a group and set it up</small>
          </Link>
        ) : null}
      </section>
      <section aria-label="Order history" hidden={tab !== "past"}>
        {summaries.history.length ? (
          <OrderHistoryList
            initialHistory={summaries.history}
            initialNextCursor={summaries.nextCursor}
          />
        ) : (
          <p className="restaurant-empty">Completed orders will appear here.</p>
        )}
      </section>
    </div>
  );
}
