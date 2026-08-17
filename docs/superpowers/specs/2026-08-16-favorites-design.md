# Favorites — saving ranked favorite meals (web)

Date: 2026-08-16
Status: Approved design, pending implementation plan
Bundle: Favorites (after Multi-group)

## Problem

Members cannot save favorite meals. The favorites database groundwork (tables,
domain types, contracts, a read repository) exists from V1-03, and the member
Favorites page shows an honest empty state. This bundle adds the actual saving
and ranking experience on web.

## Decisions (from product owner)

1. The **+** control lives on **meal cards** (menu item rows on the restaurant
   detail page), not on restaurant cards.
2. Limit is **top 3 favorites per restaurant branch**, matching the existing
   schema (`favorites_user_branch_rank_unique`, rank 1–3).
3. When 3 favorites already exist at a branch, tapping + is **blocked with a
   friendly message** — nothing is silently replaced.
4. **Save now, wire to orders later.** Order auto-fill is deferred to the order
   sequence bundles; favorites data will be ready for them.
5. **Web only** this bundle. Mobile gets favorites in its own bundle later
   (Android verification is currently blocked by the Expo SDK 57 crash).

## User experience

### Restaurant detail page (member)

- Each menu item row gets a round **+** button on the right side of the card,
  vertically centered.
- Tap **+** → the meal is saved as a favorite at that restaurant. The button
  becomes a filled **✓** state.
- Tap the **✓** → the favorite is removed (toggle).
- While a save/remove request is in flight the button is disabled to prevent
  double submits. On completion the page data refreshes (server re-render) so
  the visible state always matches the database.
- If the user already has 3 favorites at that branch and taps **+** on another
  meal, the API rejects the save and an inline message appears near the button:
  *"You already have 3 favorites here — remove one first."* The message clears
  automatically after 5 seconds (or on the next tap) and is announced politely
  to screen readers (`aria-live="polite"`).

### Favorites page (member, web)

- Replaces the empty state when favorites exist.
- Favorites grouped by restaurant branch (restaurant name + branch name),
  each group listing up to 3 meals.
- Each meal row shows a **#1 / #2 / #3** rank badge, the meal name, the
  current menu price, and a **Remove** button.
- The honest empty state remains for users with no favorites.

### Ranking rules

- First save at a branch = rank 1, second = rank 2, third = rank 3 (lowest free
  rank).
- Removing a favorite compacts the remaining ranks (remove #1 → old #2 becomes
  #1, old #3 becomes #2); the next save takes the freed end slot.
- No manual reordering in this bundle — remove and re-add to change order.
- A favorite is the meal exactly as shown on the card: menu item, quantity 1,
  no variant, no modifiers, empty note. The schema supports richer
  combinations later.

## API design

Follows the existing route-handler factory pattern with injected dependencies
(`verifySession`, `loadIdentity`, repository functions), like
`users-admin-route-handlers`.

### `POST /api/favorites`

- Request body: `{ "menuItemId": "<uuid>" }`, validated by a new
  `parseFavoriteSaveRequest` contract.
- Server resolves the menu item through the catalog read model to get branch,
  menu version, name, price, and availability — the client never sends
  prices or names (untrusted input rule).
- Authenticated members only. Writes happen in one transaction:
  1. Load existing favorites for user + branch.
  2. If an existing favorite already contains this menu item → `409`
     `CONFLICT` "This meal is already one of your favorites here." (client
     shows the ✓ state; no duplicate row).
  3. If 3 favorites exist → `409` `CONFLICT` "You already have 3 favorites
     here — remove one first."
  4. Insert `favorites` row at the lowest free rank with a name/availability
     snapshot, plus one `favorite_items` row (quantity 1, sort order 0).
- Success: `200` with the saved favorite summary (the app's uniform
  `{ data: ... }` success envelope).

### `DELETE /api/favorites/[favoriteId]`

- Ownership check: the favorite must belong to the signed-in user, otherwise
  `404` (no information leak).
- Deletes the favorite and compacts the remaining ranks at that branch in one
  transaction.
- Success: `200`.

## Data

- No schema changes. Tables used: `favorites`, `favorite_items` (both from
  migration `0000`).
- `favorites.name` stores the meal display name snapshot; `availability`
  stores the menu availability snapshot at save time. The price shown on the
  Favorites page is read live from the current menu (`menu_items`), since the
  schema keeps no price snapshot. Staleness marking after catalog refresh is
  deferred (existing groundwork supports it).
- Repository additions in `packages/db` favorites repository:
  - `listForUser(userId)` — all favorites with item rows, for the Favorites page.
  - `createFavorite(...)` / `deleteFavorite(...)` — transactional writes
    including rank compaction.

## Components and structure

- `apps/web/src/features/favorites/` — new feature module:
  - `favorites-runtime.ts` (catalog pattern: lazy DB, repositories, identity).
  - `favorites-route-handlers.ts` (factory handlers, unit-testable with fakes).
  - `favorite-button.tsx` (client component: + / ✓ states, pending disable,
    inline limit message, refresh on completion).
- Restaurant detail page (server component) loads the user's favorites for the
  branch via the runtime and passes the favorited menu item IDs down so rows
  render the correct + vs ✓ state.
- Favorites page becomes a server component listing favorites grouped by
  branch with a small client Remove button.
- Contracts: new request/response parsers in `packages/contracts/src/favorites/`
  following `favorite-combination.ts` conventions.

## Error handling

- Unauthenticated requests → `401` (existing session verification behavior).
- Unknown menu item or favorite ID → `404`.
- Limit and duplicate conflicts → `409` with the existing `CONFLICT` code and
  the friendly public message; the button displays the server message inline.
- Unexpected failures surface the app's standard error pattern for API routes.

## Security

- Only signed-in members can call the endpoints; every read/write is scoped to
  the authenticated user's ID — a user cannot list, save, or delete another
  user's favorites.
- Prices, names, and ranks are computed server-side; the only client-supplied
  value is `menuItemId` (validated UUID).

## Testing

- Unit (vitest, fakes): save handler — rank assignment (1→2→3), duplicate
  `409`, limit `409`, unauthenticated `401`, unknown item `404`; delete
  handler — ownership `404`, rank compaction math.
- Repository: extend the existing provider-integration test setup with the new
  write/compaction queries.
- Web page/component tests: + / ✓ rendering from passed-in favorites, inline
  limit message on `409`, Favorites page grouping/rank badges/remove flow,
  empty state retained.
- Full gates: unit tests, lint, typecheck, production build, and manual
  browser verification of the golden path (save three, block the fourth,
  remove one, add another, favorites page reflects changes).

## Out of scope (this bundle)

- Auto-stating favorites as orders (deferred to the order sequence bundles).
- Mobile app UI.
- Variants, modifiers, quantity, notes on favorites.
- Manual reordering; staleness after catalog refresh; favorites sharing.
