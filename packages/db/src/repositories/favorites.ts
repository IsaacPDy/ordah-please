import { and, asc, eq, inArray } from "drizzle-orm";

import {
  branches,
  favoriteItems,
  favorites,
  menuItems,
  restaurants,
} from "../schema/index.js";
import type { DatabaseTransaction } from "../transaction.js";

type FavoritesDatabase = Pick<
  DatabaseTransaction,
  "insert" | "select" | "update" | "delete"
>;

export interface FavoriteItemRow {
  readonly menuItemId: string;
  readonly quantity: number;
}

export interface FavoriteWithItemsRow {
  readonly id: string;
  readonly branchId: string;
  readonly rank: number;
  readonly name: string;
  readonly items: readonly FavoriteItemRow[];
}

export interface FavoritePageRow {
  readonly favoriteId: string;
  readonly rank: number;
  readonly name: string;
  readonly availability: "available" | "unavailable";
  readonly restaurantId: string;
  readonly restaurantName: string;
  readonly branchId: string;
  readonly branchName: string;
  readonly menuItemId: string | null;
  readonly currentPriceCentavos: number | null;
  readonly isCurrentlyAvailable: boolean | null;
}

export interface InsertFavoriteWithItemInput {
  readonly userId: string;
  readonly branchId: string;
  readonly menuVersionId: string;
  readonly rank: number;
  readonly name: string;
  readonly availability: "available" | "unavailable";
  readonly menuItemId: string;
  readonly quantity: number;
}

export interface FavoritesRepository {
  listForUserAndBranch(
    userId: string,
    branchId: string,
  ): Promise<readonly (typeof favorites.$inferSelect)[]>;
  listForUserAndBranchWithItems(
    userId: string,
    branchId: string,
  ): Promise<readonly FavoriteWithItemsRow[]>;
  listForUser(userId: string): Promise<readonly FavoritePageRow[]>;
  insertFavoriteWithItem(
    input: InsertFavoriteWithItemInput,
  ): Promise<{ readonly id: string }>;
  deleteFavoriteForUser(
    userId: string,
    favoriteId: string,
  ): Promise<{ readonly branchId: string; readonly rank: number } | undefined>;
  updateFavoriteRank(favoriteId: string, rank: number): Promise<void>;
}

/** Creates ranked-favorite reads and member-owned writes over favorites data. */
export function createFavoritesRepository(
  database: FavoritesDatabase,
): FavoritesRepository {
  return {
    listForUserAndBranch: (userId, branchId) =>
      database
        .select()
        .from(favorites)
        .where(and(eq(favorites.userId, userId), eq(favorites.branchId, branchId)))
        .orderBy(asc(favorites.rank)),

    listForUserAndBranchWithItems: async (userId, branchId) => {
      const favoriteRows = await database
        .select()
        .from(favorites)
        .where(
          and(eq(favorites.userId, userId), eq(favorites.branchId, branchId)),
        )
        .orderBy(asc(favorites.rank));
      // Rank is unique per user+branch, so at most 3 favorites exist here and
      // per-favorite item queries stay bounded.
      const withItems: FavoriteWithItemsRow[] = [];
      for (const favorite of favoriteRows) {
        const itemRows = await database
          .select()
          .from(favoriteItems)
          .where(eq(favoriteItems.favoriteId, favorite.id));
        withItems.push({
          id: favorite.id,
          branchId: favorite.branchId,
          rank: favorite.rank,
          name: favorite.name,
          items: itemRows.map((row) => ({
            menuItemId: row.menuItemId,
            quantity: row.quantity,
          })),
        });
      }
      return withItems;
    },

    listForUser: async (userId) => {
      const favoriteRows = await database
        .select({
          favoriteId: favorites.id,
          rank: favorites.rank,
          name: favorites.name,
          availability: favorites.availability,
          restaurantId: restaurants.id,
          restaurantName: restaurants.name,
          branchId: branches.id,
          branchName: branches.name,
        })
        .from(favorites)
        .innerJoin(branches, eq(branches.id, favorites.branchId))
        .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
        .where(eq(favorites.userId, userId))
        .orderBy(asc(branches.id), asc(favorites.rank));
      if (favoriteRows.length === 0) return [];

      const favoriteIds = favoriteRows.map((row) => row.favoriteId);
      const itemRows = await database
        .select({
          favoriteId: favoriteItems.favoriteId,
          menuItemId: menuItems.id,
          basePriceCentavos: menuItems.basePriceCentavos,
          isAvailable: menuItems.isAvailable,
        })
        .from(favoriteItems)
        .innerJoin(menuItems, eq(menuItems.id, favoriteItems.menuItemId))
        .where(inArray(favoriteItems.favoriteId, favoriteIds));

      const itemByFavorite = new Map<string, (typeof itemRows)[number]>();
      for (const row of itemRows) {
        itemByFavorite.set(row.favoriteId, row);
      }

      return favoriteRows.map((row) => {
        const item = itemByFavorite.get(row.favoriteId);
        return {
          favoriteId: row.favoriteId,
          rank: row.rank,
          name: row.name,
          availability: row.availability,
          restaurantId: row.restaurantId,
          restaurantName: row.restaurantName,
          branchId: row.branchId,
          branchName: row.branchName,
          menuItemId: item?.menuItemId ?? null,
          currentPriceCentavos: item?.basePriceCentavos ?? null,
          isCurrentlyAvailable: item?.isAvailable ?? null,
        };
      });
    },

    insertFavoriteWithItem: async (input) => {
      const [favorite] = await database
        .insert(favorites)
        .values({
          userId: input.userId,
          branchId: input.branchId,
          menuVersionId: input.menuVersionId,
          rank: input.rank,
          name: input.name,
          availability: input.availability,
        })
        .returning({ id: favorites.id });
      if (favorite === undefined) {
        throw new Error("Expected the favorite insert to return its id.");
      }

      await database.insert(favoriteItems).values({
        favoriteId: favorite.id,
        menuItemId: input.menuItemId,
        quantity: input.quantity,
        sortOrder: 0,
      });

      return { id: favorite.id };
    },

    deleteFavoriteForUser: async (userId, favoriteId) => {
      const rows = await database
        .delete(favorites)
        .where(and(eq(favorites.id, favoriteId), eq(favorites.userId, userId)))
        .returning({
          branchId: favorites.branchId,
          rank: favorites.rank,
        });
      return rows[0];
    },

    updateFavoriteRank: async (favoriteId, rank) => {
      await database
        .update(favorites)
        .set({ rank, updatedAt: new Date() })
        .where(eq(favorites.id, favoriteId));
    },
  };
}
