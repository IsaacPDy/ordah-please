import type { FavoritePageRow } from "@ordah-please/db";

import { FavoriteRemoveButton } from "./favorite-remove-button";

export interface FavoriteGroup {
  readonly branchId: string;
  readonly branchName: string;
  readonly restaurantName: string;
  readonly favorites: readonly {
    favoriteId: string;
    name: string;
    priceCentavos: number | null;
    rank: number;
  }[];
}

type MutableFavoriteGroup = {
  branchId: string;
  branchName: string;
  restaurantName: string;
  favorites: {
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
    });
  }

  return groups;
}

/** Presents the member's favorites grouped by restaurant branch. */
export function FavoritesView({ groups }: { readonly groups: readonly FavoriteGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="restaurant-empty">
        No favorites yet — browse restaurants to add your first one.
      </p>
    );
  }

  return (
    <div className="favorites-list">
      {groups.map((group) => (
        <section className="favorites-group" key={group.branchId}>
          <h2 className="favorites-group__title">
            {group.restaurantName} — {group.branchName}
          </h2>
          <ul>
            {group.favorites.map((favorite) => (
              <li className="favorites-favorite" key={favorite.favoriteId}>
                <span className="favorites-favorite__rank">
                  #{favorite.rank}
                </span>
                <span className="favorites-favorite__name">{favorite.name}</span>
                {favorite.priceCentavos !== null ? (
                  <span className="favorites-favorite__price">
                    ₱{(favorite.priceCentavos / 100).toFixed(2)}
                  </span>
                ) : null}
                <FavoriteRemoveButton
                  favoriteId={favorite.favoriteId}
                  mealName={favorite.name}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
