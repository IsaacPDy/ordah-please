# Restaurant catalog import — design

**Date:** 2026-08-12
**Status:** Implemented and web-verified; Android emulator acceptance blocked by a reproduced Expo Router/Worklets native crash
**Scope:** One journey bundle — admin CSV import of restaurants + menus, replacing all current restaurant mock data on web and mobile.

## Goal

Let a Platform Admin upload a CSV of restaurants and menu items (collected externally via Codex Computer Use) so that real restaurant data appears throughout the app. Today every restaurant surface on web and mobile renders hardcoded mock data; this bundle replaces those mocks with real data flowing through the catalog schema, API, domain, and UI layers that already exist as scaffolding.

## User decisions captured during brainstorming

1. **Upload UX**: Simple upload, no preview/approve step. The CSV is parsed and inserted as soon as the admin uploads.
2. **Editing**: Admin can edit restaurant and menu item fields after import via a new admin Edit page.
3. **CSV format**: One row per menu item. Restaurant info (name, branch, source ID, URL, cuisines, restaurant-level min/max price) repeats per row. Header row required.
4. **Images**: Use Grab's CDN URLs directly from the CSV. No R2 copy.
5. **Re-import behavior**: Replace. CSV always wins. Existing restaurants with the same Grab source ID get their data overwritten.

## Scope

### In scope

- One schema migration adding two columns.
- CSV parser, import repository function, one upload API endpoint.
- Two read API endpoints (list, detail) and two edit API endpoints (restaurant, menu item).
- Four UI surfaces: admin Import page, admin Catalog page, admin Restaurant Edit page (new), member Restaurant Detail page (new). Plus replacement of mock data on member Home (web + mobile).
- Removal of all hardcoded restaurant mocks on web Home, web Favorites header strip, mobile Home, mobile Favorites, admin Catalog, and admin Import.
- Image rendering from Grab CDN URLs (Next.js image domain allowlist).

### Out of scope (future bundles)

- Add/remove menu items in the admin UI (re-upload CSV instead).
- Member item detail page and Favorites (separate bundle).
- Variants and modifiers (CSV has none; tables remain empty).
- Restaurant logos (CSV has none; we use a hero image fallback).
- Search-by-cuisine filters, pagination, sorting.
- Risk-based publishing and review workflow.
- R2 image mirroring.
- Promotion badges, ratings, delivery time/distance, opening hours (no data source).

## CSV format reference

Headers (row 1, required, exact match):

```
restaurant_name, branch_name, source_platform, source_restaurant_id, source_url,
cuisines, category_name, item_name, description, price_php, price_centavos,
restaurant_min_price_php, restaurant_max_price_php, currency, image_url,
is_available, collected_at
```

| Column                     | Type                   | Maps to                                  | Notes                                                         |
| -------------------------- | ---------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `restaurant_name`          | string                 | `restaurants.name`                       | Display name e.g. "McDonald's - Magsaysay / Naga Magsaysay"   |
| `branch_name`              | string                 | `branches.name`                          | E.g. "Magsaysay / Naga Magsaysay"                             |
| `source_platform`          | string                 | ignored                                  | Always "GrabFood" in V1                                       |
| `source_restaurant_id`     | string                 | `branches.sourceKey`                     | E.g. "2-C2LKHGNGCKKCJ2"; the dedupe key for replace semantics |
| `source_url`               | string                 | `branches.grabUrl`                       | Full Grab URL                                                 |
| `cuisines`                 | comma-separated string | `restaurants.cuisines` (text[])          | E.g. "American,Burger,Fried Chicken,Fast Food"                |
| `category_name`            | string                 | `menu_categories.name`                   | E.g. "New Offers"; dedupe per menu version                    |
| `item_name`                | string                 | `menu_items.name`                        |                                                               |
| `description`              | string                 | `menu_items.description`                 | Nullable; may equal item_name                                 |
| `price_php`                | decimal                | ignored (display only)                   | Derived from centavos for safety                              |
| `price_centavos`           | integer                | `menu_items.basePriceCentavos`           | Authoritative price; must be ≥ 0                              |
| `restaurant_min_price_php` | decimal                | ignored                                  | Derivable from items                                          |
| `restaurant_max_price_php` | decimal                | ignored                                  | Derivable from items                                          |
| `currency`                 | string                 | ignored                                  | Always PHP in V1                                              |
| `image_url`                | string                 | `menu_items.image_url`                   | Nullable; Grab CDN URL                                        |
| `is_available`             | "true"/"false"         | `menu_items.isAvailable`                 |                                                               |
| `collected_at`             | date (YYYY-MM-DD)      | `menu_versions.createdAt` (date portion) | Used as the menu version's effective date                     |

## Data flow on import

```
Admin picks CSV in browser
  ↓ multipart/form-data
POST /api/admin/catalog/import
  ↓ auth check (Platform Admin only)
  ↓ size + content-type check
  ↓ parse CSV in memory (papaparse or csv-parse)
  ↓ validate header row (exact match)
  ↓ parse each row through CSV row contract parser
  ↓ skip + collect invalid rows into a warnings list
  ↓ group valid rows by source_restaurant_id
For each restaurant group, in one DB transaction:
  1. upsert restaurants row (match by name; update cuisines)
  2. upsert branches row (match by (restaurant_id, sourceKey); update name + grabUrl)
  3. create new menu_versions row (status=published, source_import_id=<this import>)
  4. update prior published menu_versions for this branch → status=archived
  5. insert menu_categories (dedupe by name within version; assign sortOrder by first-seen)
  6. insert menu_items (one per row; sourceKey = item_name; assign sortOrder within category by row order)
  ↓ commit transaction
Return summary: { restaurantsAdded, restaurantsUpdated, itemsAdded, itemsSkipped, warnings[] }
```

**How restaurants and branches map to the CSV**: Each unique `source_restaurant_id` identifies one branch globally and is the authoritative re-import key. A later CSV with the same source ID updates that branch and its restaurant even when the imported name changed or an admin renamed it. A new source ID may reuse an exact-name restaurant; otherwise it creates a new restaurant. Because the CSV's `restaurant_name` already includes the branch identifier (e.g. "McDonald's - Magsaysay / Naga Magsaysay"), each restaurant row will normally have one branch in V1.

**Why a new menu_version per import, not in-place item updates**: The schema enforces "one published menu_version per branch" via partial unique index. Preserving prior versions gives free history and a recovery path if an import goes wrong. Items are keyed by `(category_id, source_key)` so the same `item_name` across imports identifies the conceptual same item, even though the row is recreated.

## Architecture changes by layer

### Database (three migrations)

- `0005_illegal_sally_floyd.sql`: adds `restaurants.cuisines` (`text[]`, default empty, not null) and nullable `menu_items.image_url`.
- `0006_steep_nekra.sql`: replaces restaurant-scoped branch source-key uniqueness with global `branches.source_key` uniqueness after a duplicate preflight.
- `0007_white_hitman.sql`: adds nullable `catalog_imports.source_file_name` so Recent imports can show the original upload name.

### Domain (`packages/domain/src/catalog/`)

Extend existing types:

- `CatalogRestaurant` += `cuisines: readonly string[]`
- `MenuItem` += `imageUrl: string | null`

New types:

- `RestaurantSummary` — `{ id, name, cuisines, branchId, branchName, heroImageUrl }` for list views
- `RestaurantDetail` — `{ restaurant, branch, menuVersion, categories: readonly { name, items: readonly MenuItem[] }[] }` for detail view
- `CatalogImportSummary` — `{ restaurantsAdded, restaurantsUpdated, itemsAdded, itemsSkipped, warnings: readonly { row, reason }[] }`

### Contracts (`packages/contracts/src/catalog/`)

New parsers:

- `parseCsvRow(row: Record<string, string>)` — strict per-row validator; returns typed result or throws
- `parseCsvHeader(header: string[])` — validates the 17 expected headers
- `parseRestaurantListResponse(json)` — array of `RestaurantSummary`
- `parseRestaurantDetailResponse(json)` — `RestaurantDetail`
- `parseCatalogImportResponse(json)` — `CatalogImportSummary`

### Repositories (`packages/db/src/repositories/catalog.ts`)

New functions (today only `findPublishedMenuVersion` exists):

- `listRestaurants(): Promise<RestaurantSummary[]>` — join restaurants → branches → published menu_version → first item's image_url as hero
- `getRestaurantDetail(branchId): Promise<RestaurantDetail | null>` — load restaurant, branch, current published menu_version with categories and items
- `importCatalog(userId, sourceFileName, parsed rows): Promise<CatalogImportSummary>` — one import record per upload, with source-ID replacement inside one transaction
- `listRecentImports()` — returns date, stored filename, restaurant count, and status for the admin table
- `updateRestaurant(restaurantId, patch): Promise<boolean>` — patch restaurant name/cuisines and its V1 branch name/Grab URL; false means not found
- `updateMenuItem(itemId, patch): Promise<boolean>` — patch name, description, basePriceCentavos, isAvailable, imageUrl; false means not found

### API endpoints (`apps/web/app/api/`)

| Method | Path                                            | Purpose                           | Body / Response                                                                               |
| ------ | ----------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| POST   | `/api/admin/catalog/import`                     | Upload a CSV                      | multipart/form-data with `file` field; returns `CatalogImportSummary`                         |
| GET    | `/api/catalog/restaurants`                      | List restaurants                  | Returns `RestaurantSummary[]`                                                                 |
| GET    | `/api/catalog/restaurants/[restaurantId]`       | Restaurant detail with menu       | Returns `RestaurantDetail` (uses the restaurant's first branch in V1)                         |
| PATCH  | `/api/admin/catalog/restaurants/[restaurantId]` | Edit restaurant and its V1 branch | JSON body with optional `name`, `cuisines`, `branchName`, `grabUrl`                           |
| PATCH  | `/api/admin/catalog/items/[itemId]`             | Edit menu item                    | JSON body with optional `name`, `description`, `basePriceCentavos`, `isAvailable`, `imageUrl` |

Auth: all `/api/admin/*` routes require Platform Admin (existing middleware). The two GET endpoints under `/api/catalog/*` are available to any signed-in user (the product spec says "Restaurant and Favorites access immediately after Google sign-in").

## UI designs

### Admin → Import page (`apps/web/app/admin/imports/page.tsx`)

- Replace the mock draft list entirely.
- Top: a dashed-border drop zone with a "Upload CSV" button. Accepts only `.csv`, max 5MB.
- While uploading: spinner with the text "Importing…".
- On success: green summary card with counts and a timestamp. Below it, a list of any skipped rows.
- On failure: red error card with the specific failure reason.
- Below the upload area: "Recent imports" table — date, file name, restaurant count, status (draft/published/failed) — pulled from `catalogImports`. (For V1, each upload creates a row that goes straight to `published` on success or `failed` on error; `draft` is reserved for the future preview flow.)

### Admin → Catalog page (`apps/web/app/admin/catalog/page.tsx`)

- Replace the fake "Green Table" / "Fresh Bowls" cards entirely.
- Search box at top (filters by name; client-side filter for V1 is fine).
- Responsive grid (1 col mobile, 2–3 col desktop) of restaurant cards:
  - Image: hero image (first menu item's photo), or a colored block with the first letter if no image
  - Restaurant name
  - Branch name (small, gray)
  - Cuisine tags (chip list)
- Click anywhere on the card → `/admin/catalog/[restaurantId]/edit`

### Admin → Restaurant Edit page (`apps/web/app/admin/catalog/[restaurantId]/edit/page.tsx`) — new

- Three sections in a single column form:
  1. **Restaurant**: name input, cuisines input (comma-separated; parsed on save)
  2. **Branch**: branch name input, Grab URL input
  3. **Menu**: each category as a collapsible disclosure; inside, a vertical list of items. Each item row: image (small thumbnail), name input, description input, price input (PHP, two decimals), availability toggle, image URL input.
- Sticky "Save changes" button at top and bottom. Single PATCH per field group: one for restaurant+branch, one per edited item (or batched — implementation detail).
- No add/delete buttons in V1.

### Member Home — web (`apps/web/app/(member)/page.tsx`)

- Replace the hardcoded restaurant array with a fetch to `GET /api/catalog/restaurants`.
- Responsive grid: 1 column on phone-width PWA, 2–3 columns on tablet/desktop.
- Each card: hero image, restaurant name, cuisine tags, branch name. Tap navigates to `/restaurants/[restaurantId]`.

### Member Home — mobile (`apps/mobile/app/(member)/index.tsx`)

- Same data source as web. Single-column scroll list. Tap navigates to a new route `(member)/restaurants/[id].tsx`.

### Member Restaurant Detail page — web (`apps/web/app/(member)/restaurants/[restaurantId]/page.tsx`) — new

Layout (mobile-first, scales up on desktop):

```
┌──────────────────────────────────────┐
│  ← Back                              │
│                                      │
│  [Hero image — full width]           │
│                                      │
│  McDonald's                          │ ← h1
│  Magsaysay / Naga Magsaysay          │ ← gray subtitle
│  American · Burger · Fried Chicken   │ ← cuisine tags
│                                      │
├──────────────────────────────────────┤
│ For You  New Offers  Chicken  ...    │ ← sticky chips, horizontal scroll
├──────────────────────────────────────┤
│  New Offers                          │ ← category h2
│  ┌────────────────────────────────┐  │
│  │ [img]   McCafé Iced Coffee…    │  │ ← item card
│  │         Coco Mocha             │  │
│  │         ₱89.00                 │  │
│  └────────────────────────────────┘  │
│  ...                                 │
└──────────────────────────────────────┘
```

- Tapping a category chip scrolls to that category section.
- Tapping an item does nothing in V1 (Favorites bundle owns this).
- Items shown as a vertical list (web), single column (mobile). Not horizontal scroll — that pattern is awkward on web.
- No rating, distance, hours, promo badges, "+" button — the CSV has none of this data and these features belong to later bundles.

### Member Restaurant Detail page — mobile (`apps/mobile/app/(member)/restaurants/[id].tsx`) — new

Same layout, single column, native ScrollView for the sticky chip row.

## Mock data to remove

Known references (confirmed via grep):

| File                                       | Mock to remove                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(member)/page.tsx`           | Restaurant array with "Green Table", "Fresh Bowls", "Crispy Chicken" (lines 22, 31, 40)                                     |
| `apps/web/app/(member)/favorites/page.tsx` | "Green Table · BGC" references (lines 27, 33, 37)                                                                           |
| `apps/mobile/app/(member)/favorites.tsx`   | "Green Table" references (lines 35, 40)                                                                                     |
| `apps/web/app/admin/catalog/page.tsx`      | Fake restaurant table rows including "Green Table · BGC", "Fresh Bowls · Makati", "Crispy Chicken · BGC" (lines 43, 45, 52) |
| `apps/web/app/admin/imports/page.tsx`      | "Fresh Bowls · Makati" and "Green Table · BGC" mock entries (lines 31, 40)                                                  |

Replacement approach:

- **Member Home, Admin Catalog, Admin Imports**: fully replaced by this bundle's new data flow (API fetch from real catalog).
- **Favorites tabs (web + mobile)**: this bundle does not implement Favorites. The current "Green Table" mock cards on these tabs contradict what members will see in the real catalog. Replace the mock content with an empty state ("No favorites yet — browse restaurants to add your first one.") rather than building the Favorites feature itself. The empty state is honest and stays consistent with the real catalog until the Favorites bundle ships.

A final grep pass on `Green Table`, `Fresh Bowls`, and `Crispy Chicken` will confirm no stale references remain after the cleanup.

## Error handling matrix

| Failure                                       | HTTP | What the user sees                                                                     |
| --------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| Caller not Platform Admin (on `/api/admin/*`) | 403  | Existing access-control redirect                                                       |
| Caller not signed in (on `/api/catalog/*`)    | 401  | Existing auth redirect                                                                 |
| File size > 5MB                               | 400  | "File too large. CSVs must be under 5MB."                                              |
| Content-Type not CSV / extension not `.csv`   | 400  | "Please upload a .csv file."                                                           |
| Missing required headers                      | 400  | "CSV is missing required columns: <list>"                                              |
| CSV cannot be parsed (malformed)              | 400  | "Couldn't read this CSV. Check the format and try again."                              |
| Zero valid rows after parse                   | 400  | "No valid rows found in this CSV."                                                     |
| Some rows invalid                             | 200  | Import succeeds; summary lists each skipped row: "Row 47: price_centavos must be ≥ 0"  |
| DB transaction fails mid-import               | 500  | Whole import rolls back; user sees "Import failed unexpectedly. No changes were made." |

## Testing strategy

- **Domain / contracts** (Vitest):
  - `parseCsvHeader` — exact header match; missing column; extra column
  - `parseCsvRow` — happy path, missing required field, bad numeric, negative price, invalid boolean, invalid date
  - Restaurant list/detail response parsers
- **Repositories** (Vitest against test DB):
  - `importCatalog` — single-restaurant insert, multi-restaurant insert, replace on re-import (same source_restaurant_id), partial-failure rollback
  - `listRestaurants`, `getRestaurantDetail` — return shape and ordering
  - `updateRestaurant`, `updateMenuItem` — patch applied, other fields preserved
- **API** (Vitest or Playwright API context):
  - Auth: 403 for non-admin on `/api/admin/catalog/import`
  - Upload: success, each error case from the matrix
  - Edit endpoints: 403 for non-admin, 400 for unknown id, 200 for valid patch
- **Web UI**:
  - React Testing Library: Import page (upload, summary, errors), Catalog page (renders list from API mock), Edit page (saves trigger PATCH), Restaurant Detail (renders menu from API mock, chip scroll jump)
- **Mobile UI**:
  - Jest + React Native Testing Library: Home (renders list), Restaurant Detail (renders menu)
- **End-to-end verification**:
  - Browser: upload the user's actual CSV on web, verify the Catalog page and member Home show real restaurants, open one to verify the detail page renders the menu correctly
  - Android emulator: verify member Home renders real restaurants and tapping navigates to the detail page

## Security and policy alignment

- The upload endpoint requires Platform Admin (existing role check pattern from `apps/web/src/application/group-authorization.ts`).
- CSV parsing treats all cell values as untrusted input — strict validation through the contracts layer before any DB write.
- Grab CDN image URLs are rendered through Next.js `<Image>` with the domain added to `next.config.js` allowlist. URLs are stored verbatim; no transformation.
- The CSV file is not persisted beyond the import (no copy in R2). The `catalogImports.source_file_id` column is left null in V1; if the user later wants file retention, that's a follow-up.
- Transaction rollback guarantees no partial state after a mid-import failure.

## Open questions deferred to implementation

These are flagged for the implementer, not blockers for the spec:

- CSV parsing library choice (`papaparse`, `csv-parse`, or hand-rolled). Recommend `csv-parse` (smaller and synchronous-friendly) — finalize during plan.
- sortOrder assignment for categories and items: by first-seen row order, or alphabetical? Recommend first-seen (matches the CSV's curated order).
- Whether the web Restaurant Detail should use horizontal-scroll chips or a horizontal scroll-snap row. Recommend sticky horizontal chips with scroll-into-view on tap.
- Whether the admin Edit page batches PATCHes or sends one per field. Recommend per-section batching for restaurant/branch, per-item for items.
