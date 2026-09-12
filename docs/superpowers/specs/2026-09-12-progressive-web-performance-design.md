# V1-08 Progressive web performance design

**Date:** 2026-09-12

**Status:** Approved design; implementation pending

**Scope:** `apps/web` member PWA and admin portal

## Purpose

Make the deployed web app feel responsive by reducing server and database work before content appears. Preserve current authorization, order correctness, and English product language.

In simple terms: each screen should ask for the smallest useful answer first. Large or private details should load only when the user asks to see them.

## Evidence and root causes

A signed-in production browser pass on 2026-09-12 measured these end-to-end page loads:

| Screen | Observed load |
| --- | ---: |
| Home | about 8.4 seconds |
| Orders | about 4.8 seconds |
| Favorites | about 3.2 seconds |
| Groups | about 3.2 seconds |

These are directional single-run measurements, not stable provider service-level metrics. Before-and-after acceptance must use the same browser, account, routes, and comparable warm/cold conditions.

The source audit found bounded and unbounded work that explains the delay:

- Home waits for catalog data before starting order-summary work.
- The restaurant-list query reads every menu item for every published menu, then selects one image per restaurant in application memory.
- Home renders every restaurant even though it is a preview section.
- Orders reads all visible orders, every terminal-order participant, and every saved terminal-order line before rendering collapsed history cards.
- Groups issues two database reads per membership.
- Admin Groups reads members once per group.
- Admin Users resolves group names once per membership.
- Restaurant detail loads its catalog detail before beginning identity and favorite reads.
- Every protected route is dynamically rendered. The request-cached identity loader prevents duplicate identity reads inside one React request tree, but the layout still blocks visible protected content while authentication and membership data load.

The production build succeeds. This is a runtime data-flow problem, not a React compilation failure.

## Chosen approach

Use data-first progressive loading:

1. Reduce rows and columns read from Neon.
2. Batch repeated reads into set-based queries.
3. Start independent work concurrently.
4. Render stable shells and skeletons while private sections stream.
5. Fetch expandable and paginated details only on demand.
6. Cache only shared published-catalog data with explicit invalidation.

This is preferred over a client-heavy rewrite because Server Components keep client JavaScript small. It is preferred over broad caching because identity, permissions, memberships, favorites, and orders must reflect current authorization and workflow state.

## Performance budgets

Acceptance aims for all of the following under comparable conditions:

- At least 50% lower median end-to-end load time on Home, Orders, Favorites, and Groups.
- A visible shell or meaningful route skeleton within 300 ms of client navigation.
- Warm production navigation near 2 seconds when Vercel and Neon free-tier latency permit it.
- No initial list query whose work grows with every historical detail row or related child row.
- Already-rendered local interactions respond without a network wait unless the interaction explicitly requests unloaded data.

Provider cold starts and network distance are external variables. If an absolute timing target is missed, completion requires query-count/row-count evidence plus a same-condition improvement measurement; a visual skeleton alone is not a performance win.

## Data design

### Catalog previews

Add a focused restaurant-preview repository read with an explicit limit. It returns only restaurant ID/name, branch ID/name, cuisines, and one hero image.

The database selects at most one suitable image per published menu. Application code must not load every menu item to discover the first image.

- Home requests six previews.
- New Order requests only the restaurant fields needed by the wizard.
- Admin Catalog uses a bounded page rather than an unlimited list.
- Existing full restaurant detail remains the source for menu categories and items.

Published catalog preview/detail data may use a shared Next.js cache because all signed-in viewers see the same published catalog. Catalog import and edit route handlers invalidate the matching cache tags. No cache may include request headers, cookies, identity, roles, orders, memberships, or favorites.

### Order summaries and history details

Split the current combined read into two contracts:

- Initial Orders data: every actionable active order plus the newest ten terminal-order summaries.
- History detail: authorized participant rows and immutable saved lines for one terminal order, fetched only when its card is opened.

The initial terminal summary contains status, restaurant, group, completion date, and participant count. It does not contain participant arrays or order lines.

“Load more” requests the next bounded history page using a stable cursor based on completion/creation order plus order ID. It appends results without replacing already visible rows.

The history-detail endpoint repeats server-side identity and resource authorization. A current Group Owner or Manager may receive the group-visible participant log. A Member receives only their own authorized row and lines. Client input never determines visibility.

Home uses an active-order-only summary read and never loads history details.

### Batched group and admin reads

Replace per-row runtime loops with repository reads that resolve collections in one set-based query per screen concern:

- Member Groups: names, roles, member counts, and bounded member previews for all viewer memberships.
- Admin Groups: active groups, owner display name, member count, and active-order count.
- Admin Users: active user profile fields plus group IDs, names, and roles.

Aggregation must preserve empty groups/users and deterministic display ordering.

### Detail-page concurrency

Start independent reads before awaiting them:

- Home starts catalog previews and active-order summaries together after identity is known.
- Restaurant detail starts identity and restaurant detail together, then reads only favorites relevant to the selected branch.
- New Order starts group summary, members, address, and bounded restaurant choices together.

Do not parallelize steps where a later read needs an earlier result or where mutations require transaction order.

### Database indexes

Do not add speculative indexes. Inspect generated SQL and use provider-backed query plans for the new bounded reads. Add a forward Drizzle migration only when a demonstrated scan/sort needs an index. Never edit an applied migration.

## Rendering design

Keep pages as Server Components. Client Components remain small interactive islands for existing forms plus:

- one history list controller for expand/load-more behavior;
- one history row that requests detail on first expansion and reuses it while mounted;
- inline retry for failed history-detail or next-page requests.

Add route-level loading UI for dynamic member and admin destinations. Move slow protected rendering behind focused `Suspense` boundaries so the stable frame can appear first. Protected page data must remain behind the authenticated access boundary; streaming must never reveal content before authorization succeeds.

Skeletons mirror the final layout closely enough to prevent large layout shifts. They use existing colors, radii, and spacing and include accessible loading text.

## Error and empty states

- A failed optional section shows an inline retry and does not erase already loaded content.
- A failed initial authorization check continues to show the existing signed-out or unavailable state.
- A failed Orders summary read shows the current retry message.
- A failed history detail keeps the card summary visible and provides an inline retry.
- A failed next page keeps existing history visible.
- Empty states remain truthful and do not render skeletons indefinitely.

## Security and freshness

- Preserve Better Auth session verification and Neon-backed role checks.
- Never cache cross-user or group-private data.
- Never accept a role, user ID, or visibility decision from the browser.
- History-detail and pagination routes use validated parameters and resource-level authorization.
- Catalog mutation handlers invalidate catalog cache tags only after a successful committed write.
- No server credential or provider response is added to client bundles or errors.

## Verification

Follow test-first implementation for each behavior change.

Automated checks:

- Repository tests prove bounded catalog/history reads, deterministic cursors, batched aggregation, and empty-data behavior.
- Service tests prove active-only Home data and role-correct terminal history detail.
- Route tests prove validation, authentication, authorization, pagination, and safe error envelopes.
- React tests prove skeleton, expand-once, retry, append, empty, and preserved-content behavior.
- Query-spy tests prove no per-row repository loop remains in the affected runtime paths.
- Existing focused order, catalog, group, user, access, and shell tests remain green.
- Web lint, type checking, production build, and client-secret scan pass.

Provider and browser checks:

- Provider-backed tests verify new SQL against an isolated development-Neon schema.
- Compare query plans for any read that remains slow; add an index only with evidence.
- Re-run Home, Orders, Favorites, Groups, restaurant detail, New Order, and affected admin screens with real signed-in roles.
- Record comparable before/after timings and confirm immediate skeleton feedback.
- Verify current Owner, Manager, Member, and Platform Admin visibility boundaries.

## Documentation impact

Implementation must update:

- `context/progress-tracker.md` after each meaningful task slice;
- `context/design-structure.md` for progressive list and loading-state rules;
- `context/project-structure.md` if new route/data modules are introduced;
- `context/architecture.md` for shared catalog-cache and invalidation boundaries;
- a completion record under `context/history/` with tests and measurements.

## Out of scope

- Expo/React Native performance work.
- Paid Vercel or Neon upgrades.
- Changing authentication providers or authorization semantics.
- Automatic Grab interaction, scraping, checkout, or payment.
- Large visual redesigns unrelated to loading feedback.
- Caching protected user or group data across requests.
