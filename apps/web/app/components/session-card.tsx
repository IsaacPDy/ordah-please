import { ChevronRight, Clock3, Users } from "lucide-react";
import Link from "next/link";
import type { OrderSummary } from "../../src/features/orders/orders-service";

/** A compact, status-first card shared by Home, Sessions, and group overview. */
export function SessionCard({ order }: { readonly order: OrderSummary }) {
  const stage =
    order.state === "restaurant_voting"
      ? "Restaurant voting"
      : order.state === "food_confirmation"
        ? "Food picking"
        : "Ready to finish";
  const responseCount = Math.min(
    order.participantsVoted,
    order.participantsTotal,
  );
  return (
    <Link className="session-card" href={`/orders/${order.orderId}`}>
      <div className="session-card__badges">
        <span
          className={`status-pill ${order.state === "restaurant_voting" ? "status-pill--voting" : "status-pill--complete"}`}
        >
          {stage}
        </span>
        {order.deadline ? (
          <span className="deadline-badge">
            <Clock3 size={12} aria-hidden="true" />
            {new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: "Asia/Manila",
            }).format(order.deadline)}
          </span>
        ) : null}
      </div>
      <h3>{order.groupName}</h3>
      <p>{order.restaurantName ?? "Restaurant pending"}</p>
      <div className="session-card__bottom">
        <div className="session-card__progress">
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Member responses"
            aria-valuemin={0}
            aria-valuemax={order.participantsTotal || 1}
            aria-valuenow={responseCount}
          >
            <span
              style={{
                width: `${order.participantsTotal ? (responseCount / order.participantsTotal) * 100 : 0}%`,
              }}
            />
          </div>
          <small>
            <Users size={12} aria-hidden="true" />
            {responseCount} of {order.participantsTotal} responded
          </small>
        </div>
        <ChevronRight size={20} aria-hidden="true" />
      </div>
    </Link>
  );
}
