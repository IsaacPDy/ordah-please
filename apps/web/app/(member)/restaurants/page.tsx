import Image from "next/image";
import Link from "next/link";

import { listCachedRestaurantPreviews } from "../../../src/features/catalog/catalog-cache";

const RESTAURANT_PAGE_SIZE = 20;

/** Lists every published restaurant through small, stable member-facing pages. */
export default async function RestaurantsPage({
  searchParams = Promise.resolve({}),
}: {
  readonly searchParams?: Promise<{ readonly page?: string }>;
} = {}) {
  const { page: rawPage } = await searchParams;
  const parsedPage = Number(rawPage);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const rows = await listCachedRestaurantPreviews({
    limit: RESTAURANT_PAGE_SIZE + 1,
    offset: (page - 1) * RESTAURANT_PAGE_SIZE,
  });
  const hasNextPage = rows.length > RESTAURANT_PAGE_SIZE;
  const restaurants = rows.slice(0, RESTAURANT_PAGE_SIZE);

  return (
    <div className="member-page">
      <header className="page-intro">
        <p className="eyebrow">Restaurant discovery</p>
        <h1>All restaurants</h1>
        <p>Browse published restaurants and their exact branches.</p>
      </header>
      {restaurants.length === 0 ? (
        <p className="restaurant-empty">No restaurants on this page.</p>
      ) : (
        <div className="restaurant-list">
          {restaurants.map((restaurant) => (
            <Link
              className="restaurant-card"
              href={`/restaurants/${restaurant.restaurantId}`}
              key={`${restaurant.restaurantId}:${restaurant.branchId}`}
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
                <h2>{restaurant.restaurantName}</h2>
                <p>{restaurant.branchName}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <nav aria-label="Restaurant pages" className="admin-pagination">
        {page > 1 ? (
          <Link href={`/restaurants?page=${page - 1}`}>Previous</Link>
        ) : null}
        <span>Page {page}</span>
        {hasNextPage ? (
          <Link href={`/restaurants?page=${page + 1}`}>Next</Link>
        ) : null}
      </nav>
    </div>
  );
}
