import { ArrowRight, ChevronRight, Heart, Plus, Store } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { listCachedRestaurantPreviews } from "../../src/features/catalog/catalog-cache";
import { ordersRuntime } from "../../src/features/orders/orders-runtime";
import { favoritesRuntime } from "../../src/features/favorites/favorites-runtime";
import { formatHistoryDate } from "../../src/features/orders/order-format";
import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { MemberAccessState } from "../components/member-access-state";
import { SessionCard } from "../components/session-card";
import { loadMemberHomeData } from "./home-data";

/** Session-first Home uses the viewer's real orders and personal ranked usuals. */
export default async function MemberHomePage() {
  const identityResult = await getCurrentServerPageIdentity();
  const identity =
    identityResult.status === "authenticated" ? identityResult.identity : null;
  const hasMemberships = !!identity?.memberships.length;
  const canStartOrder =
    identity?.memberships.some(
      (membership) =>
        membership.role === "group-owner" || membership.role === "manager",
    ) ?? false;
  const [homeResult, favoritesResult] = await Promise.allSettled([
    identity
      ? loadMemberHomeData(identity, {
          listOrderSummaryPage: (viewer) =>
            ordersRuntime.listOrderSummaryPage({
              identity: viewer,
              cursor: null,
              limit: 3,
            }),
          listRestaurantPreviews: listCachedRestaurantPreviews,
        })
      : Promise.resolve({
          errors: { orders: false, restaurants: false },
          orderSummaries: { active: [], history: [], nextCursor: null },
          restaurants: await listCachedRestaurantPreviews({ limit: 6 }),
        }),
    identity
      ? favoritesRuntime.listFavoritesForUser(identity.userId)
      : Promise.resolve([]),
  ]);
  const data =
    homeResult.status === "fulfilled"
      ? homeResult.value
      : {
          errors: { orders: true, restaurants: true },
          orderSummaries: { active: [], history: [], nextCursor: null },
          restaurants: [],
        };
  const favorites =
    favoritesResult.status === "fulfilled" ? favoritesResult.value : [];
  const firstName = identity?.displayName.trim().split(/\s+/)[0] || "there";

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="home">
      <div className="member-page home-page">
        <header className="home-intro">
          <h1>Good morning, {firstName}</h1>
          <p>Time for a group order?</p>
        </header>
        {canStartOrder ? (
          <Link className="home-start-order" href="/orders/new">
            <span className="home-start-order__icon">
              <Plus size={25} aria-hidden="true" />
            </span>
            <div>
              <strong>Start a group order</strong>
              <small>Choose a group and set it up</small>
            </div>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        ) : null}
        {hasMemberships ? (
          <section className="content-section" aria-labelledby="home-sessions">
            <div className="section-heading-row">
              <h2 id="home-sessions">Active sessions</h2>
              <Link href="/orders">See all</Link>
            </div>
            <div className="session-list">
              {data.orderSummaries.active.slice(0, 2).map((order) => (
                <SessionCard order={order} key={order.orderId} />
              ))}
            </div>
            {data.errors.orders ? (
              <p role="status" className="restaurant-empty">
                Couldn’t load active sessions. Refresh to try again.
              </p>
            ) : data.orderSummaries.active.length === 0 ? (
              <p className="restaurant-empty">No active sessions right now.</p>
            ) : null}
          </section>
        ) : null}
        <section className="content-section" aria-labelledby="home-usuals">
          <div className="section-heading-row">
            <h2 id="home-usuals">Your usuals</h2>
            <Link href="/favorites">See all</Link>
          </div>
          {favorites.length > 0 ? (
            <div className="home-usuals">
              {favorites.slice(0, 3).map((favorite) => (
                <Link
                  className="home-usual-card"
                  href="/favorites"
                  key={favorite.favoriteId}
                >
                  <div className="usual-order-card__image">
                    {favorite.imageUrl ? (
                      <Image
                        src={favorite.imageUrl}
                        alt=""
                        height={64}
                        width={64}
                      />
                    ) : (
                      <Heart size={25} aria-hidden="true" />
                    )}
                    <span className="rank-badge">#{favorite.rank}</span>
                  </div>
                  <div>
                    <strong>{favorite.name}</strong>
                    <small>
                      {favorite.restaurantName} · {favorite.branchName}
                    </small>
                    {favorite.currentPriceCentavos !== null ? (
                      <span>
                        ₱{(favorite.currentPriceCentavos / 100).toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p
              className="restaurant-empty"
              role={
                favoritesResult.status === "rejected" ? "status" : undefined
              }
            >
              {favoritesResult.status === "rejected"
                ? "Couldn’t load your usuals. Refresh to try again."
                : "Save your favorite meals for a quicker next order."}
            </p>
          )}
        </section>
        {hasMemberships ? (
          <section className="content-section" aria-labelledby="home-recent">
            <div className="section-heading-row">
              <h2 id="home-recent">Recent group orders</h2>
              <Link href="/orders?tab=past">See all</Link>
            </div>
            <div className="recent-orders">
              {data.orderSummaries.history.map((order) => (
                <Link
                  className="recent-order-card"
                  href={`/orders/${order.orderId}`}
                  key={order.orderId}
                >
                  <span className="recent-order-image">
                    {order.restaurantImageUrl ? (
                      <Image
                        src={order.restaurantImageUrl}
                        alt=""
                        width={52}
                        height={52}
                      />
                    ) : (
                      <Store size={26} aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <strong>
                      {order.restaurantName ?? "Restaurant pending"}
                    </strong>
                    <small>
                      {order.groupName}
                      {order.completedAt
                        ? ` · ${formatHistoryDate(order.completedAt)}`
                        : ""}
                    </small>
                    <small>{order.participantsTotal} people</small>
                  </div>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
            {data.orderSummaries.history.length === 0 ? (
              <p className="restaurant-empty">
                Completed orders will appear here.
              </p>
            ) : null}
          </section>
        ) : null}
        <section
          aria-labelledby="restaurants-title"
          className="restaurant-section"
          id="restaurants"
        >
          <div className="section-heading-row">
            <h2 id="restaurants-title">Browse restaurants</h2>
            <Link href="/restaurants">See all</Link>
          </div>
          {data.errors.restaurants ? (
            <p role="status">
              Couldn’t load restaurants. Refresh to try again.
            </p>
          ) : data.restaurants.length === 0 ? (
            <p className="restaurant-empty">
              No restaurants published yet. Check back soon.
            </p>
          ) : (
            <div className="restaurant-list">
              {data.restaurants.slice(0, 3).map((restaurant) => (
                <Link
                  className="restaurant-card"
                  href={`/restaurants/${restaurant.restaurantId}`}
                  key={restaurant.restaurantId}
                >
                  {restaurant.heroImageUrl ? (
                    <Image
                      alt=""
                      className="restaurant-card__image"
                      height={68}
                      width={68}
                      src={restaurant.heroImageUrl}
                    />
                  ) : (
                    <Store size={28} aria-hidden="true" />
                  )}
                  <div className="restaurant-card__body">
                    <h3>{restaurant.restaurantName}</h3>
                    <p>{restaurant.branchName}</p>
                  </div>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </MemberAccessState>
  );
}
