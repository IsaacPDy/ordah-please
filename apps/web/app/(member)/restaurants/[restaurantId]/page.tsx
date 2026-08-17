import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { catalogRuntime } from "../../../../src/features/catalog/catalog-runtime";
import { favoritesRuntime } from "../../../../src/features/favorites/favorites-runtime";
import { getCurrentServerPageIdentity } from "../../../../src/auth/load-server-page-identity";

import { FavoriteButton } from "./favorite-button";

/** Member-facing restaurant detail page with a Grab-style menu layout. */
export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const detail = await catalogRuntime.catalog.getRestaurantDetail(restaurantId);
  if (!detail) {
    notFound();
  }

  const heroImage = detail.categories[0]?.items[0]?.imageUrl ?? null;

  const identityResult = await getCurrentServerPageIdentity();
  const favoriteIdByMenuItemId = new Map<string, string>();
  if (identityResult.status === "authenticated") {
    const favoriteRows = await favoritesRuntime.listFavoritesForUser(
      identityResult.identity.userId,
    );
    for (const row of favoriteRows) {
      if (row.branchId === detail.branchId && row.menuItemId !== null) {
        favoriteIdByMenuItemId.set(row.menuItemId, row.favoriteId);
      }
    }
  }

  return (
    <article className="restaurant-detail">
      <Link className="restaurant-detail__back" href="/">
        ← Back
      </Link>

      {heroImage ? (
        <Image
          alt=""
          className="restaurant-detail__hero"
          height={480}
          src={heroImage}
          width={1200}
        />
      ) : (
        <div className="restaurant-detail__hero restaurant-detail__hero--placeholder">
          {detail.restaurantName.charAt(0)}
        </div>
      )}

      <header className="restaurant-detail__header">
        <h1>{detail.restaurantName}</h1>
        <p className="restaurant-detail__branch">{detail.branchName}</p>
        {detail.cuisines.length > 0 ? (
          <ul className="restaurant-detail__cuisines">
            {detail.cuisines.map((cuisine) => (
              <li key={cuisine}>{cuisine}</li>
            ))}
          </ul>
        ) : null}
        {detail.grabUrl ? (
          <a
            className="restaurant-detail__grab"
            href={detail.grabUrl}
            rel="noreferrer"
            target="_blank"
          >
            View on Grab
          </a>
        ) : null}
      </header>

      {detail.categories.length > 0 ? (
        <nav aria-label="Menu categories" className="restaurant-detail__chips">
          {detail.categories.map((category) => (
            <a href={`#category-${slugify(category.name)}`} key={category.name}>
              {category.name}
            </a>
          ))}
        </nav>
      ) : null}

      {detail.categories.map((category) => (
        <section
          className="restaurant-detail__category"
          id={`category-${slugify(category.name)}`}
          key={category.name}
        >
          <h2>{category.name}</h2>
          <ul className="restaurant-detail__items">
            {category.items.map((item) => (
              <li className="restaurant-detail__item" key={item.id}>
                {item.imageUrl ? (
                  <Image alt="" height={112} src={item.imageUrl} width={112} />
                ) : null}
                <div className="restaurant-detail__item-body">
                  <h3>{item.name}</h3>
                  {item.description ? <p>{item.description}</p> : null}
                  <p className="restaurant-detail__price">
                    ₱{(item.basePriceCentavos / 100).toFixed(2)}
                  </p>
                </div>
                <FavoriteButton
                  favoriteId={favoriteIdByMenuItemId.get(item.id) ?? null}
                  initiallyFavorited={favoriteIdByMenuItemId.has(item.id)}
                  menuItemId={item.id}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
