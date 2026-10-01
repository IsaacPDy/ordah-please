import { and, asc, desc, eq } from "drizzle-orm";

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
  "insert" | "select" | "selectDistinctOn" | "update" | "delete"
>;

export interface FavoriteItemRow {
  readonly menuItemId: string;
  readonly quantity: number;
  readonly note: string;
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
  readonly itemDescription: string | null;
  readonly imageUrl: string | null;
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
        .where(
          and(eq(favorites.userId, userId), eq(favorites.branchId, branchId)),
        )
        .orderBy(asc(favorites.rank)),

    listForUserAndBranchWithItems: async (userId, branchId) => {
      const rows = await database
        .select({
          id: favorites.id,
          branchId: favorites.branchId,
          rank: favorites.rank,
          name: favorites.name,
          menuItemId: favoriteItems.menuItemId,
          note: favoriteItems.note,
          quantity: favoriteItems.quantity,
        })
        .from(favorites)
        .leftJoin(favoriteItems, eq(favoriteItems.favoriteId, favorites.id))
        .where(
          and(eq(favorites.userId, userId), eq(favorites.branchId, branchId)),
        )
        .orderBy(
          asc(favorites.rank),
          asc(favoriteItems.sortOrder),
          asc(favoriteItems.id),
        );
      const byFavorite = new Map<
        string,
        {
          id: string;
          branchId: string;
          rank: number;
          name: string;
          items: FavoriteItemRow[];
        }
      >();
      for (const row of rows) {
        let favorite = byFavorite.get(row.id);
        if (favorite === undefined) {
          favorite = {
            id: row.id,
            branchId: row.branchId,
            rank: row.rank,
            name: row.name,
            items: [],
          };
          byFavorite.set(row.id, favorite);
        }
        if (
          row.menuItemId !== null &&
          row.note !== null &&
          row.quantity !== null
        ) {
          favorite.items.push({
            menuItemId: row.menuItemId,
            note: row.note,
            quantity: row.quantity,
          });
        }
      }
      return [...byFavorite.values()];
    },

    listForUser: async (userId) => {
      // Keep one card per favorite even for combinations; choose its last ordered item deterministically.
      const itemPreview = database
        .selectDistinctOn([favoriteItems.favoriteId], {
          favoriteId: favoriteItems.favoriteId,
          menuItemId: menuItems.id,
          basePriceCentavos: menuItems.basePriceCentavos,
          description: menuItems.description,
          imageUrl: menuItems.imageUrl,
          isAvailable: menuItems.isAvailable,
        })
        .from(favoriteItems)
        .innerJoin(favorites, eq(favorites.id, favoriteItems.favoriteId))
        .innerJoin(menuItems, eq(menuItems.id, favoriteItems.menuItemId))
        .where(eq(favorites.userId, userId))
        .orderBy(
          asc(favoriteItems.favoriteId),
          desc(favoriteItems.sortOrder),
          desc(favoriteItems.id),
        )
        .as("favorite_item_preview");

      return database
        .select({
          favoriteId: favorites.id,
          rank: favorites.rank,
          name: favorites.name,
          availability: favorites.availability,
          restaurantId: restaurants.id,
          restaurantName: restaurants.name,
          branchId: branches.id,
          branchName: branches.name,
          menuItemId: itemPreview.menuItemId,
          currentPriceCentavos: itemPreview.basePriceCentavos,
          isCurrentlyAvailable: itemPreview.isAvailable,
          itemDescription: itemPreview.description,
          imageUrl: itemPreview.imageUrl,
        })
        .from(favorites)
        .innerJoin(branches, eq(branches.id, favorites.branchId))
        .innerJoin(restaurants, eq(restaurants.id, branches.restaurantId))
        .leftJoin(itemPreview, eq(itemPreview.favoriteId, favorites.id))
        .where(eq(favorites.userId, userId))
        .orderBy(asc(branches.id), asc(favorites.rank));
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
