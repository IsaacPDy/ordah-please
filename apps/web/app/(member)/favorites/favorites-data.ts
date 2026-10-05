import type { FavoritePageRow } from "@ordah-please/db";

export interface FavoriteGroup {
  readonly branchId: string;
  readonly branchName: string;
  readonly restaurantName: string;
  readonly favorites: readonly {
    favoriteId: string;
    name: string;
    priceCentavos: number | null;
    rank: number;
    imageUrl?: string | null;
  }[];
}

type MutableFavoriteGroup = {
  branchId: string;
  branchName: string;
  restaurantName: string;
  favorites: {
    imageUrl?: string | null;
    favoriteId: string;
    name: string;
    priceCentavos: number | null;
    rank: number;
  }[];
};

/** Groups favorites page rows by branch, preserving rank order inside each group. */
export function groupFavoritesByBranch(
  rows: readonly FavoritePageRow[],
): readonly FavoriteGroup[] {
  const groups: MutableFavoriteGroup[] = [];
  const groupByBranchId = new Map<string, MutableFavoriteGroup>();

  for (const row of [...rows].sort((left, right) => left.rank - right.rank)) {
    let group = groupByBranchId.get(row.branchId);
    if (group === undefined) {
      group = {
        branchId: row.branchId,
        branchName: row.branchName,
        favorites: [],
        restaurantName: row.restaurantName,
      };
      groupByBranchId.set(row.branchId, group);
      groups.push(group);
    }
    group.favorites.push({
      favoriteId: row.favoriteId,
      name: row.name,
      priceCentavos: row.currentPriceCentavos,
      rank: row.rank,
      ...(row.imageUrl ? { imageUrl: row.imageUrl } : {}),
    });
  }

  return groups;
}
