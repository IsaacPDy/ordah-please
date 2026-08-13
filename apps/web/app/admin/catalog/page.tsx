import { catalogRuntime } from "../../../src/features/catalog/catalog-runtime";
import { AdminPage } from "../../components/admin-page";
import { CatalogGrid } from "./catalog-grid";

/** Lists published restaurants for the Platform Admin. */
export default async function CatalogPage() {
  const restaurants = await catalogRuntime.catalog.listRestaurants();

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
        <CatalogGrid restaurants={restaurants} />
      )}
    </AdminPage>
  );
}
