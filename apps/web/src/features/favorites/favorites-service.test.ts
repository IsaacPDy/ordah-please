import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type FavoriteId, type MenuItemId, type UserId } from "@ordah-please/domain";
import { describe, expect, it } from "vitest";

import {
  removeFavoriteMeal,
  saveFavoriteMeal,
  type FavoritesServiceRepositories,
} from "./favorites-service";

const menuItemId = parseId<MenuItemId>(
  "11111111-1111-4111-8111-111111111111",
);
const otherMenuItemId = parseId<MenuItemId>(
  "22222222-2222-4222-8222-222222222222",
);
const thirdMenuItemId = parseId<MenuItemId>(
  "55555555-5555-4555-8555-555555555555",
);
const userId = parseId<UserId>("33333333-3333-4333-8333-333333333333");
const otherUserId = parseId<UserId>("44444444-4444-4444-8444-444444444444");

interface Harness {
  readonly repositories: FavoritesServiceRepositories;
  favorites: {
    id: string;
    branchId: string;
    rank: number;
    name: string;
    items: { menuItemId: string; quantity: number }[];
    userId: string;
  }[];
  rankUpdates: { favoriteId: string; rank: number }[];
}

const menuItemContexts = {
  [menuItemId]: {
    menuItemId,
    name: "Chicken Meal",
    basePriceCentavos: 25000,
    isAvailable: true,
    branchId: "branch-1",
    menuVersionId: "version-1",
  },
  [otherMenuItemId]: {
    menuItemId: otherMenuItemId,
    name: "Other Meal",
    basePriceCentavos: 15000,
    isAvailable: true,
    branchId: "branch-1",
    menuVersionId: "version-1",
  },
  [thirdMenuItemId]: {
    menuItemId: thirdMenuItemId,
    name: "Third Meal",
    basePriceCentavos: 9900,
    isAvailable: false,
    branchId: "branch-1",
    menuVersionId: "version-1",
  },
} as const;

function createHarness(): Harness {
  const harness: Harness = {
    favorites: [],
    rankUpdates: [],
    repositories: {
      catalog: {
        findMenuItemContext: (id: string) =>
          Promise.resolve(menuItemContexts[id as keyof typeof menuItemContexts]),
      },
      favorites: {
        listForUserAndBranchWithItems: (userId: string, branchId: string) =>
          Promise.resolve(
            harness.favorites
              .filter(
                (favorite) =>
                  favorite.userId === userId && favorite.branchId === branchId,
              )
              .sort((left, right) => left.rank - right.rank),
          ),
        insertFavoriteWithItem: (input) => {
          const id = `favorite-${harness.favorites.length + 1}`;
          harness.favorites.push({
            id,
            branchId: input.branchId,
            rank: input.rank,
            name: input.name,
            items: [{ menuItemId: input.menuItemId, quantity: input.quantity }],
            userId: input.userId,
          });
          return Promise.resolve({ id });
        },
        deleteFavoriteForUser: (userId: string, favoriteId: string) => {
          const index = harness.favorites.findIndex(
            (favorite) =>
              favorite.id === favoriteId && favorite.userId === userId,
          );
          if (index === -1) return Promise.resolve(undefined);
          const [removed] = harness.favorites.splice(index, 1);
          return Promise.resolve({
            branchId: removed!.branchId,
            rank: removed!.rank,
          });
        },
        updateFavoriteRank: (favoriteId: string, rank: number) => {
          harness.rankUpdates.push({ favoriteId, rank });
          const favorite = harness.favorites.find(
            (candidate) => candidate.id === favoriteId,
          );
          if (favorite) favorite.rank = rank;
          return Promise.resolve();
        },
      },
    },
  };
  return harness;
}

function run(harness: Harness) {
  return {
    run: <Result>(
      operation: (repositories: FavoritesServiceRepositories) => Promise<Result>,
    ) => operation(harness.repositories),
  };
}

/** Runs one operation and returns the thrown error instead of failing the test. */
async function captureError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("saveFavoriteMeal", () => {
  it("assigns ranks 1, 2, and 3 in order of saving", async () => {
    const harness = createHarness();
    const first = await saveFavoriteMeal({ userId, menuItemId }, run(harness));
    const second = await saveFavoriteMeal(
      { userId, menuItemId: otherMenuItemId },
      run(harness),
    );
    const third = await saveFavoriteMeal(
      { userId, menuItemId: thirdMenuItemId },
      run(harness),
    );
    expect([first.rank, second.rank, third.rank]).toStrictEqual([1, 2, 3]);
  });

  it("rejects a duplicate menu item with a friendly conflict", async () => {
    const harness = createHarness();
    await saveFavoriteMeal({ userId, menuItemId }, run(harness));
    const error = await captureError(() =>
      saveFavoriteMeal({ userId, menuItemId }, run(harness)),
    );
    expect(error).toBeInstanceOf(PublicApiError);
    expect((error as PublicApiError).code).toBe("CONFLICT");
    expect((error as PublicApiError).message).toBe(
      "This meal is already one of your favorites here.",
    );
  });

  it("rejects a fourth favorite at the branch", async () => {
    const harness = createHarness();
    harness.favorites = [
      { id: "a", branchId: "branch-1", rank: 1, name: "A", items: [], userId },
      { id: "b", branchId: "branch-1", rank: 2, name: "B", items: [], userId },
      { id: "c", branchId: "branch-1", rank: 3, name: "C", items: [], userId },
    ];
    const error = await captureError(() =>
      saveFavoriteMeal({ userId, menuItemId }, run(harness)),
    );
    expect((error as PublicApiError).code).toBe("CONFLICT");
    expect((error as PublicApiError).message).toBe(
      "You already have 3 favorites here — remove one first.",
    );
  });

  it("fills the freed middle rank", async () => {
    const harness = createHarness();
    harness.favorites = [
      { id: "a", branchId: "branch-1", rank: 1, name: "A", items: [], userId },
      { id: "c", branchId: "branch-1", rank: 3, name: "C", items: [], userId },
    ];
    const saved = await saveFavoriteMeal({ userId, menuItemId }, run(harness));
    expect(saved.rank).toBe(2);
  });

  it("rejects an unknown menu item", async () => {
    const harness = createHarness();
    const error = await captureError(() =>
      saveFavoriteMeal(
        {
          userId,
          menuItemId: parseId<MenuItemId>(
            "99999999-9999-4999-8999-999999999999",
          ),
        },
        run(harness),
      ),
    );
    expect((error as PublicApiError).code).toBe("NOT_FOUND");
  });
});

describe("removeFavoriteMeal", () => {
  it("rejects another user's favorite", async () => {
    const harness = createHarness();
    harness.favorites = [
      {
        id: "a",
        branchId: "branch-1",
        rank: 1,
        name: "A",
        items: [],
        userId: otherUserId,
      },
    ];
    const error = await captureError(() =>
      removeFavoriteMeal(
        { userId, favoriteId: parseId<FavoriteId>("a") },
        run(harness),
      ),
    );
    expect((error as PublicApiError).code).toBe("NOT_FOUND");
  });

  it("compacts remaining ranks after removal", async () => {
    const harness = createHarness();
    harness.favorites = [
      { id: "a", branchId: "branch-1", rank: 1, name: "A", items: [], userId },
      { id: "b", branchId: "branch-1", rank: 2, name: "B", items: [], userId },
      { id: "c", branchId: "branch-1", rank: 3, name: "C", items: [], userId },
    ];
    const result = await removeFavoriteMeal(
      { userId, favoriteId: parseId<FavoriteId>("a") },
      run(harness),
    );
    expect(result).toStrictEqual({ ok: true });
    expect(harness.rankUpdates).toStrictEqual([
      { favoriteId: "b", rank: 1 },
      { favoriteId: "c", rank: 2 },
    ]);
  });
});
