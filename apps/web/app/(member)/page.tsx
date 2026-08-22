import { ArrowRight, ChevronRight, Clock3, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { catalogRuntime } from "../../src/features/catalog/catalog-runtime";
import { ordersRuntime } from "../../src/features/orders/orders-runtime";
import { formatStateLabel } from "../../src/features/orders/order-format";
import type { OrderSummary } from "../../src/features/orders/orders-service";
import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { MemberAccessState } from "../components/member-access-state";

/** Shows the approved member Home experience with urgent order work, group context, and restaurant discovery. */
export default async function MemberHomePage() {
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;
  const restaurants = await catalogRuntime.catalog.listRestaurants();
  const orderSummaries =
    hasMemberships && identityResult.status === "authenticated"
      ? await ordersRuntime.listOrderSummaries(identityResult.identity.userId)
      : { active: [], history: [] };
  const nearbyCategories = Array.from(
    new Set(restaurants.flatMap((restaurant) => restaurant.cuisines)),
  ).slice(0, 3);
  const firstName =
    identityResult.status === "authenticated"
      ? identityResult.identity.displayName.trim().split(/\s+/)[0] || "there"
      : "there";

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="home">
      <div className="member-page home-page">
        <header className="home-intro">
          <h1>Good morning, {firstName}</h1>
          <p>
            {orderSummaries.active.length === 1
              ? "One group order needs your food choice."
              : orderSummaries.active.length > 1
                ? `${orderSummaries.active.length} group orders need your attention.`
                : "Find something good for your next group order."}
          </p>
        </header>

        {hasMemberships && orderSummaries.active[0] !== undefined ? (
          <ActiveOrderSection
            more={orderSummaries.active.length - 1}
            order={orderSummaries.active[0]}
          />
        ) : null}

        <section
          aria-labelledby="restaurants-title"
          className="restaurant-section"
          id="restaurants"
        >
          <div className="section-heading-row">
            <h2 id="restaurants-title">Nearby restaurants</h2>
            <a href="#restaurant-list">See all</a>
          </div>
          {restaurants.length === 0 ? null : (
            <div
              aria-label="Nearby restaurant categories"
              className="category-chips"
            >
              <span className="category-chip category-chip--active">
                All nearby
              </span>
              {nearbyCategories.map((category) => (
                <span className="category-chip" key={category}>
                  {category}
                </span>
              ))}
            </div>
          )}
          {restaurants.length === 0 ? (
            <p className="restaurant-empty">
              No restaurants published yet. Check back soon.
            </p>
          ) : (
            <div className="restaurant-list" id="restaurant-list">
              {restaurants.map((restaurant) => (
                <Link
                  className="restaurant-card"
                  href={`/restaurants/${restaurant.restaurantId}`}
                  key={restaurant.restaurantId}
                >
                  {restaurant.heroImageUrl ? (
                    <Image
                      alt=""
                      className="restaurant-card__image"
                      height={108}
                      src={restaurant.heroImageUrl}
                      width={240}
                    />
                  ) : (
                    <div className="restaurant-card__image restaurant-card__image--placeholder">
                      {restaurant.restaurantName.charAt(0)}
                    </div>
                  )}
                  <div className="restaurant-card__body">
                    <div>
                      <h3>{restaurant.restaurantName}</h3>
                      <p>
                        {restaurant.cuisines.join(" · ") ||
                          restaurant.branchName}
                      </p>
                    </div>
                    <span className="restaurant-meta">
                      {restaurant.branchName}
                    </span>
                  </div>
                  <ChevronRight
                    aria-hidden="true"
                    className="restaurant-card__chevron"
                    size={21}
                  />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </MemberAccessState>
  );
}

function ActiveOrderSection({
  order,
  more,
}: {
  readonly order: OrderSummary;
  readonly more: number;
}) {
  const callToAction =
    order.state === "restaurant_voting"
      ? "Choose restaurant"
      : order.state === "food_confirmation"
        ? "Confirm your food"
        : "Review handoff";
  return (
    <section aria-labelledby="active-order-title" className="active-order-card">
      <div className="active-order-card__topline">
        <p className="eyebrow">Active group order</p>
        <span className="member-count">
          {order.participantsVoted} of {order.participantsTotal} ready
        </span>
      </div>
      <h2 id="active-order-title">
        {order.restaurantName ?? formatStateLabel(order.state)}
      </h2>
      <p className="active-order-card__context">
        <Users aria-hidden="true" size={18} /> {order.groupName}
        <span aria-hidden="true">·</span>
        <Clock3 aria-hidden="true" size={18} />
        {order.deadline === null
          ? "Waiting for the order manager"
          : `ends ${formatHomeDeadline(order.deadline)}`}
      </p>
      <p className="vote-count">
        {order.participantsVoted} of {order.participantsTotal} responded
      </p>
      <div
        aria-label={`${order.participantsVoted} of ${order.participantsTotal} members responded`}
        aria-valuemax={order.participantsTotal}
        aria-valuemin={0}
        aria-valuenow={order.participantsVoted}
        className="progress-track"
        role="progressbar"
      >
        <span
          style={{
            width: `${(order.participantsVoted / order.participantsTotal) * 100}%`,
          }}
        />
      </div>
      <Link className="primary-action" href={`/orders/${order.orderId}`}>
        {callToAction}
        <ArrowRight aria-hidden="true" size={20} />
      </Link>
      {more > 0 ? (
        <p className="fallback-note">
          <Link href="/orders">+{more} more in Orders</Link>
        </p>
      ) : null}
    </section>
  );
}

/** Keeps the compact Home card readable while preserving the full deadline on Orders. */
function formatHomeDeadline(deadline: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(deadline);
}
