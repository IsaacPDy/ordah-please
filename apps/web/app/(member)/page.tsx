import {
  ChevronRight,
  Clock3,
  Heart,
  Sparkles,
  Star,
  Users,
  Utensils,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { MemberAccessState } from "../components/member-access-state";

const restaurants = [
  {
    category: "Comfort Food",
    distance: "1.2 km",
    eta: "25–35 min",
    image: "/images/green-table.jpg",
    name: "Green Table",
    price: "Affordable",
    rating: "4.6",
  },
  {
    category: "Rice Bowls · Healthy",
    distance: "1.6 km",
    eta: "20–30 min",
    image: "/images/fresh-bowls.jpg",
    name: "Fresh Bowls",
    price: "Moderate",
    rating: "4.7",
  },
  {
    category: "Fried Chicken · Comfort Food",
    distance: "1.1 km",
    eta: "25–40 min",
    image: "/images/crispy-chicken.jpg",
    name: "Crispy Chicken",
    price: "Affordable",
    rating: "4.5",
  },
] as const;

/** Shows the approved member Home experience with urgent order work, group context, and restaurant discovery. */
export default async function MemberHomePage() {
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;

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
                  <Image
                    alt="Mia"
                    height={42}
                    src="/images/profile-mia.jpg"
                    width={42}
                  />
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
            <a href="#restaurant-list">See all</a>
          </div>
          <div className="restaurant-list" id="restaurant-list">
            {restaurants.map((restaurant) => (
              <article className="restaurant-card" key={restaurant.name}>
                <Image
                  alt={`${restaurant.name} food`}
                  className="restaurant-card__image"
                  height={180}
                  src={restaurant.image}
                  width={240}
                />
                <div className="restaurant-card__body">
                  <div>
                    <h3>{restaurant.name}</h3>
                    <p>{restaurant.category}</p>
                  </div>
                  <button
                    aria-label={`Add ${restaurant.name} to Favorites`}
                    className="favorite-button"
                    type="button"
                  >
                    <Heart aria-hidden="true" size={22} />
                  </button>
                  <span className="price-tag">₱ {restaurant.price}</span>
                  <p className="restaurant-meta">
                    <Star aria-hidden="true" fill="currentColor" size={16} />{" "}
                    {restaurant.rating} <span>•</span> {restaurant.eta}{" "}
                    <span>•</span> {restaurant.distance}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </MemberAccessState>
  );
}
