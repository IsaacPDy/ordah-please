import { ChevronRight, Clock3, Sparkles, Users, Utensils } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { catalogRuntime } from "../../src/features/catalog/catalog-runtime";
import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { MemberAccessState } from "../components/member-access-state";

/** Shows the approved member Home experience with urgent order work, group context, and restaurant discovery. */
export default async function MemberHomePage() {
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;
  const restaurants = await catalogRuntime.catalog.listRestaurants();

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="home">
      <div className="member-page home-page">
        <h1 className="sr-only">Home</h1>

        {hasMemberships ? (
          <section
            aria-labelledby="active-order-title"
            className="active-order-card"
          >
            <p className="eyebrow">Active group order</p>
            <div className="active-order-card__group">
              <span aria-hidden="true" className="group-icon">
                <Users size={22} />
              </span>
              <strong>Friends</strong>
              <ChevronRight aria-hidden="true" size={22} />
              <span className="member-count">7 members</span>
            </div>

            <div className="active-order-card__inner">
              <div className="active-order-card__heading">
                <div>
                  <h2 id="active-order-title">Friday lunch</h2>
                  <p className="deadline">
                    <Clock3 aria-hidden="true" size={18} /> Vote by 11:30 AM
                  </p>
                </div>
                <div
                  aria-label="Four of seven members shown"
                  className="avatar-stack"
                >
                  <span aria-hidden="true">M</span>
                  <span aria-hidden="true">JD</span>
                  <span aria-hidden="true">AK</span>
                  <span aria-hidden="true" className="avatar-more">
                    +3
                  </span>
                </div>
              </div>
              <p className="vote-count">
                <strong>4</strong> of 7 voted
              </p>
              <div
                aria-label="4 of 7 members voted"
                aria-valuemax={7}
                aria-valuemin={0}
                aria-valuenow={4}
                className="progress-track"
                role="progressbar"
              >
                <span />
              </div>
              <Link className="primary-action" href="/orders">
                <span aria-hidden="true" className="primary-action__icon">
                  <Utensils size={21} />
                </span>
                Choose restaurant
              </Link>
              <p className="fallback-note">
                <Sparkles aria-hidden="true" size={18} /> No response?
                Mia&apos;s pick wins.
              </p>
            </div>
          </section>
        ) : null}

        <section
          aria-labelledby="restaurants-title"
          className="restaurant-section"
          id="restaurants"
        >
          <div className="section-heading-row">
            <h2 id="restaurants-title">Restaurants</h2>
          </div>
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
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </MemberAccessState>
  );
}
