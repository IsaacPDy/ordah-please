import { describe, expect, it } from "vitest";

import * as domain from "../index.js";

type PlanFavoriteSave = (input: {
  occupiedRanks: readonly number[];
  requestedRank: number;
  replaceOccupiedRank: boolean;
}) => { action: "create" | "replace"; rank: number };

/** Loads the planned policy while keeping the first RED run executable. */
function policy(): PlanFavoriteSave {
  const candidate: unknown =
    "planFavoriteSave" in domain ? domain.planFavoriteSave : undefined;
  expect(candidate).toBeTypeOf("function");
  return candidate as PlanFavoriteSave;
}

describe("planFavoriteSave", () => {
  it("creates favorites only in ranks 1 through 3", () => {
    expect(
      policy()({
        occupiedRanks: [],
        requestedRank: 1,
        replaceOccupiedRank: false,
      }),
    ).toEqual({
      action: "create",
      rank: 1,
    });
    expect(() =>
      policy()({
        occupiedRanks: [],
        requestedRank: 4,
        replaceOccupiedRank: false,
      }),
    ).toThrow("Favorite rank must be 1, 2, or 3.");
  });

  it("requires explicit replacement when the requested rank is occupied", () => {
    expect(() =>
      policy()({
        occupiedRanks: [1, 2, 3],
        requestedRank: 2,
        replaceOccupiedRank: false,
      }),
    ).toThrow("Favorite rank 2 is occupied and must be explicitly replaced.");

    expect(
      policy()({
        occupiedRanks: [1, 2, 3],
        requestedRank: 2,
        replaceOccupiedRank: true,
      }),
    ).toEqual({ action: "replace", rank: 2 });
  });
});
