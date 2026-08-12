import { notFound } from "next/navigation";

import { catalogRuntime } from "../../../../../src/features/catalog/catalog-runtime";
import { AdminPage } from "../../../../components/admin-page";
import { EditForm, type Detail } from "./edit-form";

/** Platform Admin edit screen for one restaurant. */
export default async function EditPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const detail = await catalogRuntime.catalog.getRestaurantDetail(restaurantId);
  if (!detail) {
    notFound();
  }

  const initial: Detail = {
    restaurantId: detail.restaurantId,
    restaurantName: detail.restaurantName,
    cuisines: detail.cuisines,
    branchId: detail.branchId,
    branchName: detail.branchName,
    grabUrl: detail.grabUrl,
    menuVersionPublishedAt:
      detail.menuVersionPublishedAt instanceof Date
        ? detail.menuVersionPublishedAt.toISOString()
        : detail.menuVersionPublishedAt,
    categories: detail.categories.map((category) => ({
      name: category.name,
      items: category.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        basePriceCentavos: item.basePriceCentavos,
        isAvailable: item.isAvailable,
        imageUrl: item.imageUrl,
        sortOrder: item.sortOrder,
      })),
    })),
  };

  return (
    <AdminPage
      description="Edits apply to the current published menu version."
      eyebrow="Restaurant data"
      title={`Edit ${detail.restaurantName}`}
    >
      <EditForm initial={initial} />
    </AdminPage>
  );
}
