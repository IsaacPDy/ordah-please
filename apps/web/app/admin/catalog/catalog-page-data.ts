import type { RestaurantSummaryRow } from "@ordah-please/db";

const ADMIN_CATALOG_PAGE_SIZE = 50;

type RestaurantPreviewReader = (options: {
  readonly limit: number;
  readonly offset?: number;
}) => Promise<readonly RestaurantSummaryRow[]>;

/** Parses one catalog page and reads one extra row to detect a next page. */
export async function loadAdminCatalogPage(
  rawPage: string | undefined,
  listRestaurantPreviews: RestaurantPreviewReader,
) {
  const parsedPage = Number(rawPage);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const rows = await listRestaurantPreviews({
    limit: ADMIN_CATALOG_PAGE_SIZE + 1,
    offset: (page - 1) * ADMIN_CATALOG_PAGE_SIZE,
  });

  return {
    hasNextPage: rows.length > ADMIN_CATALOG_PAGE_SIZE,
    page,
    restaurants: rows.slice(0, ADMIN_CATALOG_PAGE_SIZE),
  };
}
