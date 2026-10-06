"use client";

import type { FavoriteGroup } from "./favorites-data";
import { useState } from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import Link from "next/link";

import { FavoriteRemoveButton } from "./favorite-remove-button";

/** Presents the member's favorites grouped by restaurant branch. */
export function FavoritesView({
  groups,
}: {
  readonly groups: readonly FavoriteGroup[];
}) {
  const [view, setView] = useState("restaurant");
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(
    null,
  );
  const restaurantNames = Array.from(
    new Set(groups.map((group) => group.restaurantName)),
  );
  const visibleGroups =
    selectedRestaurant === null
      ? groups
      : groups.filter((group) => group.restaurantName === selectedRestaurant);
  if (groups.length === 0) {
    return (
      <section className="favorites-empty">
        <span aria-hidden="true" className="favorites-empty__icon">
          <Heart size={52} strokeWidth={1.7} />
        </span>
        <div>
          <h2>Build your quick picks</h2>
          <p>
            Save a restaurant now, then choose meals faster during the next
            group order.
          </p>
        </div>
        <Link className="primary-action" href="/restaurants">
          Browse restaurants
        </Link>
      </section>
    );
  }

  return (
    <div className={`favorites-list favorites-list--${view}`}>
      <div
        className="segmented-control favorites-view-tabs"
        aria-label="Favorites layout"
      >
        <button
          type="button"
          aria-pressed={view === "restaurant"}
          onClick={() => setView("restaurant")}
        >
          By restaurant
        </button>
        <button
          type="button"
          aria-pressed={view === "all"}
          onClick={() => setView("all")}
        >
          All favorites
        </button>
      </div>
      <div
        className="filter-chips"
        aria-label="Filter usual orders by restaurant"
      >
        <button
          type="button"
          aria-pressed={selectedRestaurant === null}
          onClick={() => setSelectedRestaurant(null)}
        >
          All
        </button>
        {restaurantNames.map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={selectedRestaurant === name}
            onClick={() => setSelectedRestaurant(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {visibleGroups.map((group) => (
        <section className="favorites-group" key={group.branchId}>
          {view === "restaurant" ? (
            <div className="favorites-group__heading">
              <h2>
                {group.restaurantName} — {group.branchName}
              </h2>
              <span>
                {group.favorites.length}{" "}
                {group.favorites.length === 1 ? "favorite" : "favorites"}
              </span>
            </div>
          ) : null}
          <ul>
            {group.favorites.map((favorite) => (
              <li className="usual-order-card" key={favorite.favoriteId}>
                <div className="usual-order-card__image">
                  {favorite.imageUrl ? (
                    <Image
                      src={favorite.imageUrl}
                      width={72}
                      height={72}
                      alt=""
                    />
                  ) : (
                    <Heart size={28} aria-hidden="true" />
                  )}
                  <span className="rank-badge">#{favorite.rank}</span>
                </div>
                <div className="usual-order-card__body">
                  <strong>{favorite.name}</strong>
                  <small>
                    {group.restaurantName} · {group.branchName}
                  </small>
                  {favorite.priceCentavos !== null ? (
                    <span>₱{(favorite.priceCentavos / 100).toFixed(2)}</span>
                  ) : (
                    <small>Price unavailable</small>
                  )}
                </div>
                <FavoriteRemoveButton
                  favoriteId={favorite.favoriteId}
                  mealName={favorite.name}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link className="secondary-action" href="/restaurants">
        Browse restaurants
      </Link>
    </div>
  );
}
