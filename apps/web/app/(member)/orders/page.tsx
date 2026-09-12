import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import {
  formatDeadline,
  formatStateLabel,
} from "../../../src/features/orders/order-format";
import { ordersRuntime } from "../../../src/features/orders/orders-runtime";
import type {
  OrderSummary,
  OrderSummaryPage,
} from "../../../src/features/orders/orders-service";
import { MemberAccessState } from "../../components/member-access-state";
import { OrderHistoryList } from "./order-history-list";

/** Shows actionable current orders and immutable past participation. */
export default async function OrdersPage() {
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;
  const canStartOrder =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.some(
      (membership) =>
        membership.role === "group-owner" || membership.role === "manager",
    );

  let ordersLoadFailed = false;
  let summaries: OrderSummaryPage = {
    active: [],
    history: [],
    nextCursor: null,
  };
  if (identityResult.status === "authenticated") {
    try {
      summaries = await ordersRuntime.listOrderSummaryPage({
        cursor: null,
        identity: identityResult.identity,
        limit: 10,
      });
    } catch {
      ordersLoadFailed = true;
    }
  }

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="orders">
      <div className="member-page">
        <header className="page-intro">
          <p className="eyebrow">Your activity</p>
          <h1>Orders</h1>
          <p>Respond to active orders and revisit past meals.</p>
        </header>

        <div aria-label="Order sections" className="section-pills">
          <span className="section-pill section-pill--active">All</span>
          <span className="section-pill">Needs action</span>
          <span className="section-pill">History</span>
        </div>

        {canStartOrder ? (
          <Link className="primary-action" href="/orders/new">
            <span aria-hidden="true" className="primary-action__icon">
              <Plus size={21} />
            </span>
            New order
          </Link>
        ) : null}

        {ordersLoadFailed ? (
          <p className="restaurant-empty" role="status">
            Couldn&apos;t load orders. Refresh this page to try again.
          </p>
        ) : null}

        <section
          aria-labelledby="active-orders-heading"
          className="content-section"
        >
          <div className="section-heading-row">
            <h2 id="active-orders-heading">Active</h2>
            <span className="count-badge">{summaries.active.length}</span>
          </div>
          {summaries.active.length === 0 ? (
            <p className="restaurant-empty">
              No active orders right now.{" "}
              {canStartOrder ? "Start one for your group." : "Check back soon."}
            </p>
          ) : (
            summaries.active.map((order) => (
              <ActiveOrderCard key={order.orderId} order={order} />
            ))
          )}
        </section>

        <section aria-labelledby="history-heading" className="content-section">
          <div className="section-heading-row">
            <h2 id="history-heading">History</h2>
          </div>
          {summaries.history.length === 0 ? (
            <p className="restaurant-empty">
              Completed orders will appear here.
            </p>
          ) : (
            <OrderHistoryList
              initialHistory={summaries.history}
              initialNextCursor={summaries.nextCursor}
            />
          )}
        </section>
      </div>
    </MemberAccessState>
  );
}

function ActiveOrderCard({ order }: { readonly order: OrderSummary }) {
  return (
    <Link className="order-card" href={`/orders/${order.orderId}`}>
      <div className="order-card__content">
        <span className="status-label">
          {formatStateLabel(order.state)} · Action needed
        </span>
        <h3>{order.restaurantName ?? order.groupName}</h3>
        <p>
          {order.groupName} · {order.participantsVoted} of{" "}
          {order.participantsTotal} responded
          {order.deadline === null
            ? ""
            : ` · ends ${formatDeadline(order.deadline)}`}
        </p>
      </div>
      <ChevronRight aria-hidden="true" size={22} />
    </Link>
  );
}
