import { Clock3, MapPin } from "lucide-react";
import { notFound } from "next/navigation";

import { PublicApiError } from "@ordah-please/contracts";

import { getCurrentServerPageIdentity } from "../../../../src/auth/load-server-page-identity";
import {
  formatDeadline,
  formatStateLabel,
} from "../../../../src/features/orders/order-format";
import { ordersRuntime } from "../../../../src/features/orders/orders-runtime";
import { MemberAccessState } from "../../../components/member-access-state";
import { CancelOrderButton } from "./cancel-order-button";

/** The living order page: one destination that adapts to the order's state. */
export default async function OrderDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) {
  const { orderId } = await params;
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;

  let view:
    Awaited<ReturnType<typeof ordersRuntime.loadOrderDetailView>> | undefined;
  if (identityResult.status === "authenticated") {
    try {
      view = await ordersRuntime.loadOrderDetailView(
        identityResult.identity,
        orderId,
      );
    } catch (error) {
      if (
        error instanceof PublicApiError &&
        (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
      ) {
        notFound();
      }
      throw error;
    }
  }

  if (!view) {
    return (
      <MemberAccessState hasMemberships={hasMemberships} surface="orders">
        {null}
      </MemberAccessState>
    );
  }

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="orders">
      <div className="member-page">
        <header className="page-intro">
          <p className="eyebrow">{view.order.groupName}</p>
          <h1>
            {view.order.restaurantName ?? "Group order"}{" "}
            <span className="status-pill status-pill--soft">
              {formatStateLabel(view.order.state)}
            </span>
          </h1>
          <p>
            {view.order.state === "restaurant_voting"
              ? `Fallback restaurant: ${view.order.initialRestaurantName} (${view.order.initialBranchName})`
              : `${view.order.initialRestaurantName} · ${view.order.initialBranchName}`}
          </p>
          {view.order.state === "restaurant_voting" ||
          view.order.state === "food_confirmation" ||
          view.order.state === "ready_for_handoff" ? (
            <>
              <p className="deadline">
                <Clock3 aria-hidden="true" size={16} /> Voting ends{" "}
                {formatDeadline(view.order.restaurantDeadline)}
              </p>
              <p className="deadline">
                <Clock3 aria-hidden="true" size={16} /> Food picks end{" "}
                {formatDeadline(view.order.foodDeadline)}
              </p>
            </>
          ) : null}
          <p>
            <MapPin aria-hidden="true" size={16} />{" "}
            {view.order.deliveryAddress.lineOne},{" "}
            {view.order.deliveryAddress.city}
          </p>
        </header>

        {view.order.state === "restaurant_voting" ? (
          <p className="restaurant-empty">
            Restaurant voting opens here in the next update.
          </p>
        ) : null}
        {view.order.state === "food_confirmation" ? (
          <p className="restaurant-empty">
            Food picks open here in the next update.
          </p>
        ) : null}

        <section
          aria-labelledby="participants-heading"
          className="content-section"
        >
          <div className="section-heading-row">
            <h2 id="participants-heading">Participants</h2>
            <span className="count-badge">{view.participants.length}</span>
          </div>
          <ul className="group-list">
            {view.participants.map((participant) => (
              <li className="group-card" key={participant.userId}>
                <span aria-hidden="true" className="group-card__icon">
                  {participant.displayName.charAt(0)}
                </span>
                <span className="group-card__body">
                  <span className="group-card__name">
                    {participant.displayName}
                  </span>
                  <span className="group-card__meta">
                    {participant.role === "manager"
                      ? "Order manager"
                      : "Member"}{" "}
                    ·{" "}
                    {participant.restaurantResponse === "responded"
                      ? "Voted"
                      : "Hasn't voted"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {view.viewer.canManage &&
        view.order.state !== "ordered" &&
        view.order.state !== "cancelled" ? (
          <CancelOrderButton orderId={view.order.orderId} />
        ) : null}
      </div>
    </MemberAccessState>
  );
}
