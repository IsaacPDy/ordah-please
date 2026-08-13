"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

interface CatalogGridRestaurant {
  readonly branchId: string;
  readonly branchName: string;
  readonly cuisines: readonly string[];
  readonly heroImageUrl: string | null;
  readonly restaurantId: string;
  readonly restaurantName: string;
}

/** Displays the admin restaurant cards and filters them by typed name. */
export function CatalogGrid({
  restaurants,
}: {
  readonly restaurants: readonly CatalogGridRestaurant[];
}) {
  const [query, setQuery] = useState("");
  const visibleRestaurants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return restaurants;
    return restaurants.filter((restaurant) =>
      restaurant.restaurantName.toLowerCase().includes(normalized),
    );
  }, [query, restaurants]);

  return (
    <div className="admin-catalog">
      <label className="admin-catalog__search">
        <span>Search restaurants</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by restaurant name"
          type="search"
          value={query}
        />
      </label>
      {visibleRestaurants.length === 0 ? (
        <p className="admin-empty">No restaurants match that search.</p>
      ) : (
        <ul className="admin-restaurant-grid">
          {visibleRestaurants.map((restaurant) => (
            <li key={restaurant.restaurantId}>
              <Link
                className="admin-restaurant-card"
                href={`/admin/catalog/${restaurant.restaurantId}/edit`}
              >
                {restaurant.heroImageUrl ? (
                  <Image
                    alt=""
                    className="admin-restaurant-card__hero"
                    height={240}
                    src={restaurant.heroImageUrl}
                    width={480}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="admin-restaurant-card__placeholder"
                  >
                    {restaurant.restaurantName.charAt(0)}
                  </div>
                )}
                <div className="admin-restaurant-card__body">
                  <strong className="admin-restaurant-card__name">
                    {restaurant.restaurantName}
                  </strong>
                  <span className="admin-restaurant-card__branch">
                    {restaurant.branchName}
                  </span>
                  {restaurant.cuisines.length > 0 ? (
                    <ul className="admin-cuisine-tags">
                      {restaurant.cuisines.map((cuisine) => (
                        <li key={cuisine}>{cuisine}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
