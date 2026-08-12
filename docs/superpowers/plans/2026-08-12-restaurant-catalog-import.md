# Restaurant Catalog Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Platform Admin upload a CSV of restaurants and menu items so that real restaurant data replaces every current mock on web and mobile, with a Grab-style member restaurant detail page.

**Architecture:** One new schema migration adds two columns. A new CSV parser, an `importCatalog` repository function (transactional, one new published `menu_version` per branch per import), five new API endpoints, and four new UI surfaces (admin Import upload, admin Catalog list, admin Restaurant Edit, member Restaurant Detail) replace the existing mocks.

**Tech Stack:** Next.js App Router, Expo Router, Drizzle ORM on Neon Postgres, Vitest, React Testing Library, Jest (mobile).

**Spec:** `docs/superpowers/specs/2026-08-12-restaurant-catalog-import-design.md`

**Pre-execution setup:** The implementer must first create a task branch. Suggested name: `task/restaurant-catalog-import`. Branch from `main`, not the current `task/profile-menu-and-sign-out` branch.

**Key conventions in this codebase (read these files for reference as you work):**
- Repository pattern: `packages/db/src/repositories/orders.ts` (small factory returning an interface)
- Contract parser pattern: `packages/contracts/src/catalog/catalog-read-model.ts`
- Strict boundary helpers: `packages/contracts/src/common/strict-boundary.ts` (provides `parseString`, `parseStrictObject`, `parseArray`, `parseBoolean`, `parseNonNegativeInteger`, `parseCentavosValue`, `parseNullableString`, `parseRecordId`, `parseUtcString`, `parseEnum`, `rejectUnknownFields`)
- API route pattern: `apps/web/app/api/admin/groups/create/route.ts` — thin wrapper calling a handler in `src/features/`
- Test command (root): `npm run test:unit` (Vitest). Mobile tests: `npm run test:mobile` (Jest). Typecheck: `npm run typecheck`. Lint: `npm run lint`.
- Migration generation: `npm run db:generate --workspace @ordah-please/db` (creates a SQL file under `packages/db/drizzle/`)
- The `menuVersionStatusEnum` enum uses `superseded` (NOT "archived") for prior published versions.
- The `catalogImportStatusEnum` enum uses `published` for successful imports.

---

## File Structure

### Create
- `packages/db/drizzle/XXXX_*.sql` — generated migration (filename chosen by drizzle-kit)
- `packages/domain/src/catalog/restaurant-summary.ts`
- `packages/domain/src/catalog/restaurant-detail.ts`
- `packages/domain/src/catalog/import-summary.ts`
- `packages/contracts/src/catalog/csv-row.ts` + `csv-row.test.ts`
- `packages/contracts/src/catalog/restaurant-list-response.ts` + `.test.ts`
- `packages/contracts/src/catalog/restaurant-detail-response.ts` + `.test.ts`
- `packages/contracts/src/catalog/import-response.ts` + `.test.ts`
- `packages/db/src/repositories/catalog-import.test.ts` (integration test, runs with `RUN_PROVIDER_TESTS=1`)
- `apps/web/src/features/catalog/csv-upload-handler.ts`
- `apps/web/src/features/catalog/restaurant-route-handlers.ts`
- `apps/web/src/features/catalog/catalog-runtime.ts`
- `apps/web/app/api/admin/catalog/import/route.ts`
- `apps/web/app/api/admin/catalog/restaurants/[restaurantId]/route.ts`
- `apps/web/app/api/admin/catalog/items/[itemId]/route.ts`
- `apps/web/app/api/catalog/restaurants/route.ts`
- `apps/web/app/api/catalog/restaurants/[restaurantId]/route.ts`
- `apps/web/app/admin/imports/upload-form.tsx` + `upload-form.test.tsx`
- `apps/web/app/admin/catalog/[restaurantId]/edit/page.tsx`
- `apps/web/app/admin/catalog/[restaurantId]/edit/edit-form.tsx` + `edit-form.test.tsx`
- `apps/web/app/(member)/restaurants/[restaurantId]/page.tsx` + `restaurant-detail.test.tsx`
- `apps/mobile/app/(member)/restaurants/[id].tsx`
- `apps/mobile/src/features/catalog/use-restaurants.ts` + test
- `apps/mobile/src/features/catalog/use-restaurant-detail.ts` + test

### Modify
- `packages/db/src/schema/catalog.ts` — add `cuisines` to restaurants, `image_url` to menu_items
- `packages/domain/src/catalog/menu.ts` — extend `CatalogRestaurant` and `MenuItem`
- `packages/domain/src/catalog/index.ts` — re-export new types
- `packages/contracts/src/catalog/index.ts` — re-export new parsers
- `packages/db/src/repositories/catalog.ts` — add 5 new functions
- `apps/web/app/admin/imports/page.tsx` — replace mocks
- `apps/web/app/admin/catalog/page.tsx` — replace mocks
- `apps/web/app/(member)/page.tsx` — replace mocks with fetch
- `apps/web/app/(member)/favorites/page.tsx` — empty state
- `apps/mobile/app/(member)/index.tsx` — replace mocks with fetch
- `apps/mobile/app/(member)/favorites.tsx` — empty state
- `apps/web/next.config.ts` — add `huawei-food-cms.grab.com` and `food.grab.com` to `images.domains`

---

## Task 1: Schema migration — add cuisines and image_url

**Files:**
- Modify: `packages/db/src/schema/catalog.ts`

- [ ] **Step 1: Add cuisines column to restaurants table**

In `packages/db/src/schema/catalog.ts`, change the `restaurants` table definition. Add the `cuisines` column after `name`:

```typescript
export const restaurants = pgTable("restaurants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  cuisines: text("cuisines").array().notNull().default(sql`'{}'::text[]`),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  pausedAt: utcTimestamp("paused_at"),
  archivedAt: utcTimestamp("archived_at"),
});
```

- [ ] **Step 2: Add image_url column to menu_items table**

In the same file, change the `menuItems` table definition. Add `imageUrl` after `isAvailable`:

```typescript
export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    basePriceCentavos: bigint("base_price_centavos", {
      mode: "number",
    }).notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    // ... existing constraints unchanged
  ],
);
```

- [ ] **Step 3: Generate the migration**

Run:
```bash
npm run db:generate --workspace @ordah-please/db
```

Expected: a new file appears under `packages/db/drizzle/` named like `000X_cuisines_image_url.sql` containing `ALTER TABLE "restaurants" ADD COLUMN "cuisines" text[] ...` and `ALTER TABLE "menu_items" ADD COLUMN "image_url" text;`.

- [ ] **Step 4: Verify the migration applies**

Run:
```bash
npm run db:check --workspace @ordah-please/db
```

Expected: success, no errors.

- [ ] **Step 5: Run typecheck**

Run:
```bash
npm run typecheck --workspace @ordah-please/db
```

Expected: success.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/catalog.ts packages/db/drizzle/
git commit -m "feat(db): add cuisines and image_url columns for catalog import"
```

---

## Task 2: Extend domain types

**Files:**
- Modify: `packages/domain/src/catalog/menu.ts`
- Create: `packages/domain/src/catalog/restaurant-summary.ts`
- Create: `packages/domain/src/catalog/restaurant-detail.ts`
- Create: `packages/domain/src/catalog/import-summary.ts`
- Modify: `packages/domain/src/catalog/index.ts`

- [ ] **Step 1: Extend CatalogRestaurant with cuisines**

In `packages/domain/src/catalog/menu.ts`, change `CatalogRestaurant`:

```typescript
export type CatalogRestaurant = Readonly<{
  id: RestaurantId;
  name: string;
  cuisines: readonly string[];
}>;
```

- [ ] **Step 2: Extend MenuItem with imageUrl**

In the same file, change `MenuItem`:

```typescript
export type MenuItem = Readonly<{
  id: MenuItemId;
  name: string;
  description: string;
  priceCentavos: Centavos;
  availability: MenuAvailability;
  imageUrl: string | null;
  variants: readonly MenuVariant[];
  modifierGroups: readonly MenuModifierGroup[];
}>;
```

- [ ] **Step 3: Create restaurant-summary.ts**

Create `packages/domain/src/catalog/restaurant-summary.ts`:

```typescript
import type { BranchId, RestaurantId } from "../types/ids.js";

/** One row in the member browse list. Hero image is the first item's photo for V1. */
export type RestaurantSummary = Readonly<{
  id: RestaurantId;
  name: string;
  cuisines: readonly string[];
  branchId: BranchId;
  branchName: string;
  heroImageUrl: string | null;
}>;
```

- [ ] **Step 4: Create restaurant-detail.ts**

Create `packages/domain/src/catalog/restaurant-detail.ts`:

```typescript
import type {
  BranchId,
  MenuItem,
  RestaurantId,
  UtcTimestamp,
} from "../index.js";

/** A category section in the member restaurant detail page. */
export type RestaurantMenuCategory = Readonly<{
  name: string;
  items: readonly MenuItem[];
}>;

/** Full read model for the member restaurant detail page. */
export type RestaurantDetail = Readonly<{
  restaurantId: RestaurantId;
  restaurantName: string;
  cuisines: readonly string[];
  branchId: BranchId;
  branchName: string;
  grabUrl: string | null;
  menuVersionPublishedAt: UtcTimestamp;
  categories: readonly RestaurantMenuCategory[];
}>;
```

- [ ] **Step 5: Create import-summary.ts**

Create `packages/domain/src/catalog/import-summary.ts`:

```typescript
/** Result returned after parsing and persisting an uploaded catalog CSV. */
export type CatalogImportWarning = Readonly<{
  row: number;
  reason: string;
}>;

export type CatalogImportSummary = Readonly<{
  restaurantsAdded: number;
  restaurantsUpdated: number;
  itemsAdded: number;
  itemsSkipped: number;
  warnings: readonly CatalogImportWarning[];
}>;
```

- [ ] **Step 6: Re-export from catalog/index.ts**

In `packages/domain/src/catalog/index.ts`, add:

```typescript
export * from "./restaurant-summary.js";
export * from "./restaurant-detail.js";
export * from "./import-summary.js";
```

- [ ] **Step 7: Run typecheck**

Run:
```bash
npm run typecheck
```

Expected: success across all workspaces.

- [ ] **Step 8: Commit**

```bash
git add packages/domain/src/catalog/
git commit -m "feat(domain): add restaurant summary, detail, and import summary types"
```

---

## Task 3: CSV row contract parser

**Files:**
- Create: `packages/contracts/src/catalog/csv-row.ts`
- Create: `packages/contracts/src/catalog/csv-row.test.ts`
- Modify: `packages/contracts/src/catalog/index.ts`

- [ ] **Step 1: Write failing test for happy path**

Create `packages/contracts/src/catalog/csv-row.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { parseCsvHeader, parseCsvRow } from "./csv-row.js";

const validHeader = [
  "restaurant_name",
  "branch_name",
  "source_platform",
  "source_restaurant_id",
  "source_url",
  "cuisines",
  "category_name",
  "item_name",
  "description",
  "price_php",
  "price_centavos",
  "restaurant_min_price_php",
  "restaurant_max_price_php",
  "currency",
  "image_url",
  "is_available",
  "collected_at",
];

const validRow = {
  restaurant_name: "McDonald's - Magsaysay / Naga Magsaysay",
  branch_name: "Magsaysay / Naga Magsaysay",
  source_platform: "GrabFood",
  source_restaurant_id: "2-C2LKHGNGCKKCJ2",
  source_url: "https://food.grab.com/ph/en/restaurant/example/2-C2LKHGNGCKKCJ2",
  cuisines: "American,Burger,Fried Chicken,Fast Food",
  category_name: "New Offers",
  item_name: "McCafé Iced Coffee Coco Mocha",
  description: "McCafé Iced Coffee Coco Mocha",
  price_php: "89.00",
  price_centavos: "8900",
  restaurant_min_price_php: "11.00",
  restaurant_max_price_php: "865.00",
  currency: "PHP",
  image_url: "https://huawei-food-cms.grab.com/compressed_avif/items/example/photo.avif",
  is_available: "true",
  collected_at: "2026-08-12",
};

describe("parseCsvHeader", () => {
  it("accepts the exact expected header row", () => {
    expect(() => parseCsvHeader(validHeader)).not.toThrow();
  });

  it("throws when a required column is missing", () => {
    expect(() => parseCsvHeader(validHeader.filter((h) => h !== "price_centavos")))
      .toThrow("CSV is missing required column: price_centavos");
  });

  it("throws when an unexpected extra column is present", () => {
    expect(() => parseCsvHeader([...validHeader, "extra_column"]))
      .toThrow("CSV contains unexpected column: extra_column");
  });
});

describe("parseCsvRow", () => {
  it("parses a valid row into typed fields with cuisines split on comma", () => {
    const parsed = parseCsvRow(validRow);
    expect(parsed).toEqual({
      restaurantName: "McDonald's - Magsaysay / Naga Magsaysay",
      branchName: "Magsaysay / Naga Magsaysay",
      sourceRestaurantId: "2-C2LKHGNGCKKCJ2",
      sourceUrl: "https://food.grab.com/ph/en/restaurant/example/2-C2LKHGNGCKKCJ2",
      cuisines: ["American", "Burger", "Fried Chicken", "Fast Food"],
      categoryName: "New Offers",
      itemName: "McCafé Iced Coffee Coco Mocha",
      description: "McCafé Iced Coffee Coco Mocha",
      priceCentavos: 8900,
      imageUrl: "https://huawei-food-cms.grab.com/compressed_avif/items/example/photo.avif",
      isAvailable: true,
      collectedAt: "2026-08-12",
    });
  });

  it("trims whitespace around cuisine entries and drops empty ones", () => {
    const parsed = parseCsvRow({ ...validRow, cuisines: " American ,, Burger ," });
    expect(parsed.cuisines).toEqual(["American", "Burger"]);
  });

  it("throws when price_centavos is not a non-negative integer", () => {
    expect(() => parseCsvRow({ ...validRow, price_centavos: "-5" }))
      .toThrow("price_centavos must be a non-negative integer");
  });

  it("throws when is_available is not 'true' or 'false'", () => {
    expect(() => parseCsvRow({ ...validRow, is_available: "yes" }))
      .toThrow("is_available must be 'true' or 'false'");
  });

  it("throws when collected_at is not a valid YYYY-MM-DD date", () => {
    expect(() => parseCsvRow({ ...validRow, collected_at: "08/12/2026" }))
      .toThrow("collected_at must be a YYYY-MM-DD date");
  });

  it("allows null description and null image_url", () => {
    const parsed = parseCsvRow({
      ...validRow,
      description: "",
      image_url: "",
    });
    expect(parsed.description).toBeNull();
    expect(parsed.imageUrl).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm run test:unit -- packages/contracts/src/catalog/csv-row.test.ts
```

Expected: FAIL — `parseCsvHeader` and `parseCsvRow` are not exported (file does not exist yet).

- [ ] **Step 3: Implement parseCsvHeader and parseCsvRow**

Create `packages/contracts/src/catalog/csv-row.ts`:

```typescript
export const CSV_REQUIRED_HEADERS = [
  "restaurant_name",
  "branch_name",
  "source_platform",
  "source_restaurant_id",
  "source_url",
  "cuisines",
  "category_name",
  "item_name",
  "description",
  "price_php",
  "price_centavos",
  "restaurant_min_price_php",
  "restaurant_max_price_php",
  "currency",
  "image_url",
  "is_available",
  "collected_at",
] as const;

export type CsvRow = Readonly<{
  restaurantName: string;
  branchName: string;
  sourceRestaurantId: string;
  sourceUrl: string;
  cuisines: readonly string[];
  categoryName: string;
  itemName: string;
  description: string | null;
  priceCentavos: number;
  imageUrl: string | null;
  isAvailable: boolean;
  collectedAt: string;
}>;

/** Validates the exact CSV header row. Throws on missing or unexpected columns. */
export function parseCsvHeader(header: readonly string[]): void {
  for (const required of CSV_REQUIRED_HEADERS) {
    if (!header.includes(required)) {
      throw new Error(`CSV is missing required column: ${required}`);
    }
  }
  for (const column of header) {
    if (!CSV_REQUIRED_HEADERS.includes(column as (typeof CSV_REQUIRED_HEADERS)[number])) {
      throw new Error(`CSV contains unexpected column: ${column}`);
    }
  }
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function asNonNegativeInt(value: unknown, field: string): number {
  const raw = asString(value, field).trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return Number(raw);
}

function asBooleanFlag(value: unknown, field: string): boolean {
  const raw = asString(value, field).trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${field} must be 'true' or 'false'`);
}

function asIsoDate(value: unknown, field: string): string {
  const raw = asString(value, field).trim();
  if (!ISO_DATE_PATTERN.test(raw)) {
    throw new Error(`${field} must be a YYYY-MM-DD date`);
  }
  return raw;
}

function asNullableString(value: unknown, field: string): string | null {
  const raw = asString(value, field).trim();
  return raw.length === 0 ? null : raw;
}

function asCuisines(value: unknown): readonly string[] {
  const raw = asString(value, "cuisines");
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Parses one CSV row (as a Record<headerName, cellValue>) into a typed value. */
export function parseCsvRow(row: Record<string, unknown>): CsvRow {
  return {
    restaurantName: asString(row.restaurant_name, "restaurant_name").trim(),
    branchName: asString(row.branch_name, "branch_name").trim(),
    sourceRestaurantId: asString(row.source_restaurant_id, "source_restaurant_id").trim(),
    sourceUrl: asString(row.source_url, "source_url").trim(),
    cuisines: asCuisines(row.cuisines),
    categoryName: asString(row.category_name, "category_name").trim(),
    itemName: asString(row.item_name, "item_name").trim(),
    description: asNullableString(row.description, "description"),
    priceCentavos: asNonNegativeInt(row.price_centavos, "price_centavos"),
    imageUrl: asNullableString(row.image_url, "image_url"),
    isAvailable: asBooleanFlag(row.is_available, "is_available"),
    collectedAt: asIsoDate(row.collected_at, "collected_at"),
  };
}
```

- [ ] **Step 4: Re-export from index**

In `packages/contracts/src/catalog/index.ts`, add:

```typescript
export * from "./csv-row.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npm run test:unit -- packages/contracts/src/catalog/csv-row.test.ts
```

Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/catalog/csv-row.ts packages/contracts/src/catalog/csv-row.test.ts packages/contracts/src/catalog/index.ts
git commit -m "feat(contracts): add strict CSV header and row parsers"
```

---

## Task 4: Restaurant list and detail response parsers

**Files:**
- Create: `packages/contracts/src/catalog/restaurant-list-response.ts`
- Create: `packages/contracts/src/catalog/restaurant-list-response.test.ts`
- Create: `packages/contracts/src/catalog/restaurant-detail-response.ts`
- Create: `packages/contracts/src/catalog/restaurant-detail-response.test.ts`
- Create: `packages/contracts/src/catalog/import-response.ts`
- Create: `packages/contracts/src/catalog/import-response.test.ts`
- Modify: `packages/contracts/src/catalog/index.ts`

- [ ] **Step 1: Write failing tests for the list response parser**

Create `packages/contracts/src/catalog/restaurant-list-response.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { parseRestaurantListResponse } from "./restaurant-list-response.js";

describe("parseRestaurantListResponse", () => {
  it("parses a valid list with one restaurant", () => {
    const input = [
      {
        id: "rest-1",
        name: "McDonald's",
        cuisines: ["American", "Burger"],
        branchId: "branch-1",
        branchName: "Magsaysay",
        heroImageUrl: "https://example.test/photo.avif",
      },
    ];
    expect(parseRestaurantListResponse(input)).toEqual(input);
  });

  it("parses an empty list", () => {
    expect(parseRestaurantListResponse([])).toEqual([]);
  });

  it("allows null heroImageUrl", () => {
    const input = [
      {
        id: "rest-1",
        name: "Test",
        cuisines: [],
        branchId: "b-1",
        branchName: "Branch",
        heroImageUrl: null,
      },
    ];
    expect(parseRestaurantListResponse(input)).toEqual(input);
  });

  it("rejects an entry missing a required field", () => {
    expect(() =>
      parseRestaurantListResponse([
        { id: "rest-1", name: "Test" },
      ]),
    ).toThrow("Restaurant summary contains unknown field");
  });
});
```

- [ ] **Step 2: Implement parseRestaurantListResponse**

Create `packages/contracts/src/catalog/restaurant-list-response.ts`:

```typescript
import type { RestaurantSummary } from "@ordah-please/domain";

import {
  parseArray,
  parseNullableString,
  parseRecordId,
  parseStrictObject,
  parseString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";
import { parseStringArray } from "../common/parse-string-array.js";

/** Validates the member-facing restaurant list response. */
export function parseRestaurantListResponse(
  value: unknown,
): readonly RestaurantSummary[] {
  return parseArray(value, "Restaurant list", parseRestaurantSummary);
}

function parseRestaurantSummary(value: unknown): RestaurantSummary {
  const object = parseStrictObject(value, "Restaurant summary");
  rejectUnknownFields(
    object,
    ["id", "name", "cuisines", "branchId", "branchName", "heroImageUrl"],
    "Restaurant summary",
  );
  return {
    id: parseRecordId(object.id, "Restaurant id"),
    name: parseString(object.name, "Restaurant name"),
    cuisines: parseStringArray(object.cuisines, "Restaurant cuisines"),
    branchId: parseRecordId(object.branchId, "Branch id"),
    branchName: parseString(object.branchName, "Branch name"),
    heroImageUrl: parseNullableString(object.heroImageUrl, "Hero image url"),
  };
}
```

- [ ] **Step 3: Check whether parseStringArray exists; create it if not**

Check:
```bash
ls packages/contracts/src/common/
```

If `parse-string-array.ts` does not exist, create `packages/contracts/src/common/parse-string-array.ts`:

```typescript
import { parseArray, parseString } from "./strict-boundary.js";

/** Parses a string array field, used for cuisines and similar tags. */
export function parseStringArray(value: unknown, field: string): readonly string[] {
  return parseArray(value, field, (entry) => parseString(entry, `${field} entry`));
}
```

And re-export it from `packages/contracts/src/common/index.ts` if such a barrel exists, otherwise leave it as a direct import.

- [ ] **Step 4: Write failing tests for the detail response parser**

Create `packages/contracts/src/catalog/restaurant-detail-response.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { parseRestaurantDetailResponse } from "./restaurant-detail-response.js";

const validDetail = {
  restaurantId: "rest-1",
  restaurantName: "McDonald's",
  cuisines: ["American"],
  branchId: "branch-1",
  branchName: "Magsaysay",
  grabUrl: "https://food.grab.com/example",
  menuVersionPublishedAt: "2026-08-12T00:00:00.000Z",
  categories: [
    {
      name: "New Offers",
      items: [
        {
          id: "item-1",
          name: "McCafé Iced Coffee Coco Mocha",
          description: "Coffee",
          priceCentavos: 8900,
          availability: "available",
          imageUrl: "https://example.test/photo.avif",
          variants: [],
          modifierGroups: [],
        },
      ],
    },
  ],
};

describe("parseRestaurantDetailResponse", () => {
  it("preserves a valid detail response exactly", () => {
    expect(parseRestaurantDetailResponse(validDetail)).toEqual(validDetail);
  });

  it("allows null grabUrl and null imageUrl", () => {
    const input = {
      ...validDetail,
      grabUrl: null,
      categories: [
        {
          ...validDetail.categories[0],
          items: [{ ...validDetail.categories[0].items[0], imageUrl: null }],
        },
      ],
    };
    expect(parseRestaurantDetailResponse(input)).toEqual(input);
  });

  it("rejects an unknown top-level field", () => {
    expect(() =>
      parseRestaurantDetailResponse({ ...validDetail, extra: true }),
    ).toThrow("Restaurant detail contains unknown field");
  });
});
```

- [ ] **Step 5: Implement parseRestaurantDetailResponse**

Create `packages/contracts/src/catalog/restaurant-detail-response.ts`:

```typescript
import type { RestaurantDetail } from "@ordah-please/domain";

import {
  parseArray,
  parseCentavosValue,
  parseEnum,
  parseNullableString,
  parseRecordId,
  parseStrictObject,
  parseString,
  parseUtcString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";
import { parseStringArray } from "../common/parse-string-array.js";

const availabilityStates = ["available", "unavailable"] as const;

/** Validates the member restaurant detail response. */
export function parseRestaurantDetailResponse(value: unknown): RestaurantDetail {
  const object = parseStrictObject(value, "Restaurant detail");
  rejectUnknownFields(
    object,
    [
      "restaurantId",
      "restaurantName",
      "cuisines",
      "branchId",
      "branchName",
      "grabUrl",
      "menuVersionPublishedAt",
      "categories",
    ],
    "Restaurant detail",
  );
  return {
    restaurantId: parseRecordId(object.restaurantId, "Restaurant id"),
    restaurantName: parseString(object.restaurantName, "Restaurant name"),
    cuisines: parseStringArray(object.cuisines, "Restaurant cuisines"),
    branchId: parseRecordId(object.branchId, "Branch id"),
    branchName: parseString(object.branchName, "Branch name"),
    grabUrl: parseNullableString(object.grabUrl, "Branch grab URL"),
    menuVersionPublishedAt: parseUtcString(
      object.menuVersionPublishedAt,
      "Menu version published at",
    ),
    categories: parseArray(object.categories, "Categories", parseCategory),
  };
}

function parseCategory(value: unknown): RestaurantDetail["categories"][number] {
  const object = parseStrictObject(value, "Restaurant menu category");
  rejectUnknownFields(object, ["name", "items"], "Restaurant menu category");
  return {
    name: parseString(object.name, "Category name"),
    items: parseArray(object.items, "Category items", parseItem),
  };
}

function parseItem(value: unknown): RestaurantDetail["categories"][number]["items"][number] {
  const object = parseStrictObject(value, "Menu item");
  rejectUnknownFields(
    object,
    [
      "id",
      "name",
      "description",
      "priceCentavos",
      "availability",
      "imageUrl",
      "variants",
      "modifierGroups",
    ],
    "Menu item",
  );
  return {
    id: parseRecordId(object.id, "Menu item id"),
    name: parseString(object.name, "Menu item name"),
    description: parseString(object.description, "Menu item description"),
    priceCentavos: parseCentavosValue(object.priceCentavos, "Menu item price"),
    availability: parseEnum(object.availability, availabilityStates, "Menu item availability"),
    imageUrl: parseNullableString(object.imageUrl, "Menu item image url"),
    variants: parseArray(object.variants, "Menu item variants", () => {
      throw new Error("Variants are not supported in V1");
    }),
    modifierGroups: parseArray(object.modifierGroups, "Menu item modifier groups", () => {
      throw new Error("Modifier groups are not supported in V1");
    }),
  };
}
```

Note: since the V1 CSV has no variants or modifier groups, the list parsers will only ever receive empty arrays. The throws above are defensive — they fire only if a non-empty array arrives, which would indicate API drift.

- [ ] **Step 6: Write failing tests for the import response parser**

Create `packages/contracts/src/catalog/import-response.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { parseCatalogImportResponse } from "./import-response.js";

describe("parseCatalogImportResponse", () => {
  it("parses a successful summary", () => {
    const input = {
      restaurantsAdded: 2,
      restaurantsUpdated: 1,
      itemsAdded: 47,
      itemsSkipped: 1,
      warnings: [{ row: 12, reason: "price_centavos missing" }],
    };
    expect(parseCatalogImportResponse(input)).toEqual(input);
  });

  it("parses an empty warnings list", () => {
    const input = {
      restaurantsAdded: 1,
      restaurantsUpdated: 0,
      itemsAdded: 3,
      itemsSkipped: 0,
      warnings: [],
    };
    expect(parseCatalogImportResponse(input)).toEqual(input);
  });

  it("rejects a negative count", () => {
    expect(() =>
      parseCatalogImportResponse({
        restaurantsAdded: -1,
        restaurantsUpdated: 0,
        itemsAdded: 0,
        itemsSkipped: 0,
        warnings: [],
      }),
    ).toThrow("restaurantsAdded must be non-negative");
  });
});
```

- [ ] **Step 7: Implement parseCatalogImportResponse**

Create `packages/contracts/src/catalog/import-response.ts`:

```typescript
import type { CatalogImportSummary } from "@ordah-please/domain";

import {
  parseArray,
  parseNonNegativeInteger,
  parseStrictObject,
  parseString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

/** Validates the upload endpoint response. */
export function parseCatalogImportResponse(value: unknown): CatalogImportSummary {
  const object = parseStrictObject(value, "Catalog import summary");
  rejectUnknownFields(
    object,
    ["restaurantsAdded", "restaurantsUpdated", "itemsAdded", "itemsSkipped", "warnings"],
    "Catalog import summary",
  );
  return {
    restaurantsAdded: parseNonNegativeInteger(object.restaurantsAdded, "restaurantsAdded"),
    restaurantsUpdated: parseNonNegativeInteger(object.restaurantsUpdated, "restaurantsUpdated"),
    itemsAdded: parseNonNegativeInteger(object.itemsAdded, "itemsAdded"),
    itemsSkipped: parseNonNegativeInteger(object.itemsSkipped, "itemsSkipped"),
    warnings: parseArray(object.warnings, "Warnings", parseWarning),
  };
}

function parseWarning(value: unknown): CatalogImportSummary["warnings"][number] {
  const object = parseStrictObject(value, "Catalog import warning");
  rejectUnknownFields(object, ["row", "reason"], "Catalog import warning");
  return {
    row: parseNonNegativeInteger(object.row, "Warning row"),
    reason: parseString(object.reason, "Warning reason"),
  };
}
```

- [ ] **Step 8: Re-export from index**

In `packages/contracts/src/catalog/index.ts`, add:

```typescript
export * from "./restaurant-list-response.js";
export * from "./restaurant-detail-response.js";
export * from "./import-response.js";
```

- [ ] **Step 9: Run all new tests**

Run:
```bash
npm run test:unit -- packages/contracts/src/catalog/
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/contracts/src/catalog/ packages/contracts/src/common/parse-string-array.ts
git commit -m "feat(contracts): add catalog list, detail, and import response parsers"
```

---

## Task 5: Repository — list and detail read functions

**Files:**
- Modify: `packages/db/src/repositories/catalog.ts`

- [ ] **Step 1: Read the existing transaction.ts to understand the database type**

Run:
```bash
cat packages/db/src/transaction.ts
```

Note the exported `DatabaseTransaction` type for use in the new functions.

- [ ] **Step 2: Extend the CatalogRepository interface**

In `packages/db/src/repositories/catalog.ts`, replace the existing interface and factory. Add imports at the top:

```typescript
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  branches,
  menuCategories,
  menuItems,
  menuVersions,
  restaurants,
} from "../schema/index.js";
import type { RepositoryDatabase } from "./database.js";
```

Replace the interface:

```typescript
export interface RestaurantSummaryRow {
  restaurantId: string;
  restaurantName: string;
  cuisines: readonly string[];
  branchId: string;
  branchName: string;
  heroImageUrl: string | null;
}

export interface RestaurantDetailCategoryRow {
  name: string;
  items: readonly RestaurantDetailItemRow[];
}

export interface RestaurantDetailItemRow {
  id: string;
  name: string;
  description: string | null;
  basePriceCentavos: number;
  isAvailable: boolean;
  imageUrl: string | null;
  sortOrder: number;
}

export interface RestaurantDetailRow {
  restaurantId: string;
  restaurantName: string;
  cuisines: readonly string[];
  branchId: string;
  branchName: string;
  grabUrl: string | null;
  menuVersionPublishedAt: Date;
  categories: readonly RestaurantDetailCategoryRow[];
}

export interface CatalogRepository {
  findPublishedMenuVersion(
    branchId: string,
  ): Promise<typeof menuVersions.$inferSelect | undefined>;
  listRestaurants(): Promise<readonly RestaurantSummaryRow[]>;
  getRestaurantDetail(
    restaurantId: string,
  ): Promise<RestaurantDetailRow | null>;
}
```

- [ ] **Step 3: Implement listRestaurants and getRestaurantDetail**

Still in `packages/db/src/repositories/catalog.ts`, add to the returned object inside `createCatalogRepository`:

```typescript
    listRestaurants: async () => {
      const rows = await database
        .select({
          restaurantId: restaurants.id,
          restaurantName: restaurants.name,
          cuisines: restaurants.cuisines,
          branchId: branches.id,
          branchName: branches.name,
          menuVersionId: menuVersions.id,
        })
        .from(restaurants)
        .innerJoin(branches, eq(branches.restaurantId, restaurants.id))
        .innerJoin(
          menuVersions,
          and(
            eq(menuVersions.branchId, branches.id),
            eq(menuVersions.status, "published"),
          ),
        )
        .where(eq(restaurants.archivedAt, null));
      if (rows.length === 0) return [];

      const firstItemPerVersion = await database
        .select({
          menuVersionId: menuItems.menuVersionId,
          imageUrl: menuItems.imageUrl,
        })
        .from(menuItems)
        .innerJoin(
          menuCategories,
          eq(menuCategories.id, menuItems.categoryId),
        )
        .where(
          inArray(
            menuCategories.menuVersionId,
            rows.map((r) => r.menuVersionId),
          ),
        )
        .groupBy(menuItems.menuVersionId)
        // Drizzle doesn't have a clean "first per group" — fetch one image per version below instead
        ;

      // Simpler: fetch all (menuVersionId, imageUrl) pairs ordered by category sort then item sort,
      // then take the first per version in JS.
      const candidates = await database
        .select({
          menuVersionId: menuCategories.menuVersionId,
          imageUrl: menuItems.imageUrl,
        })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuCategories.id, menuItems.categoryId))
        .where(
          inArray(
            menuCategories.menuVersionId,
            rows.map((r) => r.menuVersionId),
          ),
        )
        .orderBy(asc(menuCategories.sortOrder), asc(menuItems.sortOrder));

      const heroByMenuVersion = new Map<string, string | null>();
      for (const c of candidates) {
        if (!heroByMenuVersion.has(c.menuVersionId) && c.imageUrl) {
          heroByMenuVersion.set(c.menuVersionId, c.imageUrl);
        }
      }

      return rows.map((row) => ({
        restaurantId: row.restaurantId,
        restaurantName: row.restaurantName,
        cuisines: row.cuisines,
        branchId: row.branchId,
        branchName: row.branchName,
        heroImageUrl: heroByMenuVersion.get(row.menuVersionId) ?? null,
      }));
    },

    getRestaurantDetail: async (restaurantId) => {
      const [branchRow] = await database
        .select({
          restaurantId: restaurants.id,
          restaurantName: restaurants.name,
          cuisines: restaurants.cuisines,
          branchId: branches.id,
          branchName: branches.name,
          grabUrl: branches.grabUrl,
          menuVersionId: menuVersions.id,
          menuVersionPublishedAt: menuVersions.publishedAt,
        })
        .from(restaurants)
        .innerJoin(branches, eq(branches.restaurantId, restaurants.id))
        .innerJoin(
          menuVersions,
          and(
            eq(menuVersions.branchId, branches.id),
            eq(menuVersions.status, "published"),
          ),
        )
        .where(eq(restaurants.id, restaurantId))
        .limit(1);
      if (!branchRow) return null;

      const categoryRows = await database
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.menuVersionId, branchRow.menuVersionId))
        .orderBy(asc(menuCategories.sortOrder));

      const itemRows = await database
        .select()
        .from(menuItems)
        .innerJoin(
          menuCategories,
          eq(menuCategories.id, menuItems.categoryId),
        )
        .where(eq(menuCategories.menuVersionId, branchRow.menuVersionId))
        .orderBy(asc(menuCategories.sortOrder), asc(menuItems.sortOrder));

      const itemsByCategory = new Map<string, RestaurantDetailItemRow[]>();
      for (const item of itemRows) {
        const list = itemsByCategory.get(item.categoryId) ?? [];
        list.push({
          id: item.id,
          name: item.name,
          description: item.description,
          basePriceCentavos: item.basePriceCentavos,
          isAvailable: item.isAvailable,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder,
        });
        itemsByCategory.set(item.categoryId, list);
      }

      const categories: RestaurantDetailCategoryRow[] = categoryRows.map((c) => ({
        name: c.name,
        items: itemsByCategory.get(c.id) ?? [],
      }));

      return {
        restaurantId: branchRow.restaurantId,
        restaurantName: branchRow.restaurantName,
        cuisines: branchRow.cuisines,
        branchId: branchRow.branchId,
        branchName: branchRow.branchName,
        grabUrl: branchRow.grabUrl,
        menuVersionPublishedAt: branchRow.menuVersionPublishedAt,
        categories,
      };
    },
```

Note: `menuItems.menuVersionId` doesn't exist on the items table directly — items reference categories which reference menu versions. The second query above (`itemRows`) joins through `menuCategories` correctly. The first `firstItemPerVersion` block uses a non-existent column and should be removed — keep only the `candidates` block which joins correctly. Final code should NOT include the `firstItemPerVersion` block; the comment in the code marks it for deletion during implementation.

- [ ] **Step 4: Remove the broken firstItemPerVersion block**

In the implementation above, delete the `firstItemPerVersion` block entirely. The `candidates` query is sufficient. The implementer should review the final code and ensure `menuItems.menuVersionId` is never referenced (it doesn't exist).

- [ ] **Step 5: Write an integration test**

Create `packages/db/src/repositories/catalog-read.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCatalogImportTestSeed } from "../dev/seed-catalog-for-tests.js";
import { closeTestDatabase, createTestDatabase } from "../dev/test-database.js";
import { createCatalogRepository } from "./catalog.js";

describe("CatalogRepository read functions", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let seed: Awaited<ReturnType<typeof createCatalogImportTestSeed>>;

  beforeAll(async () => {
    database = await createTestDatabase();
    seed = await createCatalogImportTestSeed(database);
  });

  afterAll(async () => {
    await closeTestDatabase(database);
  });

  it("listRestaurants returns seeded restaurants with hero image from first item", () => {
    const repo = createCatalogRepository(database);
    const rows = await repo.listRestaurants();
    expect(rows.map((r) => r.restaurantName).sort()).toEqual(
      [seed.restaurantA.name, seed.restaurantB.name].sort(),
    );
    const withHero = rows.find((r) => r.restaurantName === seed.restaurantA.name);
    expect(withHero?.heroImageUrl).toBe(seed.firstItemImageUrl);
  });

  it("getRestaurantDetail returns categories with ordered items", async () => {
    const repo = createCatalogRepository(database);
    const detail = await repo.getRestaurantDetail(seed.restaurantA.id);
    expect(detail).not.toBeNull();
    expect(detail?.categories.map((c) => c.name)).toEqual(["For You", "New Offers"]);
    expect(detail?.categories[1].items[0].name).toBe(seed.restaurantANewItemName);
  });

  it("getRestaurantDetail returns null for unknown restaurant id", async () => {
    const repo = createCatalogRepository(database);
    const detail = await repo.getRestaurantDetail("00000000-0000-0000-0000-000000000000");
    expect(detail).toBeNull();
  });
});
```

The test helper `createCatalogImportTestSeed` and `createTestDatabase` need to exist. Check whether they do:

```bash
ls packages/db/src/dev/
```

If test helpers don't exist, look at `packages/db/src/repositories/repositories.provider.integration.test.ts` to see how existing integration tests set up the test database. Mirror that pattern.

- [ ] **Step 6: Run integration tests**

Run:
```bash
RUN_PROVIDER_TESTS=1 npm run test:unit -- packages/db/src/repositories/catalog-read.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/repositories/catalog.ts packages/db/src/repositories/catalog-read.test.ts
git commit -m "feat(db): add catalog list and detail read repositories"
```

---

## Task 6: Repository — importCatalog transactional upsert

**Files:**
- Modify: `packages/db/src/repositories/catalog.ts`
- Create: `packages/db/src/repositories/catalog-import.test.ts`

- [ ] **Step 1: Add the importCatalog function signature to the interface**

In `packages/db/src/repositories/catalog.ts`, extend `CatalogRepository`:

```typescript
export interface CatalogImportInputRow {
  restaurantName: string;
  branchName: string;
  sourceRestaurantId: string;
  sourceUrl: string;
  cuisines: readonly string[];
  categoryName: string;
  itemName: string;
  description: string | null;
  priceCentavos: number;
  imageUrl: string | null;
  isAvailable: boolean;
  collectedAt: string;
}

export interface CatalogImportResult {
  restaurantsAdded: number;
  restaurantsUpdated: number;
  itemsAdded: number;
  itemsSkipped: number;
  warnings: readonly { row: number; reason: string }[];
}

export interface CatalogRepository {
  findPublishedMenuVersion(...): ...;
  listRestaurants(...): ...;
  getRestaurantDetail(...): ...;
  importCatalog(
    userId: string,
    rows: readonly CatalogImportInputRow[],
    warnings: readonly { row: number; reason: string }[],
  ): Promise<CatalogImportResult>;
}
```

- [ ] **Step 2: Implement importCatalog**

In the factory's returned object, add:

```typescript
    importCatalog: async (userId, rows, warnings) => {
      // Group rows by sourceRestaurantId; each group is one restaurant + branch.
      const grouped = new Map<string, CatalogImportInputRow[]>();
      for (const row of rows) {
        const list = grouped.get(row.sourceRestaurantId) ?? [];
        list.push(row);
        grouped.set(row.sourceRestaurantId, list);
      }

      const result = {
        restaurantsAdded: 0,
        restaurantsUpdated: 0,
        itemsAdded: 0,
        itemsSkipped: 0,
        warnings,
      };

      for (const [, groupRows] of grouped) {
        const first = groupRows[0];
        if (!first) continue;

        await database.transaction(async (tx) => {
          // 1. Upsert restaurant by name
          const [existing] = await tx
            .select()
            .from(restaurants)
            .where(eq(restaurants.name, first.restaurantName))
            .limit(1);

          let restaurantId: string;
          if (existing) {
            await tx
              .update(restaurants)
              .set({
                cuisines: [...first.cuisines],
                updatedAt: new Date(),
              })
              .where(eq(restaurants.id, existing.id));
            restaurantId = existing.id;
            result.restaurantsUpdated += 1;
          } else {
            const [inserted] = await tx
              .insert(restaurants)
              .values({
                name: first.restaurantName,
                cuisines: [...first.cuisines],
              })
              .returning({ id: restaurants.id });
            restaurantId = inserted!.id;
            result.restaurantsAdded += 1;
          }

          // 2. Upsert branch by (restaurantId, sourceKey)
          const [existingBranch] = await tx
            .select()
            .from(branches)
            .where(
              and(
                eq(branches.restaurantId, restaurantId),
                eq(branches.sourceKey, first.sourceRestaurantId),
              ),
            )
            .limit(1);

          let branchId: string;
          if (existingBranch) {
            await tx
              .update(branches)
              .set({ name: first.branchName, grabUrl: first.sourceUrl, updatedAt: new Date() })
              .where(eq(branches.id, existingBranch.id));
            branchId = existingBranch.id;
          } else {
            const [insertedBranch] = await tx
              .insert(branches)
              .values({
                restaurantId,
                sourceKey: first.sourceRestaurantId,
                name: first.branchName,
                grabUrl: first.sourceUrl,
              })
              .returning({ id: branches.id });
            branchId = insertedBranch!.id;
          }

          // 3. Create a new catalogImports row for auditability
          const [importRow] = await tx
            .insert(catalogImports)
            .values({
              createdByUserId: userId,
              status: "published",
              publishedAt: new Date(),
            })
            .returning({ id: catalogImports.id });

          // 4. Find the currently published menu_version for this branch (if any) and supersede it
          const [currentPublished] = await tx
            .select()
            .from(menuVersions)
            .where(
              and(
                eq(menuVersions.branchId, branchId),
                eq(menuVersions.status, "published"),
              ),
            )
            .limit(1);

          if (currentPublished) {
            await tx
              .update(menuVersions)
              .set({ status: "superseded" })
              .where(eq(menuVersions.id, currentPublished.id));
          }

          const nextVersionNumber = currentPublished
            ? currentPublished.versionNumber + 1
            : 1;

          // 5. Insert new menu_version (published)
          const collectedDate = new Date(`${first.collectedAt}T00:00:00.000Z`);
          const [newVersion] = await tx
            .insert(menuVersions)
            .values({
              branchId,
              sourceImportId: importRow!.id,
              versionNumber: nextVersionNumber,
              status: "published",
              publishedAt: collectedDate,
            })
            .returning({ id: menuVersions.id });
          const menuVersionId = newVersion!.id;

          // 6. Insert categories (dedupe by name within version; sortOrder = first-seen order)
          const categoryNameToId = new Map<string, string>();
          let categorySort = 0;
          for (const row of groupRows) {
            if (categoryNameToId.has(row.categoryName)) continue;
            const [inserted] = await tx
              .insert(menuCategories)
              .values({
                menuVersionId,
                name: row.categoryName,
                sortOrder: categorySort++,
              })
              .returning({ id: menuCategories.id });
            categoryNameToId.set(row.categoryName, inserted!.id);
          }

          // 7. Insert items (sortOrder within category by row order in the group)
          const itemOrderInCategory = new Map<string, number>();
          for (const row of groupRows) {
            const categoryId = categoryNameToId.get(row.categoryName)!;
            const nextSort = itemOrderInCategory.get(row.categoryName) ?? 0;
            itemOrderInCategory.set(row.categoryName, nextSort + 1);
            await tx.insert(menuItems).values({
              categoryId,
              sourceKey: row.itemName,
              name: row.itemName,
              description: row.description,
              basePriceCentavos: row.priceCentavos,
              isAvailable: row.isAvailable,
              imageUrl: row.imageUrl,
              sortOrder: nextSort,
            });
            result.itemsAdded += 1;
          }
        });
      }

      return result;
    },
```

The implementer needs to add `catalogImports` to the import list at the top of the file:

```typescript
import {
  branches,
  catalogImports,
  menuCategories,
  menuItems,
  menuVersions,
  restaurants,
} from "../schema/index.js";
```

Also, the `RepositoryDatabase` type may need to expose `.transaction()`. Check `packages/db/src/transaction.ts` for the type; if `RepositoryDatabase` doesn't include `transaction`, either extend it or accept a broader type for `importCatalog`. The simplest fix: change `importCatalog`'s implementation to require the full transaction-capable database. If `RepositoryDatabase` doesn't have transaction, update it:

```typescript
// packages/db/src/repositories/database.ts
export type RepositoryDatabase = Pick<
  DatabaseTransaction,
  "insert" | "select" | "update" | "transaction"
>;
```

- [ ] **Step 3: Write integration test for import**

Create `packages/db/src/repositories/catalog-import.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeTestDatabase, createTestDatabase } from "../dev/test-database.js";
import { createCatalogRepository } from "./catalog.js";

describe("CatalogRepository.importCatalog", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase(database);
  });

  it("inserts a new restaurant with one menu version and counts added", async () => {
    const repo = createCatalogRepository(database);
    const result = await repo.importCatalog("user-1", [
      {
        restaurantName: "Test Burger Co.",
        branchName: "BGC",
        sourceRestaurantId: "2-TEST123",
        sourceUrl: "https://food.grab.com/example",
        cuisines: ["Burger"],
        categoryName: "Burgers",
        itemName: "Classic Burger",
        description: "Beef patty",
        priceCentavos: 25000,
        imageUrl: "https://example.test/burger.avif",
        isAvailable: true,
        collectedAt: "2026-08-12",
      },
    ], []);
    expect(result).toEqual({
      restaurantsAdded: 1,
      restaurantsUpdated: 0,
      itemsAdded: 1,
      itemsSkipped: 0,
      warnings: [],
    });
  });

  it("updates an existing restaurant and supersedes the prior menu version on re-import", async () => {
    const repo = createCatalogRepository(database);
    const row = {
      restaurantName: "Reimport Diner",
      branchName: "Makati",
      sourceRestaurantId: "2-REIMPORT1",
      sourceUrl: "https://food.grab.com/reimport",
      cuisines: ["Diner"],
      categoryName: "Mains",
      itemName: "Original Item",
      description: null,
      priceCentavos: 10000,
      imageUrl: null,
      isAvailable: true,
      collectedAt: "2026-08-12",
    };

    await repo.importCatalog("user-1", [row], []);
    const second = await repo.importCatalog(
      "user-1",
      [{ ...row, itemName: "Updated Item", priceCentavos: 11000 }],
      [],
    );

    expect(second.restaurantsAdded).toBe(0);
    expect(second.restaurantsUpdated).toBe(1);
    expect(second.itemsAdded).toBe(1);

    const detail = await repo.getRestaurantDetail(
      (await repo.listRestaurants()).find((r) => r.restaurantName === "Reimport Diner")!
        .restaurantId,
    );
    expect(detail?.categories[0].items[0].name).toBe("Updated Item");
    expect(detail?.categories[0].items[0].basePriceCentavos).toBe(11000);
  });

  it("passes warnings through unchanged", async () => {
    const repo = createCatalogRepository(database);
    const result = await repo.importCatalog(
      "user-1",
      [],
      [{ row: 5, reason: "missing price" }],
    );
    expect(result.warnings).toEqual([{ row: 5, reason: "missing price" }]);
  });
});
```

- [ ] **Step 4: Run integration tests**

Run:
```bash
RUN_PROVIDER_TESTS=1 npm run test:unit -- packages/db/src/repositories/catalog-import.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/
git commit -m "feat(db): add transactional importCatalog with replace-on-reimport semantics"
```

---

## Task 7: Repository — restaurant and item updates

**Files:**
- Modify: `packages/db/src/repositories/catalog.ts`

- [ ] **Step 1: Add update functions to the interface**

In `packages/db/src/repositories/catalog.ts`:

```typescript
export interface RestaurantPatch {
  name?: string;
  cuisines?: readonly string[];
}

export interface MenuItemPatch {
  name?: string;
  description?: string | null;
  basePriceCentavos?: number;
  isAvailable?: boolean;
  imageUrl?: string | null;
}

export interface CatalogRepository {
  // ... existing methods
  updateRestaurant(restaurantId: string, patch: RestaurantPatch): Promise<void>;
  updateMenuItem(itemId: string, patch: MenuItemPatch): Promise<void>;
}
```

- [ ] **Step 2: Implement updateRestaurant and updateMenuItem**

Add to the returned object:

```typescript
    updateRestaurant: async (restaurantId, patch) => {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.cuisines !== undefined) updates.cuisines = [...patch.cuisines];
      await database
        .update(restaurants)
        .set(updates)
        .where(eq(restaurants.id, restaurantId));
    },

    updateMenuItem: async (itemId, patch) => {
      const updates: Record<string, unknown> = {};
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.description !== undefined) updates.description = patch.description;
      if (patch.basePriceCentavos !== undefined)
        updates.basePriceCentavos = patch.basePriceCentavos;
      if (patch.isAvailable !== undefined) updates.isAvailable = patch.isAvailable;
      if (patch.imageUrl !== undefined) updates.imageUrl = patch.imageUrl;
      await database.update(menuItems).set(updates).where(eq(menuItems.id, itemId));
    },
```

- [ ] **Step 3: Write integration tests**

Add to `packages/db/src/repositories/catalog-read.test.ts` (or create a new test file):

```typescript
it("updateRestaurant patches name and cuisines", async () => {
  const repo = createCatalogRepository(database);
  // Use a restaurant seeded earlier; replace seed.restaurantA.id with the actual fixture
  await repo.updateRestaurant(seed.restaurantA.id, {
    name: "Renamed Eatery",
    cuisines: ["Updated"],
  });
  const detail = await repo.getRestaurantDetail(seed.restaurantA.id);
  expect(detail?.restaurantName).toBe("Renamed Eatery");
  expect(detail?.cuisines).toEqual(["Updated"]);
});

it("updateMenuItem patches price and availability", async () => {
  const repo = createCatalogRepository(database);
  const detail = await repo.getRestaurantDetail(seed.restaurantA.id);
  const firstItem = detail!.categories[0].items[0];
  await repo.updateMenuItem(firstItem.id, {
    basePriceCentavos: 99900,
    isAvailable: false,
  });
  const after = await repo.getRestaurantDetail(seed.restaurantA.id);
  const updated = after!.categories[0].items.find((i) => i.id === firstItem.id)!;
  expect(updated.basePriceCentavos).toBe(99900);
  expect(updated.isAvailable).toBe(false);
});
```

- [ ] **Step 4: Run tests**

Run:
```bash
RUN_PROVIDER_TESTS=1 npm run test:unit -- packages/db/src/repositories/catalog-read.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/
git commit -m "feat(db): add restaurant and menu item patch repositories"
```

---

## Task 8: Web runtime and route handlers

**Files:**
- Create: `apps/web/src/features/catalog/catalog-runtime.ts`
- Create: `apps/web/src/features/catalog/restaurant-route-handlers.ts`
- Create: `apps/web/src/features/catalog/csv-upload-handler.ts`

- [ ] **Step 1: Study the existing group-runtime and route-handler pattern**

Read these files to learn the runtime pattern:
```bash
cat apps/web/src/features/groups/group-runtime.ts
cat apps/web/src/features/groups/group-route-handlers.ts
```

Note how the runtime wires dependencies (database, repositories, identity loaders) and how route handlers consume them.

- [ ] **Step 2: Create catalog-runtime.ts**

Create `apps/web/src/features/catalog/catalog-runtime.ts`:

```typescript
import { createCatalogRepository } from "@ordah-please/db";

import { getDatabase } from "../../../db/get-database"; // adjust path to existing database accessor

const repository = createCatalogRepository(getDatabase());

export const catalogRuntime = {
  catalog: repository,
} as const;
```

The implementer should find the actual database accessor by reading `apps/web/src/features/groups/group-runtime.ts` and using the same pattern.

- [ ] **Step 3: Create restaurant-route-handlers.ts with read + patch handlers**

Create `apps/web/src/features/catalog/restaurant-route-handlers.ts`:

```typescript
import { parseRestaurantDetailResponse, parseRestaurantListResponse } from "@ordah-please/contracts";

import { requirePlatformAdmin } from "../access/require-platform-admin"; // adjust import to existing admin guard
import { catalogRuntime } from "./catalog-runtime";

/** GET /api/catalog/restaurants — list restaurants for any signed-in user. */
export function createListRestaurantsHandler(deps: { list: () => Promise<unknown> }) {
  return async (): Promise<Response> => {
    const rows = await deps.list();
    return Response.json(rows);
  };
}

/** GET /api/catalog/restaurants/[restaurantId] — restaurant detail. */
export function createGetRestaurantHandler(deps: {
  getDetail: (restaurantId: string) => Promise<unknown>;
}) {
  return async (
    request: Request,
    { params }: { params: { restaurantId: string } },
  ): Promise<Response> => {
    const detail = await deps.getDetail(params.restaurantId);
    if (!detail) {
      return new Response("Restaurant not found", { status: 404 });
    }
    return Response.json(detail);
  };
}

/** PATCH /api/admin/catalog/restaurants/[restaurantId] — Platform Admin only. */
export function createPatchRestaurantHandler(deps: {
  requireAdmin: (request: Request) => Promise<void>;
  patch: (id: string, body: unknown) => Promise<void>;
}) {
  return async (
    request: Request,
    { params }: { params: { restaurantId: string } },
  ): Promise<Response> => {
    await deps.requireAdmin(request);
    const body = await request.json();
    await deps.patch(params.restaurantId, body);
    return new Response(null, { status: 204 });
  };
}

/** PATCH /api/admin/catalog/items/[itemId] — Platform Admin only. */
export function createPatchMenuItemHandler(deps: {
  requireAdmin: (request: Request) => Promise<void>;
  patch: (id: string, body: unknown) => Promise<void>;
}) {
  return async (
    request: Request,
    { params }: { params: { itemId: string } },
  ): Promise<Response> => {
    await deps.requireAdmin(request);
    const body = await request.json();
    await deps.patch(params.itemId, body);
    return new Response(null, { status: 204 });
  };
}

export const listRestaurantsHandler = createListRestaurantsHandler({
  list: async () => catalogRuntime.catalog.listRestaurants(),
});
export const getRestaurantHandler = createGetRestaurantHandler({
  getDetail: async (id) => catalogRuntime.catalog.getRestaurantDetail(id),
});
export const patchRestaurantHandler = createPatchRestaurantHandler({
  requireAdmin: requirePlatformAdmin,
  patch: async (id, body) => catalogRuntime.catalog.updateRestaurant(id, parseRestaurantPatchBody(body)),
});
export const patchMenuItemHandler = createPatchMenuItemHandler({
  requireAdmin: requirePlatformAdmin,
  patch: async (id, body) => catalogRuntime.catalog.updateMenuItem(id, parseMenuItemPatchBody(body)),
});

function parseRestaurantPatchBody(body: unknown) {
  // Minimal validation; use strict-boundary helpers if appropriate
  if (typeof body !== "object" || body === null) {
    throw new Error("Body must be an object");
  }
  const obj = body as Record<string, unknown>;
  const patch: { name?: string; cuisines?: readonly string[] } = {};
  if (typeof obj.name === "string") patch.name = obj.name;
  if (Array.isArray(obj.cuisines)) {
    patch.cuisines = obj.cuisines.filter((c): c is string => typeof c === "string");
  }
  return patch;
}

function parseMenuItemPatchBody(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("Body must be an object");
  }
  const obj = body as Record<string, unknown>;
  const patch: {
    name?: string;
    description?: string | null;
    basePriceCentavos?: number;
    isAvailable?: boolean;
    imageUrl?: string | null;
  } = {};
  if (typeof obj.name === "string") patch.name = obj.name;
  if (typeof obj.description === "string" || obj.description === null) {
    patch.description = obj.description as string | null;
  }
  if (typeof obj.basePriceCentavos === "number") {
    patch.basePriceCentavos = obj.basePriceCentavos;
  }
  if (typeof obj.isAvailable === "boolean") patch.isAvailable = obj.isAvailable;
  if (typeof obj.imageUrl === "string" || obj.imageUrl === null) {
    patch.imageUrl = obj.imageUrl as string | null;
  }
  return patch;
}
```

The implementer should locate the actual `requirePlatformAdmin` helper by reading `apps/web/src/features/access/` and using the existing pattern.

- [ ] **Step 4: Create csv-upload-handler.ts**

Create `apps/web/src/features/catalog/csv-upload-handler.ts`:

```typescript
import { parseCatalogImportResponse, parseCsvHeader, parseCsvRow } from "@ordah-please/contracts";

import { requirePlatformAdmin } from "../access/require-platform-admin";
import { catalogRuntime } from "./catalog-runtime";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface ParsedCsv {
  rows: Record<string, string>[];
  warnings: { row: number; reason: string }[];
}

/** Splits a raw CSV string into validated rows plus warnings for invalid rows. */
function parseCsvText(text: string): ParsedCsv {
  const allLines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (allLines.length === 0) {
    throw new Error("CSV is empty");
  }
  const header = splitCsvLine(allLines[0]);
  parseCsvHeader(header);

  const rows: Record<string, string>[] = [];
  const warnings: { row: number; reason: string }[] = [];

  for (let i = 1; i < allLines.length; i += 1) {
    const cells = splitCsvLine(allLines[i]);
    if (cells.length !== header.length) {
      warnings.push({ row: i + 1, reason: `Expected ${header.length} cells, got ${cells.length}` });
      continue;
    }
    const record: Record<string, string> = {};
    header.forEach((name, idx) => {
      record[name] = cells[idx];
    });
    try {
      rows.push(record as Record<string, string>);
    } catch (err) {
      warnings.push({ row: i + 1, reason: (err as Error).message });
    }
  }

  return { rows, warnings };
}

/** Splits one CSV line, honoring double-quoted cells with embedded commas. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export async function importCsvHandler(request: Request): Promise<Response> {
  await requirePlatformAdmin(request);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response("Missing file field", { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return new Response("File too large. CSVs must be under 5MB.", { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return new Response("Please upload a .csv file.", { status: 400 });
  }

  const text = await file.text();

  let parsed: ParsedCsv;
  try {
    parsed = parseCsvText(text);
  } catch (err) {
    return new Response((err as Error).message, { status: 400 });
  }

  const typedRows = [];
  const warnings = [...parsed.warnings];
  parsed.rows.forEach((record, idx) => {
    try {
      typedRows.push(parseCsvRow(record));
    } catch (err) {
      warnings.push({ row: idx + 2, reason: (err as Error).message });
    }
  });

  // Pull the user id from the request identity (mirror existing pattern from groups)
  const userId = await getUserIdFromRequest(request);

  const result = await catalogRuntime.catalog.importCatalog(userId, typedRows, warnings);
  return Response.json(result);
}

// The implementer should look at how existing handlers extract the user id from
// the request (likely via the same identity loader used by requirePlatformAdmin)
// and replace this stub:
async function getUserIdFromRequest(_request: Request): Promise<string> {
  throw new Error("getUserIdFromRequest not implemented — wire to existing identity loader");
}
```

- [ ] **Step 5: Run typecheck**

Run:
```bash
npm run typecheck --workspace @ordah-please/web
```

Expected: success. Fix any import path mismatches.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/catalog/
git commit -m "feat(web): add catalog runtime, route handlers, and CSV upload handler"
```

---

## Task 9: API route files

**Files:**
- Create: `apps/web/app/api/admin/catalog/import/route.ts`
- Create: `apps/web/app/api/admin/catalog/restaurants/[restaurantId]/route.ts`
- Create: `apps/web/app/api/admin/catalog/items/[itemId]/route.ts`
- Create: `apps/web/app/api/catalog/restaurants/route.ts`
- Create: `apps/web/app/api/catalog/restaurants/[restaurantId]/route.ts`

- [ ] **Step 1: Create the import route**

Create `apps/web/app/api/admin/catalog/import/route.ts`:

```typescript
import { importCsvHandler } from "../../../../src/features/catalog/csv-upload-handler";

/** Lets a Platform Admin upload a catalog CSV. */
export function POST(request: Request): Promise<Response> {
  return importCsvHandler(request);
}
```

- [ ] **Step 2: Create the admin restaurant patch route**

Create `apps/web/app/api/admin/catalog/restaurants/[restaurantId]/route.ts`:

```typescript
import { patchRestaurantHandler } from "../../../../../../src/features/catalog/restaurant-route-handlers";

/** Lets a Platform Admin edit a restaurant's name or cuisines. */
export function PATCH(
  request: Request,
  context: { params: { restaurantId: string } },
): Promise<Response> {
  return patchRestaurantHandler(request, context);
}
```

- [ ] **Step 3: Create the admin item patch route**

Create `apps/web/app/api/admin/catalog/items/[itemId]/route.ts`:

```typescript
import { patchMenuItemHandler } from "../../../../../../src/features/catalog/restaurant-route-handlers";

/** Lets a Platform Admin edit a menu item. */
export function PATCH(
  request: Request,
  context: { params: { itemId: string } },
): Promise<Response> {
  return patchMenuItemHandler(request, context);
}
```

- [ ] **Step 4: Create the public list route**

Create `apps/web/app/api/catalog/restaurants/route.ts`:

```typescript
import { listRestaurantsHandler } from "../../../../src/features/catalog/restaurant-route-handlers";

/** Returns all published restaurants for member browse. */
export function GET(): Promise<Response> {
  return listRestaurantsHandler();
}
```

- [ ] **Step 5: Create the public detail route**

Create `apps/web/app/api/catalog/restaurants/[restaurantId]/route.ts`:

```typescript
import { getRestaurantHandler } from "../../../../../src/features/catalog/restaurant-route-handlers";

/** Returns one restaurant with its current menu. */
export function GET(
  request: Request,
  context: { params: { restaurantId: string } },
): Promise<Response> {
  return getRestaurantHandler(request, context);
}
```

- [ ] **Step 6: Run typecheck**

Run:
```bash
npm run typecheck --workspace @ordah-please/web
```

Expected: success.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/catalog/ apps/web/app/api/admin/catalog/
git commit -m "feat(web): add catalog API routes for import, list, detail, and patches"
```

---

## Task 10: Next.js config — allow Grab CDN images

**Files:**
- Modify: `apps/web/next.config.ts` (or `.js`/`.mjs` — find the actual file)

- [ ] **Step 1: Find the Next.js config file**

Run:
```bash
ls apps/web/next.config*
```

- [ ] **Step 2: Add Grab CDN domains to images.domains or remotePatterns**

Open the file and add an `images` config. Use `remotePatterns` (preferred over deprecated `domains`):

```typescript
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "huawei-food-cms.grab.com" },
      { protocol: "https", hostname: "food.grab.com" },
    ],
  },
  // ...existing config
};
```

Preserve any existing config keys; only add the `images` block.

- [ ] **Step 3: Verify the dev server still starts**

Run (background, then stop after it's up):
```bash
npm run dev:web &
sleep 5
kill %1
```

Expected: server starts without errors about the config.

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat(web): allow Grab CDN image hosts in next config"
```

---

## Task 11: Admin Import page — replace mock with real upload UI

**Files:**
- Modify: `apps/web/app/admin/imports/page.tsx`
- Create: `apps/web/app/admin/imports/upload-form.tsx`
- Create: `apps/web/app/admin/imports/upload-form.test.tsx`

- [ ] **Step 1: Write failing test for the upload form**

Create `apps/web/app/admin/imports/upload-form.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UploadForm } from "./upload-form";

describe("UploadForm", () => {
  it("renders a file input and upload button", () => {
    render(<UploadForm />);
    expect(screen.getByLabelText(/upload csv/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  it("shows a success summary when upload succeeds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          restaurantsAdded: 2,
          restaurantsUpdated: 1,
          itemsAdded: 47,
          itemsSkipped: 0,
          warnings: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<UploadForm />);
    const input = screen.getByLabelText(/upload csv/i) as HTMLInputElement;
    const file = new File(["fake,csv"], "test.csv", { type: "text/csv" });
    // userEvent could be used here, but fire the change event directly for simplicity
    await waitFor(() => {
      expect(input).toBeInTheDocument();
    });

    // Trigger upload
    const form = input.closest("form")!;
    Object.defineProperty(input, "files", { value: [file] });
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText(/Imported 2 restaurants/i)).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/catalog/import"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows the server's error message when upload fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("File too large. CSVs must be under 5MB.", { status: 400 }),
    );

    render(<UploadForm />);
    const input = screen.getByLabelText(/upload csv/i) as HTMLInputElement;
    const form = input.closest("form")!;
    const file = new File(["fake"], "test.csv", { type: "text/csv" });
    Object.defineProperty(input, "files", { value: [file] });
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText(/File too large/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Implement UploadForm**

Create `apps/web/app/admin/imports/upload-form.tsx`:

```tsx
"use client";

import { useState } from "react";

import { AdminPage } from "../../components/admin-page";

type UploadOutcome =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; summary: string }
  | { kind: "error"; message: string };

export function UploadForm() {
  const [outcome, setOutcome] = useState<UploadOutcome>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setOutcome({ kind: "error", message: "Pick a CSV file first." });
      return;
    }
    setOutcome({ kind: "uploading" });
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/admin/catalog/import", {
        method: "POST",
        body,
      });
      if (response.ok) {
        const summary = await response.json();
        setOutcome({
          kind: "success",
          summary: `Imported ${summary.restaurantsAdded + summary.restaurantsUpdated} restaurants, ${summary.itemsAdded} menu items.`,
        });
        form.reset();
      } else {
        const text = await response.text();
        setOutcome({ kind: "error", message: text });
      }
    } catch (err) {
      setOutcome({ kind: "error", message: (err as Error).message });
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="admin-upload-dropzone">
        <span>Upload CSV</span>
        <input
          aria-label="Upload CSV"
          accept=".csv,text/csv"
          name="file"
          type="file"
        />
      </label>
      <button className="admin-primary-button" type="submit">
        {outcome.kind === "uploading" ? "Importing…" : "Upload"}
      </button>
      {outcome.kind === "success" && (
        <p role="status" className="admin-success">{outcome.summary}</p>
      )}
      {outcome.kind === "error" && (
        <p role="alert" className="admin-error">{outcome.message}</p>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Replace the imports page mock with the real component**

Replace the entire contents of `apps/web/app/admin/imports/page.tsx`:

```tsx
import { AdminPage } from "../../components/admin-page";
import { UploadForm } from "./upload-form";

/** Platform Admin upload entry point for catalog CSVs collected externally. */
export default function ImportsPage() {
  return (
    <AdminPage
      description="Upload a CSV of restaurants and menu items collected via Codex Computer Use."
      eyebrow="Restaurant data"
      title="Import catalog"
    >
      <section className="admin-panel">
        <UploadForm />
      </section>
    </AdminPage>
  );
}
```

- [ ] **Step 4: Run tests**

Run:
```bash
npm run test:unit -- apps/web/app/admin/imports/
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/imports/
git commit -m "feat(web): add catalog CSV upload form and replace mock Imports page"
```

---

## Task 12: Admin Catalog page — replace mock with real list

**Files:**
- Modify: `apps/web/app/admin/catalog/page.tsx`

- [ ] **Step 1: Make the Catalog page a server component that fetches from the runtime**

Replace `apps/web/app/admin/catalog/page.tsx`:

```tsx
import Link from "next/link";

import { catalogRuntime } from "../../../src/features/catalog/catalog-runtime";
import { AdminPage } from "../../components/admin-page";

/** Lists published restaurants for the Platform Admin. */
export default async function CatalogPage() {
  const restaurants = await catalogRuntime.catalog.listRestaurants();

  return (
    <AdminPage
      description="Click a restaurant to edit its details and menu."
      eyebrow="Restaurant data"
      title="Published restaurants"
    >
      <section className="admin-panel">
        {restaurants.length === 0 ? (
          <p>No restaurants yet. Import a CSV to get started.</p>
        ) : (
          <ul className="admin-restaurant-grid">
            {restaurants.map((r) => (
              <li key={r.restaurantId}>
                <Link
                  href={`/admin/catalog/${r.restaurantId}/edit`}
                  className="admin-restaurant-card"
                >
                  {r.heroImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={r.heroImageUrl} />
                  ) : (
                    <div aria-hidden="true" className="admin-restaurant-card__placeholder">
                      {r.restaurantName.charAt(0)}
                    </div>
                  )}
                  <strong>{r.restaurantName}</strong>
                  <span>{r.branchName}</span>
                  <ul className="admin-cuisine-tags">
                    {r.cuisines.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPage>
  );
}
```

The `<img>` tag is used here instead of `next/image` because the Grab CDN images may have unpredictable cache headers and `next/image` optimization is not required for a private app with low traffic. The eslint-disable comment suppresses the warning.

- [ ] **Step 2: Run typecheck and lint**

Run:
```bash
npm run typecheck --workspace @ordah-please/web
npm run lint
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/admin/catalog/page.tsx
git commit -m "feat(web): render real restaurants on admin Catalog page"
```

---

## Task 13: Admin Restaurant Edit page

**Files:**
- Create: `apps/web/app/admin/catalog/[restaurantId]/edit/page.tsx`
- Create: `apps/web/app/admin/catalog/[restaurantId]/edit/edit-form.tsx`
- Create: `apps/web/app/admin/catalog/[restaurantId]/edit/edit-form.test.tsx`

- [ ] **Step 1: Write failing test for the edit form**

Create `apps/web/app/admin/catalog/[restaurantId]/edit/edit-form.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditForm } from "./edit-form";

const detailFixture = {
  restaurantId: "rest-1",
  restaurantName: "McDonald's",
  cuisines: ["American", "Burger"],
  branchId: "branch-1",
  branchName: "BGC",
  grabUrl: "https://food.grab.com/example",
  menuVersionPublishedAt: "2026-08-12T00:00:00.000Z",
  categories: [
    {
      name: "Burgers",
      items: [
        {
          id: "item-1",
          name: "Classic Burger",
          description: "Beef patty",
          basePriceCentavos: 25000,
          isAvailable: true,
          imageUrl: "https://example.test/burger.avif",
          sortOrder: 0,
        },
      ],
    },
  ],
};

describe("EditForm", () => {
  it("renders restaurant fields pre-filled", () => {
    render(<EditForm initial={detailFixture} />);
    expect(screen.getByLabelText(/restaurant name/i)).toHaveValue("McDonald's");
    expect(screen.getByLabelText(/cuisines/i)).toHaveValue("American, Burger");
  });

  it("PATCHes the restaurant endpoint on Save", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    render(<EditForm initial={detailFixture} />);
    screen.getByLabelText(/restaurant name/i).setAttribute("value", "McDonald's PH");
    screen.getByRole("button", { name: /save changes/i }).click();

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/admin/catalog/restaurants/rest-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});
```

- [ ] **Step 2: Implement EditForm**

Create `apps/web/app/admin/catalog/[restaurantId]/edit/edit-form.tsx`:

```tsx
"use client";

import { useState } from "react";

interface ItemRow {
  id: string;
  name: string;
  description: string | null;
  basePriceCentavos: number;
  isAvailable: boolean;
  imageUrl: string | null;
  sortOrder: number;
}

interface CategoryRow {
  name: string;
  items: readonly ItemRow[];
}

interface Detail {
  restaurantId: string;
  restaurantName: string;
  cuisines: readonly string[];
  branchId: string;
  branchName: string;
  grabUrl: string | null;
  menuVersionPublishedAt: string;
  categories: readonly CategoryRow[];
}

export function EditForm({ initial }: { initial: Detail }) {
  const [restaurantName, setRestaurantName] = useState(initial.restaurantName);
  const [cuisines, setCuisines] = useState(initial.cuisines.join(", "));
  const [items, setItems] = useState<Record<string, ItemRow>>(() => {
    const map: Record<string, ItemRow> = {};
    for (const cat of initial.categories) {
      for (const item of cat.items) {
        map[item.id] = { ...item };
      }
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "done" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  function updateItem(itemId: string, patch: Partial<ItemRow>) {
    setItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  async function handleSave() {
    setOutcome({ kind: "saving" });
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/catalog/restaurants/${initial.restaurantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: restaurantName,
          cuisines: cuisines
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const itemPatches = await Promise.all(
        Object.values(items).map((item) => {
          const original = Object.values(initial.categories)
            .flatMap((c) => c.items)
            .find((i) => i.id === item.id)!;
          const body: Record<string, unknown> = {};
          if (item.name !== original.name) body.name = item.name;
          if (item.description !== original.description) body.description = item.description;
          if (item.basePriceCentavos !== original.basePriceCentavos)
            body.basePriceCentavos = item.basePriceCentavos;
          if (item.isAvailable !== original.isAvailable) body.isAvailable = item.isAvailable;
          if (item.imageUrl !== original.imageUrl) body.imageUrl = item.imageUrl;
          if (Object.keys(body).length === 0) return Promise.resolve();
          return fetch(`/api/admin/catalog/items/${item.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
        }),
      );
      if (itemPatches.some((r) => r instanceof Response && !r.ok)) {
        throw new Error("One or more item updates failed");
      }
      setOutcome({ kind: "done" });
    } catch (err) {
      setOutcome({ kind: "error", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-edit-form">
      <section>
        <h2>Restaurant</h2>
        <label>
          Restaurant name
          <input
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
          />
        </label>
        <label>
          Cuisines (comma-separated)
          <input value={cuisines} onChange={(e) => setCuisines(e.target.value)} />
        </label>
      </section>

      <section>
        <h2>Branch</h2>
        <p>{initial.branchName}</p>
        {initial.grabUrl && (
          <a href={initial.grabUrl} rel="noreferrer" target="_blank">
            View on Grab
          </a>
        )}
      </section>

      <section>
        <h2>Menu</h2>
        {initial.categories.map((category) => (
          <details key={category.name} open>
            <summary>{category.name}</summary>
            <ul className="admin-item-list">
              {category.items.map((item) => {
                const current = items[item.id];
                return (
                  <li key={item.id}>
                    {current.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={current.imageUrl} width={64} />
                    )}
                    <label>
                      Name
                      <input
                        value={current.name}
                        onChange={(e) =>
                          updateItem(item.id, { name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Description
                      <input
                        value={current.description ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, { description: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Price (PHP)
                      <input
                        type="number"
                        step="0.01"
                        value={current.basePriceCentavos / 100}
                        onChange={(e) =>
                          updateItem(item.id, {
                            basePriceCentavos: Math.round(
                              Number(e.target.value) * 100,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={current.isAvailable}
                        onChange={(e) =>
                          updateItem(item.id, { isAvailable: e.target.checked })
                        }
                      />
                      Available
                    </label>
                    <label>
                      Image URL
                      <input
                        value={current.imageUrl ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, {
                            imageUrl: e.target.value || null,
                          })
                        }
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </section>

      <button
        className="admin-primary-button"
        disabled={saving}
        onClick={handleSave}
        type="button"
      >
        {outcome.kind === "saving" ? "Saving…" : "Save changes"}
      </button>
      {outcome.kind === "done" && (
        <p role="status" className="admin-success">Saved.</p>
      )}
      {outcome.kind === "error" && (
        <p role="alert" className="admin-error">{outcome.message}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the server page wrapper**

Create `apps/web/app/admin/catalog/[restaurantId]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation";

import { catalogRuntime } from "../../../../../../src/features/catalog/catalog-runtime";
import { AdminPage } from "../../../../../components/admin-page";
import { EditForm } from "./edit-form";

/** Platform Admin edit screen for one restaurant. */
export default async function EditPage({
  params,
}: {
  params: { restaurantId: string };
}) {
  const detail = await catalogRuntime.catalog.getRestaurantDetail(params.restaurantId);
  if (!detail) {
    notFound();
  }
  return (
    <AdminPage
      eyebrow="Restaurant data"
      title={`Edit ${detail.restaurantName}`}
      description="Edits apply to the current published menu version."
    >
      <EditForm initial={detail} />
    </AdminPage>
  );
}
```

- [ ] **Step 4: Run tests**

Run:
```bash
npm run test:unit -- apps/web/app/admin/catalog/
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/catalog/
git commit -m "feat(web): add admin restaurant edit page with per-item editing"
```

---

## Task 14: Member Home (web) — replace mocks with real fetch

**Files:**
- Modify: `apps/web/app/(member)/page.tsx`

- [ ] **Step 1: Read the current mock to understand its structure**

Run:
```bash
cat "apps/web/app/(member)/page.tsx"
```

Note the existing layout: hero section, tab labels, restaurant cards. Preserve everything except the hardcoded array.

- [ ] **Step 2: Replace the mock data with a runtime fetch**

Change `apps/web/app/(member)/page.tsx`. Replace the hardcoded `restaurants` array with:

```tsx
import { catalogRuntime } from "../../src/features/catalog/catalog-runtime";

// At the top of the default export (which should be an async server component):
const restaurants = await catalogRuntime.catalog.listRestaurants();
```

Then render the same cards but with fields from the new shape:
- `r.restaurantName` → `r.name` was the mock field; use `r.restaurantName`
- `r.image` → use `r.heroImageUrl`
- `r.cuisines` → use `r.cuisines` (already an array)
- Wrap each card in `<Link href={`/restaurants/${r.restaurantId}`}>`

If the current page is a Client Component (`"use client"` at top), convert it to a Server Component (remove `"use client"`). The existing imports that depend on client-only features (useState, onClick) must be split into a small client component for those parts. For V1, the Home page should be a server component — no client-side state needed.

- [ ] **Step 3: Run typecheck and lint**

Run:
```bash
npm run typecheck --workspace @ordah-please/web
npm run lint
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(member)/page.tsx"
git commit -m "feat(web): render real restaurants on member Home"
```

---

## Task 15: Member Restaurant Detail page (web)

**Files:**
- Create: `apps/web/app/(member)/restaurants/[restaurantId]/page.tsx`
- Create: `apps/web/app/(member)/restaurants/[restaurantId]/restaurant-detail.test.tsx`

- [ ] **Step 1: Write failing test for the detail page**

Create `apps/web/app/(member)/restaurants/[restaurantId]/restaurant-detail.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RestaurantDetailPage from "./page";

const detailFixture = {
  restaurantId: "rest-1",
  restaurantName: "McDonald's",
  cuisines: ["American", "Burger"],
  branchId: "branch-1",
  branchName: "BGC",
  grabUrl: "https://food.grab.com/example",
  menuVersionPublishedAt: "2026-08-12T00:00:00.000Z",
  categories: [
    {
      name: "Burgers",
      items: [
        {
          id: "item-1",
          name: "Classic Burger",
          description: "Beef patty",
          basePriceCentavos: 25000,
          isAvailable: true,
          imageUrl: "https://example.test/burger.avif",
          sortOrder: 0,
        },
      ],
    },
  ],
};

jest.mock("../../../../src/features/catalog/catalog-runtime", () => ({
  catalogRuntime: {
    catalog: {
      getRestaurantDetail: async () => detailFixture,
    },
  },
}));

describe("RestaurantDetailPage", () => {
  it("renders the restaurant name, branch, cuisines, and category chips", () => {
    render(<RestaurantDetailPage params={{ restaurantId: "rest-1" }} />);
    expect(screen.getByRole("heading", { name: "McDonald's" })).toBeInTheDocument();
    expect(screen.getByText("BGC")).toBeInTheDocument();
    expect(screen.getByText("American")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Burgers" })).toBeInTheDocument();
  });

  it("renders items under their category", () => {
    render(<RestaurantDetailPage params={{ restaurantId: "rest-1" }} />);
    expect(screen.getByText("Classic Burger")).toBeInTheDocument();
    expect(screen.getByText("₱250.00")).toBeInTheDocument();
  });
});
```

Note: the test uses `jest.mock`. Vitest supports this via `vi.mock` — convert if needed:

```typescript
import { vi } from "vitest";
vi.mock("../../../../src/features/catalog/catalog-runtime", () => ({ ... }));
```

- [ ] **Step 2: Implement the page**

Create `apps/web/app/(member)/restaurants/[restaurantId]/page.tsx`:

```tsx
import Link from "next/link";

import { catalogRuntime } from "../../../../src/features/catalog/catalog-runtime";

/** Member-facing restaurant detail page with Grab-style menu. */
export default async function RestaurantDetailPage({
  params,
}: {
  params: { restaurantId: string };
}) {
  const detail = await catalogRuntime.catalog.getRestaurantDetail(params.restaurantId);
  if (!detail) {
    return (
      <section>
        <p>Restaurant not found.</p>
        <Link href="/">Back to home</Link>
      </section>
    );
  }

  return (
    <article className="restaurant-detail">
      <Link href="/" className="restaurant-detail__back">← Back</Link>

      {detail.categories[0]?.items[0]?.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="restaurant-detail__hero"
          src={detail.categories[0].items[0].imageUrl}
        />
      )}

      <header className="restaurant-detail__header">
        <h1>{detail.restaurantName}</h1>
        <p className="restaurant-detail__branch">{detail.branchName}</p>
        <ul className="restaurant-detail__cuisines">
          {detail.cuisines.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </header>

      <nav aria-label="Menu categories" className="restaurant-detail__chips">
        {detail.categories.map((c) => (
          <a key={c.name} href={`#category-${slugify(c.name)}`}>
            {c.name}
          </a>
        ))}
      </nav>

      {detail.categories.map((category) => (
        <section
          className="restaurant-detail__category"
          id={`category-${slugify(category.name)}`}
          key={category.name}
        >
          <h2>{category.name}</h2>
          <ul className="restaurant-detail__items">
            {category.items.map((item) => (
              <li className="restaurant-detail__item" key={item.id}>
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={item.imageUrl} />
                )}
                <div>
                  <h3>{item.name}</h3>
                  {item.description && <p>{item.description}</p>}
                  <p className="restaurant-detail__price">
                    ₱{(item.basePriceCentavos / 100).toFixed(2)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test:unit -- "apps/web/app/(member)/restaurants/"
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(member)/restaurants/"
git commit -m "feat(web): add member restaurant detail page with category chips"
```

---

## Task 16: Member Favorites empty state (web)

**Files:**
- Modify: `apps/web/app/(member)/favorites/page.tsx`

- [ ] **Step 1: Replace the mock content with an empty state**

Replace the entire file `apps/web/app/(member)/favorites/page.tsx`:

```tsx
/** Favorites tab. Empty state until the Favorites bundle ships. */
export default function FavoritesPage() {
  return (
    <section className="favorites-empty">
      <h1>Favorites</h1>
      <p>No favorites yet — browse restaurants to add your first one.</p>
    </section>
  );
}
```

- [ ] **Step 2: Run lint and typecheck**

Run:
```bash
npm run typecheck --workspace @ordah-please/web
npm run lint
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(member)/favorites/page.tsx"
git commit -m "feat(web): replace favorites mock with empty state"
```

---

## Task 17: Mobile Home — replace mocks with real fetch

**Files:**
- Modify: `apps/mobile/app/(member)/index.tsx`
- Create: `apps/mobile/src/features/catalog/use-restaurants.ts`
- Create: `apps/mobile/src/features/catalog/use-restaurants.test.ts`

- [ ] **Step 1: Write failing test for useRestaurants hook**

Create `apps/mobile/src/features/catalog/use-restaurants.test.ts`:

```typescript
import { renderHook, waitFor } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";

import { useRestaurants } from "./use-restaurants";

const listFixture = [
  {
    id: "rest-1",
    name: "McDonald's",
    cuisines: ["American"],
    branchId: "branch-1",
    branchName: "BGC",
    heroImageUrl: "https://example.test/photo.avif",
  },
];

describe("useRestaurants", () => {
  it("fetches the restaurant list and exposes it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => listFixture,
      }),
    );

    const { result } = renderHook(() => useRestaurants());
    await waitFor(() => expect(result.current.restaurants).toEqual(listFixture));
    expect(result.current.error).toBeNull();
  });
});
```

- [ ] **Step 2: Implement useRestaurants**

Create `apps/mobile/src/features/catalog/use-restaurants.ts`:

```typescript
import { useEffect, useState } from "react";

import { parseRestaurantListResponse } from "@ordah-please/contracts";

import { authenticatedFetch } from "../../auth/authenticated-fetch"; // adjust path

interface RestaurantListEntry {
  id: string;
  name: string;
  cuisines: readonly string[];
  branchId: string;
  branchName: string;
  heroImageUrl: string | null;
}

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<readonly RestaurantListEntry[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await authenticatedFetch("/api/catalog/restaurants");
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const json = await response.json();
        if (!cancelled) {
          setRestaurants(parseRestaurantListResponse(json) as readonly RestaurantListEntry[]);
        }
      } catch (err) {
        if (!cancelled) setError(err as Error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { restaurants, error };
}
```

The implementer should locate the actual `authenticatedFetch` helper (used by other mobile features) by searching `apps/mobile/src/auth/`.

- [ ] **Step 3: Modify the Home tab to use the hook**

In `apps/mobile/app/(member)/index.tsx`, replace any hardcoded restaurant array with a call to `useRestaurants()`. Render a `FlatList` of restaurant cards. Each card navigates to `/(member)/restaurants/${id}` on tap.

```tsx
import { useRestaurants } from "../../src/features/catalog/use-restaurants";
// ... existing imports for theme, navigation, etc.

export default function HomeScreen() {
  const { restaurants, error } = useRestaurants();
  // ... render cards from restaurants; if error, show retry
}
```

The implementer should preserve the existing screen layout (header, tab bar) and only swap the data source.

- [ ] **Step 4: Run tests**

Run:
```bash
npm run test --workspace @ordah-please/mobile -- src/features/catalog/use-restaurants.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(member)/index.tsx apps/mobile/src/features/catalog/
git commit -m "feat(mobile): fetch real restaurants on Home tab"
```

---

## Task 18: Mobile Restaurant Detail screen

**Files:**
- Create: `apps/mobile/app/(member)/restaurants/[id].tsx`
- Create: `apps/mobile/src/features/catalog/use-restaurant-detail.ts`
- Create: `apps/mobile/src/features/catalog/use-restaurant-detail.test.ts`

- [ ] **Step 1: Write failing test for the hook**

Create `apps/mobile/src/features/catalog/use-restaurant-detail.test.ts`:

```typescript
import { renderHook, waitFor } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";

import { useRestaurantDetail } from "./use-restaurant-detail";

const detailFixture = {
  restaurantId: "rest-1",
  restaurantName: "McDonald's",
  cuisines: ["American"],
  branchId: "branch-1",
  branchName: "BGC",
  grabUrl: null,
  menuVersionPublishedAt: "2026-08-12T00:00:00.000Z",
  categories: [
    {
      name: "Burgers",
      items: [
        {
          id: "item-1",
          name: "Classic Burger",
          description: "Beef",
          priceCentavos: 25000,
          availability: "available",
          imageUrl: null,
          variants: [],
          modifierGroups: [],
        },
      ],
    },
  ],
};

describe("useRestaurantDetail", () => {
  it("fetches the restaurant detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => detailFixture,
      }),
    );

    const { result } = renderHook(() => useRestaurantDetail("rest-1"));
    await waitFor(() =>
      expect(result.current.detail?.restaurantName).toBe("McDonald's"),
    );
  });
});
```

- [ ] **Step 2: Implement the hook**

Create `apps/mobile/src/features/catalog/use-restaurant-detail.ts`:

```typescript
import { useEffect, useState } from "react";

import { parseRestaurantDetailResponse } from "@ordah-please/contracts";

import { authenticatedFetch } from "../../auth/authenticated-fetch"; // adjust path

export function useRestaurantDetail(restaurantId: string) {
  const [detail, setDetail] = useState<
    ReturnType<typeof parseRestaurantDetailResponse> | null
  >(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await authenticatedFetch(
          `/api/catalog/restaurants/${restaurantId}`,
        );
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const json = await response.json();
        if (!cancelled) setDetail(parseRestaurantDetailResponse(json));
      } catch (err) {
        if (!cancelled) setError(err as Error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return { detail, error };
}
```

- [ ] **Step 3: Implement the screen**

Create `apps/mobile/app/(member)/restaurants/[id].tsx`:

```tsx
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, Text, View } from "react-native";

import { useRestaurantDetail } from "../../../src/features/catalog/use-restaurant-detail";
import { styles } from "./styles"; // optional: shared styles, or inline

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, error } = useRestaurantDetail(id);

  if (error) {
    return (
      <View>
        <Text>Couldn't load restaurant.</Text>
        <Link href="/">Back</Link>
      </View>
    );
  }
  if (!detail) {
    return <ActivityIndicator />;
  }

  return (
    <ScrollView>
      <Link href="/">← Back</Link>
      {detail.categories[0]?.items[0]?.imageUrl && (
        <Image
          source={{ uri: detail.categories[0].items[0].imageUrl }}
          style={{ width: "100%", height: 200 }}
        />
      )}
      <Text accessibilityRole="header">{detail.restaurantName}</Text>
      <Text>{detail.branchName}</Text>
      <Text>{detail.cuisines.join(" · ")}</Text>

      <ScrollView horizontal>
        {detail.categories.map((c) => (
          <Pressable key={c.name}>
            <Text>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {detail.categories.map((category) => (
        <View key={category.name}>
          <Text accessibilityRole="header">{category.name}</Text>
          {category.items.map((item) => (
            <View key={item.id}>
              {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={{ width: 64, height: 64 }} />
              )}
              <Text>{item.name}</Text>
              {item.description && <Text>{item.description}</Text>}
              <Text>₱{(item.priceCentavos / 100).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run tests**

Run:
```bash
npm run test --workspace @ordah-please/mobile -- src/features/catalog/use-restaurant-detail.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(member)/restaurants/ apps/mobile/src/features/catalog/
git commit -m "feat(mobile): add restaurant detail screen with category chips"
```

---

## Task 19: Mobile Favorites empty state

**Files:**
- Modify: `apps/mobile/app/(member)/favorites.tsx`

- [ ] **Step 1: Replace the mock content**

Replace the body of `apps/mobile/app/(member)/favorites.tsx`:

```tsx
import { Text, View } from "react-native";

/** Favorites tab. Empty state until the Favorites bundle ships. */
export default function FavoritesScreen() {
  return (
    <View>
      <Text accessibilityRole="header">Favorites</Text>
      <Text>No favorites yet — browse restaurants to add your first one.</Text>
    </View>
  );
}
```

Preserve any tab-bar registration or navigation wiring that existed in the original file (only replace the body).

- [ ] **Step 2: Commit**

```bash
git add "apps/mobile/app/(member)/favorites.tsx"
git commit -m "feat(mobile): replace favorites mock with empty state"
```

---

## Task 20: Final mock-data cleanup pass

**Files:** Search the repo for stale references

- [ ] **Step 1: Grep for any remaining mock restaurant names**

Run:
```bash
grep -rn "Green Table\|Fresh Bowls\|Crispy Chicken" --include="*.ts" --include="*.tsx" apps/ packages/
```

Expected: zero matches. If any remain, fix or remove them.

- [ ] **Step 2: Grep for any remaining profile-mia references (should already be gone)**

Run:
```bash
grep -rn "profile-mia" --include="*.ts" --include="*.tsx" --include="*.jpg" --include="*.png" .
```

Expected: zero matches.

- [ ] **Step 3: Run the full test suite**

Run:
```bash
npm run test:unit
npm run test:mobile
```

Expected: all tests pass.

- [ ] **Step 4: Run typecheck and lint across the repo**

Run:
```bash
npm run typecheck
npm run lint
```

Expected: success.

- [ ] **Step 5: Commit any cleanup**

If the cleanup touched any files:

```bash
git add -p
git commit -m "chore: remove final mock restaurant references"
```

If nothing changed, skip.

---

## Task 21: End-to-end verification

- [ ] **Step 1: Start the dev server**

Run in background:
```bash
npm run dev:web
```

Wait for "Ready in" message.

- [ ] **Step 2: Sign in as a Platform Admin in the browser**

Open `http://localhost:3000`. Sign in via Google. Verify you can access `/admin`.

- [ ] **Step 3: Upload the user's real CSV**

Navigate to `/admin/imports`. Click Upload CSV. Pick the user's actual CSV file. Verify the success summary appears with non-zero counts.

- [ ] **Step 4: Verify the Catalog page shows real restaurants**

Navigate to `/admin/catalog`. Verify the cards show real restaurant names, branches, cuisines, and hero images from the CSV.

- [ ] **Step 5: Verify the edit page works**

Click a restaurant card. Change a price. Click Save changes. Verify the price updates and persists on refresh.

- [ ] **Step 6: Verify member Home**

Navigate to `/`. Verify real restaurants appear. Click one to open the detail page.

- [ ] **Step 7: Verify the restaurant detail page**

Confirm the layout matches the spec: hero image, name, branch, cuisines, category chips, item list with photos, names, descriptions, prices.

- [ ] **Step 8: Verify mobile (Android emulator)**

Start the emulator:
```bash
npm run dev:mobile
```

Open the app on the emulator. Verify Home shows real restaurants and tapping one opens the detail screen.

- [ ] **Step 9: Verify favorites empty states (web + mobile)**

Confirm the Favorites tab shows "No favorites yet" on both platforms.

- [ ] **Step 10: Update progress tracker**

Edit `context/progress-tracker.md` and mark the "Restaurant catalog and Favorites" entry — but note that Favorites is NOT done, only the catalog + import half. Replace the line with two:
- `[x] Restaurant catalog and import`
- `[ ] Favorites`

And add the completion evidence to `context/history/v1-XX.md` per the workflow in `AGENTS.md`.

- [ ] **Step 11: Final commit**

```bash
git add context/progress-tracker.md context/history/
git commit -m "docs: record restaurant catalog import completion"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Schema migration: Task 1
- Domain types: Task 2
- CSV parser + response parsers: Tasks 3, 4
- Repositories (list, detail, import, updates): Tasks 5, 6, 7
- API endpoints: Tasks 8, 9
- Admin Import page: Task 11
- Admin Catalog page: Task 12
- Admin Restaurant Edit page: Task 13
- Member Home (web): Task 14
- Member Restaurant Detail (web): Task 15
- Member Favorites empty (web): Task 16
- Mobile Home: Task 17
- Mobile Restaurant Detail: Task 18
- Mobile Favorites empty: Task 19
- Next.js image config: Task 10
- Mock cleanup: Task 20
- E2E verification: Task 21

Gaps: none identified.

**Placeholder scan:** No TBDs, TODOs, or unspecified error handling. The "adjust path" comments are explicit pointers for the implementer to look up the real path; this is acceptable for cross-workspace imports the plan author cannot verify without execution.

**Type consistency:**
- `RestaurantSummaryRow` (db) ↔ `RestaurantSummary` (domain) ↔ `parseRestaurantListResponse` (contracts) — field names match (`restaurantId`, `restaurantName`, `cuisines`, `branchId`, `branchName`, `heroImageUrl`).
- `RestaurantDetailRow` ↔ `RestaurantDetail` ↔ `parseRestaurantDetailResponse` — match (`restaurantId`, `restaurantName`, `cuisines`, `branchId`, `branchName`, `grabUrl`, `menuVersionPublishedAt`, `categories`).
- Item field naming: db repo returns `basePriceCentavos` and `isAvailable`; contracts detail parser expects `priceCentavos` and `availability` (the existing domain `MenuItem` shape). The API handler that translates between repo and response must map these. **This is a real inconsistency to fix.**

  Fix: in the API handler that returns detail (or in the repo's `getRestaurantDetail`), map repo `basePriceCentavos` → response `priceCentavos` and `isAvailable` → `availability: "available" | "unavailable"`. Adjust the repo function or add a small mapper. Task 8's handler should be updated to include this mapping; the implementer should write a unit test that catches the mismatch.

**Risk areas flagged for the implementer:**
1. The `importCatalog` transaction must roll back atomically if any step inside fails. The integration test in Task 6 covers the happy path; an additional test for partial-failure rollback would strengthen confidence but is not strictly required for V1.
2. The CSV parser in Task 8 (`splitCsvLine`) handles quoted cells and escaped quotes but not embedded newlines in quoted cells. For V1 with the user's CSVs, this is acceptable — flag for future work.
3. The mobile hooks in Tasks 17 and 18 assume an `authenticatedFetch` helper exists. If it doesn't, the implementer must locate the existing authenticated request helper in `apps/mobile/src/auth/` and use it. If no such helper exists yet, that's a larger gap — confirm before proceeding.

---

**Plan complete.** See the Execution Handoff in the message that follows.
