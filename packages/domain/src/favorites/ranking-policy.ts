import { FAVORITE_RANKS, type FavoriteRank } from "./favorite.js";

export type FavoriteSavePlan = Readonly<{
  action: "create" | "replace";
  rank: FavoriteRank;
}>;

/** Decides whether a favorite rank creates a new slot or explicitly replaces an occupied one. */
export function planFavoriteSave(input: {
  occupiedRanks: readonly number[];
  requestedRank: number;
  replaceOccupiedRank: boolean;
}): FavoriteSavePlan {
  if (!FAVORITE_RANKS.includes(input.requestedRank as FavoriteRank)) {
    throw new RangeError("Favorite rank must be 1, 2, or 3.");
  }

  const rank = input.requestedRank as FavoriteRank;
  const occupied = input.occupiedRanks.includes(rank);

  if (occupied && !input.replaceOccupiedRank) {
    throw new Error(
      `Favorite rank ${rank} is occupied and must be explicitly replaced.`,
    );
  }

  return { action: occupied ? "replace" : "create", rank };
}
