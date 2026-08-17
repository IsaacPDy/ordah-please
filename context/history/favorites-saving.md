# Favorites saving and ranking (web)

Subtasks:

- Design spec and implementation plan (`docs/superpowers/specs/2026-08-16-favorites-design.md`, `docs/superpowers/plans/2026-08-16-favorites-saving.md`)
- `parseFavoriteSaveRequest` strict parser in `packages/contracts` (`favorites/favorite-save-request.ts`)
- `catalog.findMenuItemContext` resolving a menu item to its branch, published menu version, name, price, and availability
- Favorites repository member-owned writes and page reads: `listForUserAndBranchWithItems`, `listForUser`, `insertFavoriteWithItem`, `deleteFavoriteForUser`, `updateFavoriteRank` (no schema changes — reuses `favorites` / `favorite_items`)
- Transactional favorites service with rank and limit rules (`apps/web/src/features/favorites/favorites-service.ts`): duplicate conflict, 3-per-branch limit conflict, hole-filling rank assignment, and rank compaction after removal
- `POST /api/favorites` and `DELETE /api/favorites/[favoriteId]` route handlers through `executeRoute` with same-origin mutation checks
- FavoriteButton (+/✓ round toggle) on every meal card of the restaurant detail page, with friendly server messages that auto-clear after 5 seconds
- Favorites page (`/(member)/favorites`) listing favorites grouped by restaurant — branch, with rank badges, live menu prices, and Remove buttons

## Session Notes

- Implemented on `task/favorites-saving` off `main`, executed from the reviewed plan with TDD steps per task. All application copy is in English; imported meal names are preserved verbatim.
- Rank semantics: rank is the order the member saved (1–3), new saves fill the lowest free rank, and removal compacts the remaining ranks (2→1, 3→2). Rank is unique per user+branch via the existing `favorites_user_branch_rank_unique` constraint, which also bounds `listForUserAndBranchWithItems` to at most 3 favorites.
- Saving resolves name, price, availability, branch, and menu version server-side from the published menu (`findMenuItemContext`), so the client only ever sends `menuItemId`. The Favorites page price is read live from the current menu rather than a stored snapshot.
- Success responses use the uniform `executeRoute` envelope (`200 { data }`); conflicts reuse the `CONFLICT` code with the two friendly messages ("This meal is already one of your favorites here." / "You already have 3 favorites here — remove one first."). The spec was updated during planning to record these deviations.
- Web only; mobile favorites and auto-order wiring into order bundles remain deferred.

## Deviations from the plan found during execution

- `parseFavoriteIdParam` adds an explicit UUID format check: domain `parseId` accepts any non-blank string, so the plan's try/catch around `parseId` (the same pattern as the existing admin handlers) could never reject a malformed id, and a garbage id would surface as a Postgres 500 instead of a clean 400.
- `favorites.listForUser` filters `favorite_items` to the member's own favorite ids with `inArray` instead of reading every favorite item row, since this query runs on every Favorites page render.
- `groupFavoritesByBranch` builds with a mutable internal group type because the public `FavoriteGroup.favorites` property is readonly; the plan's version assigned to it directly and failed typecheck.
- `shell-navigation.test.tsx` (placeholder-era) was updated: it now mocks `favorites-runtime` and the empty-state test was renamed, since the Favorites page renders real data now.
- Test-harness adjustments to satisfy repo lint/types: service fakes carry `quantity`, fakes use the house `vi.fn(() => Promise.resolve(...))` style, errors are captured via a typed `captureError` helper, and the conflict-message component test narrows fake timers (`toFake: ["setTimeout", "clearTimeout"]`) and flushes with `act` + `setImmediate` because testing-library `waitFor`'s fake-timer branch stalls under vitest.
- CSS uses `var(--color-on-primary)` instead of a literal `#fff` for saved-state contrast.

## Verification

- Unit: 84 files / 472 tests pass (`npm run test:unit`), including 5 contract parser tests, 7 service tests, 7 route-handler tests, 5 FavoriteButton component tests, 4 FavoritesView tests, and the updated navigation shell test.
- Provider (dev Neon, temporary schema): both new favorites repository tests pass — menu item context resolution, and save/list/delete/rank-compaction page reads (`npm run test:providers` with `DATABASE_MIGRATION_URL`). The single failing provider test (`schema.provider.integration.test.ts` initial Neon schema invariants) is the known pre-existing failure that also fails on main.
- Lint: 0 errors (one pre-existing `react-hooks/exhaustive-deps` warning in an untouched mobile file).
- Typecheck: clean for every workspace from the root.
- Production build: `npm run build:web` succeeds; `/favorites`, `/api/favorites`, and `/api/favorites/[favoriteId]` appear in the route manifest.
- Manual browser verification: completed by the product owner on 2026-08-17 before squash-merge.
