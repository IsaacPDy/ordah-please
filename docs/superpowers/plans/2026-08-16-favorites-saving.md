# Favorites Saving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members save up to 3 ranked favorite meals per restaurant on web, using a +/✓ toggle on menu item cards, with a Favorites page listing them.

**Architecture:** No schema changes — reuse the existing `favorites` / `favorite_items` tables. New repository methods in `packages/db`, a transactional favorites service plus route handlers in a new `apps/web/src/features/favorites/` module (mirroring `features/users`), two API routes, one client toggle button on the restaurant detail page, and a server-rendered Favorites page with a client Remove button.

**Tech Stack:** Next.js (server components + one route-handler factory pattern), Drizzle ORM over Neon PostgreSQL, `@ordah-please/domain` + `@ordah-please/contracts` + `@ordah-please/db` workspaces, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-16-favorites-design.md`

**Key reference files (read before starting):**
- `apps/web/src/features/users/users-admin-service.ts` — transaction-runner service pattern
- `apps/web/src/features/users/users-runtime.ts` — runtime wiring pattern
- `apps/web/src/features/catalog/restaurant-route-handlers.ts` + `.test.ts` — `executeRoute` handler pattern and test style
- `apps/web/src/application/execute-route.ts` — trust-boundary executor (success is always `200` with `{ data }`)
- `packages/db/src/repositories/favorites.ts`, `catalog.ts`, `repositories.provider.integration.test.ts`
- `packages/contracts/src/favorites/favorite-combination.ts` — strict-boundary parser style
- `apps/web/app/admin/groups/rename-group-dialog.tsx` — client fetch + `router.refresh()` pattern
- `apps/web/app/components/profile-menu.test.tsx` — jsdom component-test setup (`// @vitest-environment jsdom`, `vi.hoisted`, mocked `next/navigation`)

**Commands** (run from repo root `/Users/fiona/Documents/Apps/Order App` unless noted):
- Unit tests: `npm run test:unit`
- One unit test file: `npx vitest run --config vitest.config.ts <path>`
- Provider tests: `npm run test:providers` (needs `DATABASE_MIGRATION_URL`; one pre-existing failure on main is known and unrelated)
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Web build: `npm run build:web`

---

### Task 1: Create the task branch

- [ ] **Step 1: Branch from main**

```bash
git -C "/Users/fiona/Documents/Apps/Order App" checkout main
git -C "/Users/fiona/Documents/Apps/Order App" pull --ff-only
git -C "/Users/fiona/Documents/Apps/Order App" checkout -b task/favorites-saving
```

If `git pull` fails because local main and origin differ, stop and ask the user.

---

### Task 2: Contract — `parseFavoriteSaveRequest`

**Files:**
- Create: `packages/contracts/src/favorites/favorite-save-request.ts`
- Test: `packages/contracts/src/favorites/favorite-save-request.test.ts`
- Modify: `packages/contracts/src/index.ts` (add export next to the existing favorites export)

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/favorites/favorite-save-request.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseFavoriteSaveRequest } from "./favorite-save-request.js";

describe("parseFavoriteSaveRequest", () => {
  it("accepts a request with one menu item id", () => {
    expect(
      parseFavoriteSaveRequest({ menuItemId: "item-1" }),
    ).toStrictEqual({ menuItemId: "item-1" });
  });

  it("rejects a missing menu item id", () => {
    expect(() => parseFavoriteSaveRequest({})).toThrow(TypeError);
  });

  it("rejects a non-string menu item id", () => {
    expect(() => parseFavoriteSaveRequest({ menuItemId: 42 })).toThrow(
      TypeError,
    );
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseFavoriteSaveRequest({ menuItemId: "item-1", rank: 1 }),
    ).toThrow(TypeError);
  });

  it("rejects non-object input", () => {
    expect(() => parseFavoriteSaveRequest(null)).toThrow(TypeError);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
npx vitest run --config vitest.config.ts packages/contracts/src/favorites/favorite-save-request.test.ts
```

Expected: FAIL — cannot resolve `./favorite-save-request.js`.

- [ ] **Step 3: Implement the parser**

Create `packages/contracts/src/favorites/favorite-save-request.ts`:

```ts
import type { MenuItemId } from "@ordah-please/domain";

import {
  parseRecordId,
  parseStrictObject,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

/** Parses the member request that saves one menu item as a favorite. */
export function parseFavoriteSaveRequest(
  value: unknown,
): Readonly<{ menuItemId: MenuItemId }> {
  const object = parseStrictObject(value, "Favorite save request");
  rejectUnknownFields(object, ["menuItemId"], "Favorite save request");

  return {
    menuItemId: parseRecordId<MenuItemId>(
      object.menuItemId,
      "Favorite menu item id",
    ),
  };
}
```

- [ ] **Step 4: Export it from the contracts index**

In `packages/contracts/src/index.ts`, directly under the existing line
`export * from "./favorites/favorite-combination.js";` add:

```ts
export * from "./favorites/favorite-save-request.js";
```

- [ ] **Step 5: Run the test and verify it passes**

```bash
npx vitest run --config vitest.config.ts packages/contracts/src/favorites/favorite-save-request.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git -C "/Users/fiona/Documents/Apps/Order App" add packages/contracts/src/favorites/favorite-save-request.ts packages/contracts/src/favorites/favorite-save-request.test.ts packages/contracts/src/index.ts
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "feat(contracts): add favorite save request parser"
```

---

### Task 3: DB — `catalog.findMenuItemContext`

Resolves a menu item to its branch, published menu version, name, price, and availability. Used by the save service so the client never sends names or prices.

**Files:**
- Modify: `packages/db/src/repositories/catalog.ts`
- Test: `packages/db/src/repositories/repositories.provider.integration.test.ts` (extend)

- [ ] **Step 1: Write the failing provider test**

In `repositories.provider.integration.test.ts`, add `favoriteItems`, `menuCategories`, and `menuItems` to the schema imports at the top (`favorites` is already imported), then add a new `describe` block after the existing tests:

```ts
describe("favorites repository writes", () => {
  it("resolves a menu item context from the published menu", async () => {
    const [user] = await database
      .insert(users)
      .values({ displayName: "Favorites User" })
      .returning();
    if (user === undefined) {
      throw new Error("Expected the favorites test user to be created.");
    }

    const [restaurant] = await database
      .insert(restaurants)
      .values({ name: "Favorites Restaurant" })
      .returning();
    if (restaurant === undefined) {
      throw new Error("Expected the favorites test restaurant.");
    }
    const [branch] = await database
      .insert(branches)
      .values({ name: "Favorites Branch", restaurantId: restaurant.id })
      .returning();
    if (branch === undefined) {
      throw new Error("Expected the favorites test branch.");
    }
    const [catalogImport] = await database
      .insert(catalogImports)
      .values({ createdByUserId: user.id, status: "published" })
      .returning();
    if (catalogImport === undefined) {
      throw new Error("Expected the favorites test import.");
    }
    const [menuVersion] = await database
      .insert(menuVersions)
      .values({
        branchId: branch.id,
        sourceImportId: catalogImport.id,
        status: "published",
        versionNumber: 1,
      })
      .returning();
    if (menuVersion === undefined) {
      throw new Error("Expected the favorites test menu version.");
    }
    const [category] = await database
      .insert(menuCategories)
      .values({ menuVersionId: menuVersion.id, name: "Meals", sortOrder: 0 })
      .returning();
    if (category === undefined) {
      throw new Error("Expected the favorites test category.");
    }
    const [item] = await database
      .insert(menuItems)
      .values({
        basePriceCentavos: 25000,
        categoryId: category.id,
        isAvailable: true,
        name: "Favorites Meal",
        sortOrder: 0,
        sourceKey: "favorites-meal-1",
      })
      .returning();
    if (item === undefined) {
      throw new Error("Expected the favorites test item.");
    }

    expect(await repositories.catalog.findMenuItemContext(item.id)).toStrictEqual({
      basePriceCentavos: 25000,
      branchId: branch.id,
      isAvailable: true,
      menuItemId: item.id,
      menuVersionId: menuVersion.id,
      name: "Favorites Meal",
    });
    expect(await repositories.catalog.findMenuItemContext(randomUUID())).toBeUndefined();
  });
});
```

The `users` insert needs only `displayName`; the favorites FK references its id.

- [ ] **Step 2: Run it and verify it fails**

```bash
npm run test:providers
```

Expected: FAIL — `repositories.catalog.findMenuItemContext is not a function` (the known pre-existing unrelated failure may also appear).

- [ ] **Step 3: Implement `findMenuItemContext`**

In `packages/db/src/repositories/catalog.ts`:

3a. Add the row type near the other row interfaces (above `CatalogRepository`):

```ts
export interface MenuItemContextRow {
  readonly menuItemId: string;
  readonly name: string;
  readonly basePriceCentavos: number;
  readonly isAvailable: boolean;
  readonly branchId: string;
  readonly menuVersionId: string;
}
```

3b. Add to the `CatalogRepository` interface (after `findPublishedMenuVersion`):

```ts
findMenuItemContext(
  menuItemId: string,
): Promise<MenuItemContextRow | undefined>;
```

3c. Add the implementation as the first method in the returned object (before `findPublishedMenuVersion`):

```ts
findMenuItemContext: async (menuItemId) => {
  const [row] = await database
    .select({
      menuItemId: menuItems.id,
      name: menuItems.name,
      basePriceCentavos: menuItems.basePriceCentavos,
      isAvailable: menuItems.isAvailable,
      branchId: branches.id,
      menuVersionId: menuVersions.id,
    })
    .from(menuItems)
    .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
    .innerJoin(
      menuVersions,
      and(
        eq(menuVersions.id, menuCategories.menuVersionId),
        eq(menuVersions.status, "published"),
      ),
    )
    .innerJoin(branches, eq(branches.id, menuVersions.branchId))
    .where(eq(menuItems.id, menuItemId))
    .limit(1);
  return row;
},
```

- [ ] **Step 4: Run the provider test again**

```bash
npm run test:providers
```

Expected: the new test PASSES (only the known pre-existing unrelated failure may remain).

- [ ] **Step 5: Commit**

```bash
git -C "/Users/fiona/Documents/Apps/Order App" add packages/db/src/repositories/catalog.ts packages/db/src/repositories/repositories.provider.integration.test.ts
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "feat(db): resolve menu item context for favorites"
```

---

### Task 4: DB — favorites repository writes

**Files:**
- Modify: `packages/db/src/repositories/favorites.ts`
- Test: `packages/db/src/repositories/repositories.provider.integration.test.ts` (extend the Task 3 describe block)

- [ ] **Step 1: Write the failing provider test**

Append a second `it` inside the `describe("favorites repository writes", ...)` block from Task 3 (reuse the rows created there; hoist `user`, `branch`, `menuVersion`, `item`, and `restaurant` into `describe` scope by moving their creation into the new test if sharing is awkward — simplest is to duplicate the setup helpers by keeping everything in one `it` and extending its assertions; the structure below assumes a fresh setup identical to Task 3's inside this second test):

```ts
it("saves, lists, deletes, and compacts ranked favorites", async () => {
  // ... identical setup to the previous test, producing:
  // user, branch, menuVersion, item, plus a second item:
  const [secondItem] = await database
    .insert(menuItems)
    .values({
      basePriceCentavos: 15000,
      categoryId: category.id,
      isAvailable: true,
      name: "Second Meal",
      sortOrder: 1,
      sourceKey: "favorites-meal-2",
    })
    .returning();
  if (secondItem === undefined) {
    throw new Error("Expected the second favorites test item.");
  }

  const first = await repositories.favorites.insertFavoriteWithItem({
    availability: "available",
    branchId: branch.id,
    menuItemId: item.id,
    menuVersionId: menuVersion.id,
    name: item.name,
    quantity: 1,
    rank: 1,
    userId: user.id,
  });
  expect(first.id).toBeTruthy();

  const second = await repositories.favorites.insertFavoriteWithItem({
    availability: "available",
    branchId: branch.id,
    menuItemId: secondItem.id,
    menuVersionId: menuVersion.id,
    name: secondItem.name,
    quantity: 1,
    rank: 2,
    userId: user.id,
  });

  expect(
    await repositories.favorites.listForUserAndBranchWithItems(
      user.id,
      branch.id,
    ),
  ).toStrictEqual([
    {
      id: first.id,
      branchId: branch.id,
      name: "Favorites Meal",
      rank: 1,
      items: [{ menuItemId: item.id, quantity: 1 }],
    },
    {
      id: second.id,
      branchId: branch.id,
      name: "Second Meal",
      rank: 2,
      items: [{ menuItemId: secondItem.id, quantity: 1 }],
    },
  ]);

  expect(await repositories.favorites.deleteFavoriteForUser(randomUUID(), first.id))
    .toBeUndefined();

  expect(
    await repositories.favorites.deleteFavoriteForUser(user.id, first.id),
  ).toStrictEqual({ branchId: branch.id, rank: 1 });

  await repositories.favorites.updateFavoriteRank(second.id, 1);

  const pageRows = await repositories.favorites.listForUser(user.id);
  expect(pageRows).toStrictEqual([
    {
      favoriteId: second.id,
      rank: 1,
      name: "Second Meal",
      availability: "available",
      restaurantId: restaurant.id,
      restaurantName: "Favorites Restaurant",
      branchId: branch.id,
      branchName: "Favorites Branch",
      menuItemId: secondItem.id,
      currentPriceCentavos: 15000,
      isCurrentlyAvailable: true,
    },
  ]);
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
npm run test:providers
```

Expected: FAIL — the new repository methods do not exist.

- [ ] **Step 3: Implement the favorites repository**

Replace the whole contents of `packages/db/src/repositories/favorites.ts` with:

```ts
import { and, asc, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../transaction.js";

import {
  branches,
  favoriteItems,
  favorites,
  menuItems,
  restaurants,
} from "../schema/index.js";

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

      const itemRows = await database
        .select({
          favoriteId: favoriteItems.favoriteId,
          menuItemId: menuItems.id,
          basePriceCentavos: menuItems.basePriceCentavos,
          isAvailable: menuItems.isAvailable,
        })
        .from(favoriteItems)
        .innerJoin(menuItems, eq(menuItems.id, favoriteItems.menuItemId));

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
```

Notes for the executor:
- `RepositoryDatabase` from `./database.js` is no longer imported; `FavoritesDatabase` replaces it (adds `delete`).

- [ ] **Step 4: Run the provider test and typecheck**

```bash
npm run test:providers
npm run typecheck --workspace @ordah-please/db
```

Expected: new tests PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git -C "/Users/fiona/Documents/Apps/Order App" add packages/db/src/repositories/favorites.ts packages/db/src/repositories/repositories.provider.integration.test.ts
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "feat(db): favorites member-owned writes and page reads"
```

---

### Task 5: Web — favorites service (rank rules)

**Files:**
- Create: `apps/web/src/features/favorites/favorites-service.ts`
- Test: `apps/web/src/features/favorites/favorites-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/favorites/favorites-service.test.ts`:

```ts
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
    items: { menuItemId: string }[];
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
        findMenuItemContext: async (id: string) =>
          menuItemContexts[id as keyof typeof menuItemContexts],
      },
      favorites: {
        listForUserAndBranchWithItems: async (userId: string, branchId: string) =>
          harness.favorites
            .filter(
              (favorite) =>
                favorite.userId === userId && favorite.branchId === branchId,
            )
            .sort((left, right) => left.rank - right.rank),
        insertFavoriteWithItem: async (input) => {
          const id = `favorite-${harness.favorites.length + 1}`;
          harness.favorites.push({
            id,
            branchId: input.branchId,
            rank: input.rank,
            name: input.name,
            items: [{ menuItemId: input.menuItemId }],
            userId: input.userId,
          });
          return { id };
        },
        deleteFavoriteForUser: async (userId: string, favoriteId: string) => {
          const index = harness.favorites.findIndex(
            (favorite) =>
              favorite.id === favoriteId && favorite.userId === userId,
          );
          if (index === -1) return undefined;
          const [removed] = harness.favorites.splice(index, 1);
          return { branchId: removed!.branchId, rank: removed!.rank };
        },
        updateFavoriteRank: async (favoriteId: string, rank: number) => {
          harness.rankUpdates.push({ favoriteId, rank });
          const favorite = harness.favorites.find(
            (candidate) => candidate.id === favoriteId,
          );
          if (favorite) favorite.rank = rank;
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
    const error = await saveFavoriteMeal({ userId, menuItemId }, run(harness)).catch(
      (caught) => caught,
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
    const error = await saveFavoriteMeal({ userId, menuItemId }, run(harness)).catch(
      (caught) => caught,
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
    const error = await saveFavoriteMeal(
      {
        userId,
        menuItemId: parseId<MenuItemId>(
          "99999999-9999-4999-8999-999999999999",
        ),
      },
      run(harness),
    ).catch((caught) => caught);
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
    const error = await removeFavoriteMeal(
      { userId, favoriteId: parseId<FavoriteId>("a") },
      run(harness),
    ).catch((caught) => caught);
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
```

- [ ] **Step 2: Run it and verify it fails**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/favorites/favorites-service.test.ts
```

Expected: FAIL — cannot resolve `./favorites-service`.

- [ ] **Step 3: Implement the service**

Create `apps/web/src/features/favorites/favorites-service.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/favorites/favorites-service.test.ts
```

Expected: PASS (7 tests). Note: `parseId` accepts the readable ids used in the fakes (`"a"`, uuid-like strings); if `parseId` enforces UUID format, replace fake ids with the uuid constants shown at the top of the test file.

- [ ] **Step 5: Commit**

```bash
git -C "/Users/fiona/Documents/Apps/Order App" add apps/web/src/features/favorites
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "feat(web): favorites service with rank and limit rules"
```

---

### Task 6: Web — route handlers, runtime, and API routes

**Files:**
- Create: `apps/web/src/features/favorites/favorites-route-handlers.ts`
- Test: `apps/web/src/features/favorites/favorites-route-handlers.test.ts`
- Create: `apps/web/src/features/favorites/favorites-runtime.ts`
- Create: `apps/web/app/api/favorites/route.ts`
- Create: `apps/web/app/api/favorites/[favoriteId]/route.ts`

- [ ] **Step 1: Write the failing handler test**

Create `apps/web/src/features/favorites/favorites-route-handlers.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("./favorites-runtime", () => ({
  favoritesRuntime: {},
}));

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type FavoriteId, type FavoriteRank, type MenuItemId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";
import {
  createRemoveFavoriteHandler,
  createSaveFavoriteHandler,
} from "./favorites-route-handlers";

const session: VerifiedSession = {
  authUserId: "auth-user-1",
  displayName: "Mia",
  email: "mia@example.com",
  imageUrl: null,
};

const identity: AppIdentity = {
  ...session,
  isPlatformAdmin: false,
  memberships: [],
  userId: parseId<UserId>("user-1"),
};

const menuItemId = parseId<MenuItemId>(
  "11111111-1111-4111-8111-111111111111",
);

/** Reads the successful route payload. */
async function readSuccessData(response: Response): Promise<unknown> {
  const body = (await response.json()) as { data?: unknown };
  return body.data;
}

/** Reads the public failure code. */
async function readFailureCode(response: Response): Promise<string> {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code ?? "none";
}

const saveFavoriteMeal = vi.fn(async () => ({
  favoriteId: parseId<FavoriteId>("22222222-2222-4222-8222-222222222222"),
  rank: 1 as FavoriteRank,
}));

const removeFavoriteMeal = vi.fn(async () => ({ ok: true } as const));

function saveHandler(overrides: Partial<Parameters<typeof createSaveFavoriteHandler>[0]> = {}) {
  return createSaveFavoriteHandler({
    loadIdentity: () => identity,
    saveFavoriteMeal,
    verifySession: () => session,
    ...overrides,
  });
}

function removeHandler() {
  return createRemoveFavoriteHandler(
    {
      loadIdentity: () => identity,
      removeFavoriteMeal,
      verifySession: () => session,
    },
    () => "22222222-2222-4222-8222-222222222222",
  );
}

describe("save favorite route handler", () => {
  it("saves a favorite for the signed-in member", async () => {
    saveFavoriteMeal.mockClear();
    const response = await saveHandler()(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ menuItemId }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await readSuccessData(response)).toStrictEqual({
      favoriteId: "22222222-2222-4222-8222-222222222222",
      rank: 1,
    });
    expect(saveFavoriteMeal).toHaveBeenCalledWith({
      userId: identity.userId,
      menuItemId,
    });
  });

  it("rejects a malformed body", async () => {
    const response = await saveHandler()(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ nope: true }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await readFailureCode(response)).toBe("INVALID_INPUT");
  });

  it("maps a limit conflict to 409 with the public message", async () => {
    const response = await saveHandler({
      saveFavoriteMeal: vi.fn(async () => {
        throw new PublicApiError(
          "CONFLICT",
          "You already have 3 favorites here — remove one first.",
        );
      }),
    })(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ menuItemId }),
      }),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error?: { message?: string } };
    expect(body.error?.message).toBe(
      "You already have 3 favorites here — remove one first.",
    );
  });

  it("requires a session", async () => {
    const response = await saveHandler({
      verifySession: () => {
        throw new PublicApiError("UNAUTHENTICATED", "Sign in is required.");
      },
    })(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ menuItemId }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects cross-site mutations", async () => {
    const response = await saveHandler()(
      new Request("https://ordah.test/api/favorites", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        },
        body: JSON.stringify({ menuItemId }),
      }),
    );
    expect(response.status).toBe(403);
  });
});

describe("remove favorite route handler", () => {
  it("removes a favorite for the signed-in member", async () => {
    removeFavoriteMeal.mockClear();
    const response = await removeHandler()(
      new Request(
        "https://ordah.test/api/favorites/22222222-2222-4222-8222-222222222222",
        {
          method: "DELETE",
          headers: { "sec-fetch-site": "same-origin" },
        },
      ),
    );
    expect(response.status).toBe(200);
    expect(await readSuccessData(response)).toStrictEqual({ ok: true });
    expect(removeFavoriteMeal).toHaveBeenCalledWith({
      userId: identity.userId,
      favoriteId: parseId<FavoriteId>("22222222-2222-4222-8222-222222222222"),
    });
  });

  it("rejects an invalid favorite id", async () => {
    const handler = createRemoveFavoriteHandler(
      {
        loadIdentity: () => identity,
        removeFavoriteMeal,
        verifySession: () => session,
      },
      () => "not-a-valid-id",
    );
    const response = await handler(
      new Request("https://ordah.test/api/favorites/not-a-valid-id", {
        method: "DELETE",
        headers: { "sec-fetch-site": "same-origin" },
      }),
    );
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/favorites/favorites-route-handlers.test.ts
```

Expected: FAIL — cannot resolve `./favorites-route-handlers`.

- [ ] **Step 3: Implement the route handlers**

Create `apps/web/src/features/favorites/favorites-route-handlers.ts`:

```ts
import {
  parseFavoriteSaveRequest,
  PublicApiError,
} from "@ordah-please/contracts";
import type {
  FavoriteId,
  FavoriteRank,
  MenuItemId,
  UserId,
} from "@ordah-please/domain";
import { parseId } from "@ordah-please/domain";

import { executeRoute } from "../../application/execute-route";
import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";

type MaybePromise<Value> = Value | Promise<Value>;

interface FavoritesHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface SaveFavoriteHandlerDependencies
  extends FavoritesHandlerDependencies {
  readonly saveFavoriteMeal: (command: {
    userId: UserId;
    menuItemId: MenuItemId;
  }) => Promise<{ favoriteId: FavoriteId; rank: FavoriteRank }>;
}

export interface RemoveFavoriteHandlerDependencies
  extends FavoritesHandlerDependencies {
  readonly removeFavoriteMeal: (command: {
    userId: UserId;
    favoriteId: FavoriteId;
  }) => Promise<Readonly<{ ok: true }>>;
}

/** Reads one JSON request and surfaces a stable invalid-input error for malformed bodies. */
async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new PublicApiError("INVALID_INPUT", "Invalid request body.");
  }
}

/** Rejects browser cross-site mutations while allowing native requests without Origin. */
function verifyTrustedMutationRequest(request: Request): void {
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    throw new PublicApiError("FORBIDDEN", "You do not have access to this action.");
  }
  const origin = request.headers.get("origin");
  if (origin === null) {
    return;
  }
  try {
    if (new URL(origin).origin === new URL(request.url).origin) {
      return;
    }
  } catch {
    // Invalid or opaque browser origins fail closed below.
  }
  throw new PublicApiError("FORBIDDEN", "You do not have access to this action.");
}

/** Parses and brands the favoriteId URL parameter. */
function parseFavoriteIdParam(raw: string | undefined): FavoriteId {
  if (raw === undefined || raw.trim().length === 0) {
    throw new PublicApiError("INVALID_INPUT", "Favorite id is required.");
  }
  try {
    return parseId<FavoriteId>(raw);
  } catch {
    throw new PublicApiError("INVALID_INPUT", "Favorite id is invalid.");
  }
}

/** Creates the POST handler that saves one meal as the member's favorite. */
export function createSaveFavoriteHandler(
  dependencies: SaveFavoriteHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ menuItemId: MenuItemId }>, unknown>(
      request,
      {
        authorize: () => true,
        execute: async ({ identity, input }) =>
          dependencies.saveFavoriteMeal({
            userId: identity.userId,
            menuItemId: input.menuItemId,
          }),
        validate: async (currentRequest) => {
          verifyTrustedMutationRequest(currentRequest);
          try {
            return parseFavoriteSaveRequest(
              await parseJsonBody(currentRequest),
            );
          } catch (error) {
            if (error instanceof PublicApiError) {
              throw error;
            }
            throw new PublicApiError("INVALID_INPUT", "Invalid request body.");
          }
        },
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the DELETE handler that removes one of the member's favorites. */
export function createRemoveFavoriteHandler(
  dependencies: RemoveFavoriteHandlerDependencies,
  getFavoriteId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ favoriteId: FavoriteId }>, unknown>(
      request,
      {
        authorize: () => true,
        execute: async ({ identity, input }) =>
          dependencies.removeFavoriteMeal({
            userId: identity.userId,
            favoriteId: input.favoriteId,
          }),
        validate: (currentRequest) => {
          verifyTrustedMutationRequest(currentRequest);
          return {
            favoriteId: parseFavoriteIdParam(getFavoriteId(currentRequest)),
          };
        },
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}
```

- [ ] **Step 4: Run the handler tests**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/favorites/favorites-route-handlers.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Create the runtime**

Create `apps/web/src/features/favorites/favorites-runtime.ts`:

```ts
import {
  createDatabaseClient,
  createRepositories,
  withTransaction,
  type Database,
} from "@ordah-please/db";

import { loadAppIdentity } from "../../auth/load-app-identity";
import { verifySession } from "../../auth/verify-session";
import {
  removeFavoriteMeal,
  saveFavoriteMeal,
} from "./favorites-service";

let runtimeDatabase: Database | undefined;

/** Reuses one lazy pooled database across warm authenticated favorites requests. */
function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
}

/** Runs one favorites mutation with catalog and favorites repositories sharing one transaction. */
function runFavoritesTransaction<Result>(
  operation: Parameters<typeof saveFavoriteMeal>[1]["run"],
): Promise<Result> {
  return withTransaction(getRuntimeDatabase(), (transaction) =>
    operation(createRepositories(transaction)),
  );
}

/** Loads the authenticated user's current product identity from Neon. */
export function loadRuntimeIdentity(session: {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}) {
  return loadAppIdentity(
    session,
    createRepositories(getRuntimeDatabase()).identityAccess,
  );
}

export const favoritesRuntime = {
  saveFavoriteMeal: (command: Parameters<typeof saveFavoriteMeal>[0]) =>
    saveFavoriteMeal(command, { run: runFavoritesTransaction }),
  removeFavoriteMeal: (command: Parameters<typeof removeFavoriteMeal>[0]) =>
    removeFavoriteMeal(command, { run: runFavoritesTransaction }),
  /** Lists every favorite for the signed-in member, for the Favorites page. */
  listFavoritesForUser: (userId: string) =>
    createRepositories(getRuntimeDatabase()).favorites.listForUser(userId),
  loadIdentity: loadRuntimeIdentity,
  verifySession,
} as const;
```

Type note: `Parameters<typeof saveFavoriteMeal>[1]["run"]` picks the run signature out of `FavoritesTransactionRunner`; if the compiler prefers it, type the helper as `<Result>(operation: (repositories: FavoritesServiceRepositories) => Promise<Result>) => Promise<Result>` and import `FavoritesServiceRepositories` from `./favorites-service`. `createRepositories(transaction)` structurally satisfies `FavoritesServiceRepositories` because the db repository signatures match.

- [ ] **Step 6: Create the API routes**

Create `apps/web/app/api/favorites/route.ts`:

```ts
import { favoritesRuntime } from "../../../src/features/favorites/favorites-runtime";
import { createSaveFavoriteHandler } from "../../../src/features/favorites/favorites-route-handlers";

/** Saves one meal as a favorite for the signed-in member. */
export async function POST(request: Request): Promise<Response> {
  return createSaveFavoriteHandler({
    loadIdentity: favoritesRuntime.loadIdentity,
    saveFavoriteMeal: favoritesRuntime.saveFavoriteMeal,
    verifySession: favoritesRuntime.verifySession,
  })(request);
}
```

Create `apps/web/app/api/favorites/[favoriteId]/route.ts`:

```ts
import { favoritesRuntime } from "../../../../src/features/favorites/favorites-runtime";
import { createRemoveFavoriteHandler } from "../../../../src/features/favorites/favorites-route-handlers";

/** Removes one of the signed-in member's favorites. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ favoriteId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createRemoveFavoriteHandler(
    {
      loadIdentity: favoritesRuntime.loadIdentity,
      removeFavoriteMeal: favoritesRuntime.removeFavoriteMeal,
      verifySession: favoritesRuntime.verifySession,
    },
    () => params.favoriteId,
  )(request);
}
```

Import depths: `app/api/favorites/route.ts` is three directories under `app`, so `../../../src`; `app/api/favorites/[favoriteId]/route.ts` is four deep, so `../../../../src`. Cross-check against `apps/web/app/api/admin/users/[userId]/suspend/route.ts` (six deep, six `../`) if unsure.

- [ ] **Step 7: Typecheck the web workspace**

```bash
npm run typecheck --workspace @ordah-please/web
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git -C "/Users/fiona/Documents/Apps/Order App" add apps/web/src/features/favorites apps/web/app/api/favorites
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "feat(web): favorites save and remove API"
```

---

### Task 7: Web — FavoriteButton on the restaurant detail page

**Files:**
- Create: `apps/web/app/(member)/restaurants/[restaurantId]/favorite-button.tsx`
- Test: `apps/web/app/(member)/restaurants/[restaurantId]/favorite-button.test.tsx`
- Modify: `apps/web/app/(member)/restaurants/[restaurantId]/page.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Write the failing component test**

Create `apps/web/app/(member)/restaurants/[restaurantId]/favorite-button.test.tsx`:

```tsx
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefresh, mockFetch } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.stubGlobal("fetch", mockFetch);

import { FavoriteButton } from "./favorite-button";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("FavoriteButton", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders unsaved state with an accessible label", () => {
    render(
      <FavoriteButton favoriteId={null} initiallyFavorited={false} menuItemId="item-1" />,
    );
    const button = screen.getByRole("button", {
      name: /save favorite meal/i,
    });
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("saves on click and refreshes server data", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(200, {
        data: { favoriteId: "favorite-9", rank: 1 },
      }),
    );
    render(
      <FavoriteButton favoriteId={null} initiallyFavorited={false} menuItemId="item-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save favorite meal/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/favorites",
        expect.objectContaining({
          body: JSON.stringify({ menuItemId: "item-1" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("removes on click when already saved", async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { data: { ok: true } }));
    render(
      <FavoriteButton
        favoriteId="favorite-9"
        initiallyFavorited={true}
        menuItemId="item-1"
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /remove favorite meal/i }),
    );
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/favorites/favorite-9",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows the server's limit message on conflict and clears after 5 seconds", async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue(
      jsonResponse(409, {
        error: {
          code: "CONFLICT",
          message: "You already have 3 favorites here — remove one first.",
        },
      }),
    );
    render(
      <FavoriteButton favoriteId={null} initiallyFavorited={false} menuItemId="item-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save favorite meal/i }));
    const status = await screen.findByRole("status");
    expect(status.textContent).toBe(
      "You already have 3 favorites here — remove one first.",
    );
    expect(mockRefresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the sign-in message when unauthenticated", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(401, {
        error: { code: "UNAUTHENTICATED", message: "Sign in is required." },
      }),
    );
    render(
      <FavoriteButton favoriteId={null} initiallyFavorited={false} menuItemId="item-1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save favorite meal/i }));
    expect(
      await screen.findByRole("status", { name: undefined }),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
npx vitest run --config vitest.config.ts "apps/web/app/(member)/restaurants/[restaurantId]/favorite-button.test.tsx"
```

Expected: FAIL — cannot resolve `./favorite-button`.

- [ ] **Step 3: Implement the button**

Create `apps/web/app/(member)/restaurants/[restaurantId]/favorite-button.tsx`:

```tsx
"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface FavoriteButtonProps {
  readonly favoriteId: string | null;
  readonly initiallyFavorited: boolean;
  readonly menuItemId: string;
}

/** Toggle that saves or removes one meal favorite for the signed-in member. */
export function FavoriteButton({
  favoriteId,
  initiallyFavorited,
  menuItemId,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  function showMessage(text: string): void {
    setMessage(text);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function toggle(): Promise<void> {
    setPending(true);
    try {
      const response = initiallyFavorited && favoriteId !== null
        ? await fetch(
            `/api/favorites/${encodeURIComponent(favoriteId)}`,
            { method: "DELETE" },
          )
        : await fetch("/api/favorites", {
            body: JSON.stringify({ menuItemId }),
            headers: { "content-type": "application/json" },
            method: "POST",
          });
      if (!response.ok) {
        showMessage(await readErrorMessage(response));
        return;
      }
      router.refresh();
    } catch {
      showMessage("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="restaurant-detail__item-favorite-wrap">
      <button
        aria-label={
          initiallyFavorited
            ? "Remove favorite meal"
            : "Save favorite meal"
        }
        aria-pressed={initiallyFavorited}
        className={
          initiallyFavorited
            ? "restaurant-detail__item-favorite restaurant-detail__item-favorite--saved"
            : "restaurant-detail__item-favorite"
        }
        disabled={pending}
        onClick={() => {
          void toggle();
        }}
        type="button"
      >
        {initiallyFavorited ? (
          <Check aria-hidden="true" size={20} strokeWidth={2.4} />
        ) : (
          <Plus aria-hidden="true" size={20} strokeWidth={2.4} />
        )}
      </button>
      {message !== null ? (
        <p
          aria-live="polite"
          className="restaurant-detail__item-favorite-message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Reads the safe public message from a failed response, or returns a fallback. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    const message = body?.error?.message;
    return typeof message === "string" ? message : "Request failed.";
  } catch {
    return "Couldn't reach the server. Try again.";
  }
}
```

- [ ] **Step 4: Run the component test**

```bash
npx vitest run --config vitest.config.ts "apps/web/app/(member)/restaurants/[restaurantId]/favorite-button.test.tsx"
```

Expected: PASS (5 tests). If the lucide icon names differ in the installed version (`^1.25.0`), check `apps/web` for existing lucide imports (`Bell` is used in the member layout) and use the closest available plus/check glyphs.

- [ ] **Step 5: Wire the button into the restaurant detail page**

Modify `apps/web/app/(member)/restaurants/[restaurantId]/page.tsx`:

5a. Add imports at the top (the same `../../../../src` depth as the file's existing `catalog-runtime` import — `page.tsx` sits four directories under `apps/web`):

```tsx
import { getCurrentServerPageIdentity } from "../../../../src/auth/load-server-page-identity";
import { favoritesRuntime } from "../../../../src/features/favorites/favorites-runtime";
import { FavoriteButton } from "./favorite-button";
```

5b. After the `detail` lookup and before the `return`, load the member's favorites for this branch:

```tsx
const identityResult = await getCurrentServerPageIdentity();
const favoriteIdByMenuItemId = new Map<string, string>();
if (identityResult.status === "authenticated") {
  const favoriteRows = await favoritesRuntime.listFavoritesForUser(
    identityResult.identity.userId,
  );
  for (const row of favoriteRows) {
    if (row.branchId === detail.branchId && row.menuItemId !== null) {
      favoriteIdByMenuItemId.set(row.menuItemId, row.favoriteId);
    }
  }
}
```

5c. Inside the item rendering, after the `restaurant-detail__item-body` closing `</div>` and before the `</li>`, add:

```tsx
<FavoriteButton
  favoriteId={favoriteIdByMenuItemId.get(item.id) ?? null}
  initiallyFavorited={favoriteIdByMenuItemId.has(item.id)}
  menuItemId={item.id}
/>
```

- [ ] **Step 6: Add the CSS**

Append to `apps/web/app/globals.css` (near the other `.restaurant-detail__` rules):

```css
.restaurant-detail__item-favorite-wrap {
  align-self: center;
  display: grid;
  flex: 0 0 auto;
  gap: var(--space-1);
  justify-items: center;
  max-width: 150px;
}

.restaurant-detail__item-favorite {
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-primary-strong);
  cursor: pointer;
  display: inline-flex;
  height: 40px;
  justify-content: center;
  width: 40px;
}

.restaurant-detail__item-favorite--saved {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.restaurant-detail__item-favorite:disabled {
  cursor: default;
  opacity: 0.6;
}

.restaurant-detail__item-favorite-message {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  margin: 0;
  text-align: center;
}
```

Also verify `--space-1` exists in the token block at the top of `globals.css`; if the scale uses different names, pick the smallest existing spacing variable.

- [ ] **Step 7: Run the full unit suite and typecheck**

```bash
npm run test:unit
npm run typecheck --workspace @ordah-please/web
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git -C "/Users/fiona/Documents/Apps/Order App" add "apps/web/app/(member)/restaurants/[restaurantId]" apps/web/app/globals.css
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "feat(web): favorite toggle on restaurant meal cards"
```

---

### Task 8: Web — Favorites page listing with Remove

**Files:**
- Create: `apps/web/app/(member)/favorites/favorites-view.tsx`
- Create: `apps/web/app/(member)/favorites/favorite-remove-button.tsx`
- Test: `apps/web/app/(member)/favorites/favorites-view.test.tsx`
- Modify: `apps/web/app/(member)/favorites/page.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Write the failing view test**

Create `apps/web/app/(member)/favorites/favorites-view.test.tsx`:

```tsx
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRefresh, mockFetch } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.stubGlobal("fetch", mockFetch);

import {
  FavoritesView,
  groupFavoritesByBranch,
} from "./favorites-view";

describe("groupFavoritesByBranch", () => {
  it("groups page rows by branch preserving rank order", () => {
    expect(
      groupFavoritesByBranch([
        {
          availability: "available",
          branchId: "branch-1",
          branchName: "Kapitolyo",
          currentPriceCentavos: 25000,
          favoriteId: "a",
          isCurrentlyAvailable: true,
          menuItemId: "item-1",
          name: "Chicken Meal",
          rank: 2,
          restaurantId: "restaurant-1",
          restaurantName: "McDonald's",
        },
        {
          availability: "available",
          branchId: "branch-1",
          branchName: "Kapitolyo",
          currentPriceCentavos: 15000,
          favoriteId: "b",
          isCurrentlyAvailable: true,
          menuItemId: "item-2",
          name: "Fries",
          rank: 1,
          restaurantId: "restaurant-1",
          restaurantName: "McDonald's",
        },
        {
          availability: "available",
          branchId: "branch-2",
          branchName: "Magsaysay",
          currentPriceCentavos: 9900,
          favoriteId: "c",
          isCurrentlyAvailable: false,
          menuItemId: "item-3",
          name: "Bucket",
          rank: 1,
          restaurantId: "restaurant-2",
          restaurantName: "KFC",
        },
      ]),
    ).toStrictEqual([
      {
        branchId: "branch-1",
        branchName: "Kapitolyo",
        favorites: [
          { favoriteId: "b", name: "Fries", priceCentavos: 15000, rank: 1 },
          { favoriteId: "a", name: "Chicken Meal", priceCentavos: 25000, rank: 2 },
        ],
        restaurantName: "McDonald's",
      },
      {
        branchId: "branch-2",
        branchName: "Magsaysay",
        favorites: [
          { favoriteId: "c", name: "Bucket", priceCentavos: 9900, rank: 1 },
        ],
        restaurantName: "KFC",
      },
    ]);
  });
});

describe("FavoritesView", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the empty state when there are no favorites", () => {
    render(<FavoritesView groups={[]} />);
    expect(
      screen.getByText("No favorites yet — browse restaurants to add your first one."),
    ).toBeTruthy();
  });

  it("lists favorites grouped by restaurant with rank badges, prices, and remove buttons", () => {
    render(
      <FavoritesView
        groups={[
          {
            branchId: "branch-1",
            branchName: "Kapitolyo",
            favorites: [
              { favoriteId: "b", name: "Fries", priceCentavos: 15000, rank: 1 },
              { favoriteId: "a", name: "Chicken Meal", priceCentavos: 25000, rank: 2 },
            ],
            restaurantName: "McDonald's",
          },
        ]}
      />,
    );
    expect(screen.getByText("McDonald's — Kapitolyo")).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.getByText("Fries")).toBeTruthy();
    expect(screen.getByText("₱150.00")).toBeTruthy();
    expect(screen.getByText("₱250.00")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Remove Fries from favorites" }),
    ).toBeTruthy();
  });

  it("removes a favorite and refreshes", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    render(
      <FavoritesView
        groups={[
          {
            branchId: "branch-1",
            branchName: "Kapitolyo",
            favorites: [
              { favoriteId: "b", name: "Fries", priceCentavos: 15000, rank: 1 },
            ],
            restaurantName: "McDonald's",
          },
        ]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Fries from favorites" }),
    );
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/favorites/b",
        { method: "DELETE" },
      );
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
npx vitest run --config vitest.config.ts "apps/web/app/(member)/favorites/favorites-view.test.tsx"
```

Expected: FAIL — cannot resolve `./favorites-view`.

- [ ] **Step 3: Implement the remove button**

Create `apps/web/app/(member)/favorites/favorite-remove-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FavoriteRemoveButtonProps {
  readonly favoriteId: string;
  readonly mealName: string;
}

/** Removes one favorite for the signed-in member. */
export function FavoriteRemoveButton({
  favoriteId,
  mealName,
}: FavoriteRemoveButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove(): Promise<void> {
    setPending(true);
    try {
      const response = await fetch(
        `/api/favorites/${encodeURIComponent(favoriteId)}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      aria-label={`Remove ${mealName} from favorites`}
      className="favorite-remove"
      disabled={pending}
      onClick={() => {
        void remove();
      }}
      type="button"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
```

- [ ] **Step 4: Implement the view and grouping**

Create `apps/web/app/(member)/favorites/favorites-view.tsx`:

```tsx
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

/** Groups favorites page rows by branch, preserving rank order inside each group. */
export function groupFavoritesByBranch(
  rows: readonly FavoritePageRow[],
): readonly FavoriteGroup[] {
  const groups: FavoriteGroup[] = [];
  const groupByBranchId = new Map<string, FavoriteGroup>();

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
    group.favorites = [
      ...group.favorites,
      {
        favoriteId: row.favoriteId,
        name: row.name,
        priceCentavos: row.currentPriceCentavos,
        rank: row.rank,
      },
    ];
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
```

- [ ] **Step 5: Run the view test**

```bash
npx vitest run --config vitest.config.ts "apps/web/app/(member)/favorites/favorites-view.test.tsx"
```

Expected: PASS (4 tests).

- [ ] **Step 6: Wire the page**

Replace the body of `apps/web/app/(member)/favorites/page.tsx` (keep the existing imports and add the two new ones):

```tsx
import { getCurrentServerPageIdentity } from "../../../src/auth/load-server-page-identity";
import { favoritesRuntime } from "../../../src/features/favorites/favorites-runtime";
import { MemberAccessState } from "../../components/member-access-state";
import { FavoritesView, groupFavoritesByBranch } from "./favorites-view";

/** Favorites tab: the member's saved favorite meals, ranked per restaurant. */
export default async function FavoritesPage() {
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;

  const groups =
    identityResult.status === "authenticated"
      ? groupFavoritesByBranch(
          await favoritesRuntime.listFavoritesForUser(
            identityResult.identity.userId,
          ),
        )
      : [];

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="favorites">
      <div className="member-page">
        <header className="page-intro">
          <p className="eyebrow">Your usual orders</p>
          <h1>Favorites</h1>
          <p>
            Your top three combinations will be ready when a group order starts.
          </p>
        </header>
        <FavoritesView groups={groups} />
      </div>
    </MemberAccessState>
  );
}
```

- [ ] **Step 7: Add the CSS**

Append to `apps/web/app/globals.css` (near other member styles):

```css
.favorites-list {
  display: grid;
  gap: var(--space-4);
}

.favorites-group {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-3);
}

.favorites-group__title {
  font-size: 1rem;
  margin: 0 0 var(--space-2);
}

.favorites-group ul {
  display: grid;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}

.favorites-favorite {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.favorites-favorite__rank {
  background: var(--color-primary);
  border-radius: 999px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 10px;
}

.favorites-favorite__name {
  font-weight: 600;
}

.favorites-favorite__price {
  color: var(--color-text-secondary);
}

.favorite-remove {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-field);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px 12px;
}

.favorite-remove:disabled {
  cursor: default;
  opacity: 0.6;
}
```

Verify `--space-4` and `--radius-field` exist in the token block; substitute the nearest existing token if a name differs.

- [ ] **Step 8: Run the full unit suite and typecheck**

```bash
npm run test:unit
npm run typecheck --workspace @ordah-please/web
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git -C "/Users/fiona/Documents/Apps/Order App" add "apps/web/app/(member)/favorites" apps/web/app/globals.css
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "feat(web): favorites page with ranked groups and remove"
```

---

### Task 9: Full gates

- [ ] **Step 1: Unit tests**

```bash
npm run test:unit
```

Expected: PASS (only known pre-existing failures if any — confirm against main first if unsure).

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Production build**

```bash
npm run build:web
```

Expected: succeeds.

- [ ] **Step 5: Commit any fixes**

If gates required fixes, commit them:

```bash
git -C "/Users/fiona/Documents/Apps/Order App" add -A
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "fix(web): favorites gates cleanup"
```

---

### Task 10: Manual browser verification

Start the dev server against the **development** Neon environment (never prod):

```bash
npm run dev:web
```

Verify in the browser (sign in with the test account):

- [ ] Restaurant detail page: every meal card shows a round + on the right.
- [ ] Tapping + saves; button becomes ✓; refresh shows ✓ persisted.
- [ ] Saving 3 meals at one restaurant; a 4th + shows "You already have 3 favorites here — remove one first." and clears after ~5 seconds.
- [ ] Tapping ✓ removes the favorite.
- [ ] Removing the #1 favorite shifts #2→#1 and #3→#2 on the Favorites page.
- [ ] After removing one, saving a new meal takes rank 3.
- [ ] Favorites page: groups by restaurant with name — branch, rank badges, meal names, prices, Remove buttons; Remove works and the list updates.
- [ ] Favorites at a second restaurant are independent (limit and ranks per restaurant).
- [ ] Same meal cannot be saved twice (shows "This meal is already one of your favorites here.").
- [ ] Signing out and hitting `POST /api/favorites` directly returns 401.

Record results; any failure goes back through systematic-debugging before a fix.

---

### Task 11: Completion documentation and merge

Per `AGENTS.md` workflow (solo, one branch per task):

- [ ] **Step 1: Update `context/progress-tracker.md`**
  - In "After Multi-group", change the Favorites line to `[x]` with a one-line completion note (web save/ranking shipped; auto-order wiring deferred to order bundles; mobile deferred).
- [ ] **Step 2: Write `context/history/favorites-saving.md`**
  - Completion evidence: test counts, gate results, browser verification checklist results, decisions (3 per branch, block-with-message, rank = order added with compaction, web only).
- [ ] **Step 3: Commit docs**

```bash
git -C "/Users/fiona/Documents/Apps/Order App" add context
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "docs: record favorites saving completion"
```

- [ ] **Step 4: Squash-merge** — ask the user first, then:

```bash
git -C "/Users/fiona/Documents/Apps/Order App" checkout main
git -C "/Users/fiona/Documents/Apps/Order App" merge --squash task/favorites-saving
git -C "/Users/fiona/Documents/Apps/Order App" commit -m "Favorites saving and ranking (web)"
git -C "/Users/fiona/Documents/Apps/Order App" push
```

The squash title must match the tracker entry exactly. After verifying the squash commit on main, delete the task branch (ask the user first).

---

## Self-Review Notes (resolved during planning)

- Spec coverage: + toggle on meal cards (Task 7), limit message (Tasks 5/7), Favorites page with groups/ranks/remove (Task 8), save/remove endpoints with server-side rank and ownership rules (Tasks 3–6), web-only and no-schema-changes constraints respected, verification gates (Tasks 9–10), completion docs (Task 11).
- Known deviations, all intentional: success responses are `200` (uniform `executeRoute` envelope, spec updated), conflicts use the existing `CONFLICT` code with friendly messages (spec updated), the Favorites page price is read live from the menu (spec updated).
- `listForUserAndBranchWithItems` per-favorite item queries are bounded at 3 by the rank uniqueness constraint.
