import Link from "next/link";

import { listCachedRestaurantPreviews } from "../../../src/features/catalog/catalog-cache";
import { AdminPage } from "../../components/admin-page";
import { loadAdminCatalogPage } from "./catalog-page-data";
import { CatalogGrid } from "./catalog-grid";

/** Lists published restaurants for the Platform Admin. */
export default async function CatalogPage({
  searchParams = Promise.resolve({}),
}: {
  readonly searchParams?: Promise<{ readonly page?: string }>;
} = {}) {
  const { page: rawPage } = await searchParams;
  const { hasNextPage, page, restaurants } = await loadAdminCatalogPage(
    rawPage,
    listCachedRestaurantPreviews,
  );

  return (
    <AdminPage
      description="Click a restaurant to edit its details and menu."
      eyebrow="Restaurant data"
      title="Published restaurants"
    >
      {restaurants.length === 0 ? (
        <p className="admin-empty admin-catalog-empty">
          No restaurants yet. Import a CSV to get started.
        </p>
      ) : (
        <>
          <CatalogGrid restaurants={restaurants} />
          <nav aria-label="Catalog pages" className="admin-pagination">
            {page > 1 ? (
              <Link href={`/admin/catalog?page=${page - 1}`}>Previous</Link>
            ) : null}
            <span>Page {page}</span>
            {hasNextPage ? (
              <Link href={`/admin/catalog?page=${page + 1}`}>Next</Link>
            ) : null}
          </nav>
        </>
      )}
    </AdminPage>
  );
}
