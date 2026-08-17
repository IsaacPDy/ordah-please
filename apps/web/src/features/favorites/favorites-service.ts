import { PublicApiError } from "@ordah-please/contracts";
import type {
  FavoriteId,
  FavoriteRank,
  MenuItemId,
  UserId,
} from "@ordah-please/domain";
import { parseId } from "@ordah-please/domain";

export interface FavoriteMenuItemContext {
  readonly menuItemId: string;
  readonly name: string;
  readonly basePriceCentavos: number;
  readonly isAvailable: boolean;
  readonly branchId: string;
  readonly menuVersionId: string;
}

export interface FavoritesServiceRepositories {
  readonly catalog: {
    readonly findMenuItemContext: (
      menuItemId: string,
    ) => Promise<FavoriteMenuItemContext | undefined>;
  };
  readonly favorites: {
    readonly listForUserAndBranchWithItems: (
      userId: string,
      branchId: string,
    ) => Promise<
      readonly {
        id: string;
        branchId: string;
        rank: number;
        name: string;
        items: readonly { menuItemId: string; quantity: number }[];
      }[]
    >;
    readonly insertFavoriteWithItem: (input: {
      userId: string;
      branchId: string;
      menuVersionId: string;
      rank: number;
      name: string;
      availability: "available" | "unavailable";
      menuItemId: string;
      quantity: number;
    }) => Promise<{ readonly id: string }>;
    readonly deleteFavoriteForUser: (
      userId: string,
      favoriteId: string,
    ) => Promise<{ branchId: string; rank: number } | undefined>;
    readonly updateFavoriteRank: (
      favoriteId: string,
      rank: number,
    ) => Promise<void>;
  };
}

export interface FavoritesTransactionRunner {
  run<Result>(
    operation: (repositories: FavoritesServiceRepositories) => Promise<Result>,
  ): Promise<Result>;
}

const FAVORITE_RANKS = [1, 2, 3] as const;
const FAVORITE_LIMIT = 3;

/** Saves one menu item as the member's next ranked favorite at its branch. */
export async function saveFavoriteMeal(
  command: Readonly<{ userId: UserId; menuItemId: MenuItemId }>,
  transactionRunner: FavoritesTransactionRunner,
): Promise<{ favoriteId: FavoriteId; rank: FavoriteRank }> {
  return transactionRunner.run(async (repositories) => {
    const item = await repositories.catalog.findMenuItemContext(
      command.menuItemId,
    );
    if (item === undefined) {
      throw new PublicApiError("NOT_FOUND", "This meal is not on the menu.");
    }

    const existing = await repositories.favorites.listForUserAndBranchWithItems(
      command.userId,
      item.branchId,
    );
    if (
      existing.some((favorite) =>
        favorite.items.some((itemRow) => itemRow.menuItemId === item.menuItemId),
      )
    ) {
      throw new PublicApiError(
        "CONFLICT",
        "This meal is already one of your favorites here.",
      );
    }
    if (existing.length >= FAVORITE_LIMIT) {
      throw new PublicApiError(
        "CONFLICT",
        "You already have 3 favorites here — remove one first.",
      );
    }

    const usedRanks = new Set(existing.map((favorite) => favorite.rank));
    const rank = FAVORITE_RANKS.find(
      (candidate) => !usedRanks.has(candidate),
    );
    if (rank === undefined) {
      throw new PublicApiError(
        "CONFLICT",
        "You already have 3 favorites here — remove one first.",
      );
    }

    const inserted = await repositories.favorites.insertFavoriteWithItem({
      userId: command.userId,
      branchId: item.branchId,
      menuVersionId: item.menuVersionId,
      rank,
      name: item.name,
      availability: item.isAvailable ? "available" : "unavailable",
      menuItemId: item.menuItemId,
      quantity: 1,
    });

    return { favoriteId: parseId<FavoriteId>(inserted.id), rank };
  });
}

/** Removes one of the member's favorites and compacts the remaining ranks. */
export async function removeFavoriteMeal(
  command: Readonly<{ userId: UserId; favoriteId: FavoriteId }>,
  transactionRunner: FavoritesTransactionRunner,
): Promise<Readonly<{ ok: true }>> {
  return transactionRunner.run(async (repositories) => {
    const removed = await repositories.favorites.deleteFavoriteForUser(
      command.userId,
      command.favoriteId,
    );
    if (removed === undefined) {
      throw new PublicApiError("NOT_FOUND", "Favorite not found.");
    }

    const remaining = await repositories.favorites.listForUserAndBranchWithItems(
      command.userId,
      removed.branchId,
    );
    const ordered = [...remaining].sort((left, right) => left.rank - right.rank);
    for (const [index, favorite] of ordered.entries()) {
      const targetRank = index + 1;
      if (favorite.rank !== targetRank) {
        await repositories.favorites.updateFavoriteRank(
          favorite.id,
          targetRank,
        );
      }
    }

    return { ok: true } as const;
  });
}
