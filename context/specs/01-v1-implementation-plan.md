# ordah please — Implementation Plan

> This plan is based on the current repository, not on `context/progress-tracker.md`.

**Goal:** Continue from the software that actually exists after V1-06 and the current UI pass.

**Architecture:** Keep the existing TypeScript monorepo, Next.js API boundary, Expo client, shared domain/contracts, Neon/Drizzle persistence, and Better Auth Google sign-in. Finish the product through named journey bundles instead of continuing the old V1-07 through V1-23 numbering.

**Tech stack:** TypeScript, Next.js, Expo React Native, Better Auth, Neon PostgreSQL, Drizzle ORM, Cloudflare R2, Upstash QStash, OneSignal, Vitest, Jest, Playwright, Vercel, and Expo EAS.

---

## 1. Repository audit used for this plan

This plan was rebuilt from these implementation facts:

- `apps/web/app/api/` currently contains authentication, identity, invitations, member management, and platform-admin request routes only.
- `packages/storage/src/index.ts`, `packages/jobs/src/index.ts`, and `packages/notifications/src/index.ts` are empty exports.
- `packages/db/src/schema/` already contains catalog, favorites, orders, files, notifications, jobs, and audit tables.
- `packages/db/src/repositories/` already contains repository foundations for those tables.
- `packages/domain/src/` already contains favorite-ranking, voting, food-deadline, order-state, and handoff policies with tests.
- The current member and admin screens render realistic local mock data. Except for existing access-request behavior, they are not connected to APIs or Neon.
- `memberships_one_active_group_per_user` still enforces one active group per user.
- Product roles still use `organizer`; the approved name is `manager`.
- The shared admin layout does not yet enforce Platform Admin access at the page boundary.

## 2. Completed permanent product history

Keep these completed tasks as permanent history. Do not redefine or repeat them in future bundles.

- [x] **V1-01** — TypeScript monorepo, shared tooling, Expo Android app, Next.js web app, CI foundation, and visual tokens.
- [x] **V1-02** — Shared API contracts, provider-neutral domain types, and pure ordering policies.
- [x] **V1-03** — Neon schema, migrations, database access, repository foundations, fixtures, transactions, and immutable audit model.
- [x] **V1-04** — Original Google authentication boundary.
- [x] **V1-04A** — Better Auth replaced Clerk across web and Android.
- [x] **V1-05** — Invitation onboarding, one-group membership, Group Owner, Organizer, Member, member-management actions, and admin requests.
- [x] **V1-06** — Platform Admin approval workflow and limited mobile approval UI.

The former V1-07 through V1-23 plan has been removed. Remaining work is listed below from the current code state.

## 3. Current unnumbered UI progress

The following visual work exists but is not a completed connected journey:

- [x] Google sign-in foundation and existing invitation sign-in prompts.
- [x] Member Home UI with an active-order summary and restaurant cards.
- [x] Orders UI with active and historical sections and filters.
- [x] Favorites UI grouped by restaurant branch with ranked combinations.
- [x] Groups UI showing multiple groups, roles, owner, and members.
- [x] Desktop admin UI for Overview, Users and Permissions, Groups, Catalog, Imports, Refresh Queue, Access Requests, and Audit Log.
- [x] Responsive mobile-admin navigation limited to Groups, Catalog, Access Requests, and Audit Log.
- [ ] Dedicated minimal Google sign-in screen matching the approved copy.
- [ ] Real data, mutations, authorization, loading, empty, error, suspended, and denied states for the new screens.
- [ ] Android emulator visual acceptance for the new native screens.

## 4. Remaining implementation bundles

### Sequential foundation

#### Access entry and multi-group migration

**Why it exists:** The approved app lets any Google account browse restaurants and Favorites, then join several groups. The current data model still permits only one active group and still uses Organizer.

**Build:**

- Provision or resolve an app user after Google sign-in without requiring a group invitation.
- Protect member and admin pages with real session checks.
- Allow restaurant and Favorites access before group membership.
- Remove the one-active-group database constraint without losing existing memberships, invitations, or audit history.
- Rename Organizer to Manager across domain types, contracts, database enum/data, APIs, tests, and UI.
- Enforce one non-transferable Group Owner per group.
- Return all active memberships and the role held in each group.

**Completion evidence:** Migration tests against Neon, access and authorization tests, web browser verification, mobile tests, and Android emulator verification.

#### Effective permissions and account suspension

**Depends on:** Access entry and multi-group migration.

**Why it exists:** Roles provide defaults, while the Platform Admin may grant or block individual actions across an entire account.

**Build:**

- Define stable permission action names for every approved group and order action.
- Calculate effective permissions from the role held in each group plus account-wide grants or blocks.
- Store overrides until manually removed and permanently audit creation and removal.
- Prevent the sole Platform Admin from changing protected self-access.
- Add whole-account suspension and read-only group suspension.
- Apply permission checks inside APIs; hiding a button alone does not count as security.

**Completion evidence:** Permission-matrix tests, transaction tests, cookie-free admin-page denial checks, browser verification, and Android emulator verification for affected native states.

#### Group membership and management

**Depends on:** Effective permissions and account suspension.

**Why it exists:** The current access service manages one group, while the approved product needs different roles across multiple groups.

**Build:**

- Create groups for authorized Group Owners and Platform Admins.
- Add users through owner invitations or direct Platform Admin assignment.
- Support Manager offer acceptance or rejection when promoted by a Group Owner.
- Support approved invite, approve, remove, promote, and demote actions.
- Support Member self-leave, Manager leave approval, removed-user rejoin, and preserved membership history.
- Archive a group when its Group Owner leaves; never hard-delete it.
- Connect Home group summaries and Groups detail screens to Neon.

**Completion evidence:** Concurrent membership tests, API authorization tests, audit assertions, browser verification, and Android emulator verification.

### Independent after the multi-group migration

#### Restaurant catalog

**Why it exists:** Catalog schema and repository foundations exist, but members and admins cannot retrieve or manage real restaurant data.

**Build:**

- Add authenticated catalog read APIs for restaurants, exact branches, menus, availability, and filters.
- Connect Home previews and the full restaurant list to published Neon data.
- Connect admin catalog search, branch inspection, pause, and resume actions.
- Preserve the last published menu when an import or refresh fails.

**Completion evidence:** Repository/API tests, stale-menu tests, web browser verification, and Android emulator verification.

#### Favorites

**Depends on:** Restaurant catalog.

**Why it exists:** Ranking policies, contracts, schema, and UI exist, but Favorite creation and persistence do not.

**Build:**

- Create, read, edit, rerank, and remove a user's complete food combinations for an exact branch.
- Enforce the default three-rank limit and an admin-configurable limit.
- Confirm removal when all Favorites for a branch will be deleted.
- Keep Favorites available before group membership.
- Enforce ownership so users can change only their own Favorites.

**Completion evidence:** Policy, repository, API, ownership, browser, and Android emulator tests.

#### Private files and catalog imports

**Why it exists:** File tables and repositories exist, but the storage package is empty and no upload or import API exists.

**Build:**

- Implement private R2 object keys, signed uploads, finalization, and short-lived downloads.
- Validate purpose, ownership, MIME type, and size before signing.
- Parse supported JSON and CSV menu sources into a draft without changing the published menu.
- Show validation errors, warnings, and comparisons in Imports.
- Publish an approved draft atomically and retain its source and validation report.

**Completion evidence:** Storage adapter tests, parser tests, failed-upload cleanup tests, publication transaction tests, and desktop browser verification.

#### Platform Admin operations

**Depends on:** Effective permissions. Catalog and import actions become functional when their owning bundles finish.

**Why it exists:** Only Access Requests is connected. Other admin screens currently display mock records.

**Build:**

- Connect Overview metrics and priority work.
- Connect Users and Permissions, including role-derived and override-derived permission details.
- Connect Groups inspection, support access to group orders, suspension, and archive state.
- Connect Catalog, Imports, Refresh Queue, and Audit Log as their backend bundles become available.
- Enforce Platform Admin authorization for every `/admin` page, not only its APIs.

**Completion evidence:** Protected-page tests, API tests, browser verification at desktop and mobile widths, and audit assertions.

### Sequential order journey

#### Order setup and participants

**Depends on:** Group management and Restaurant catalog.

**Build:** Create an order for one group, copy its delivery address with an optional override, select participants, choose the initial restaurant and voting mode, set deadlines, and set whether members may upload their own receipts.

#### Restaurant voting

**Depends on:** Order setup and participants.

**Build:** Accept votes only from selected participants, apply the existing 50 percent/tie/fallback policy, resolve the restaurant, and preserve the decision in audit history.

#### Food confirmation

**Depends on:** Restaurant voting and Favorites.

**Build:** Preselect valid Rank 1 Favorites, allow each participant to confirm, decline, or replace food, and allow a Manager or Group Owner to resolve missing or unavailable selections.

#### Handoff and completion

**Depends on:** Food confirmation.

**Build:** Generate consolidated lines, member breakdown, food subtotal, copyable Grab handoff, optional Grab opening, and explicit Ordered or Cancelled completion. Opening Grab must never mark the order as placed.

#### Receipts, history, and post-order Favorites

**Depends on:** Handoff and completion plus Private files.

**Build:** Upload full-order receipts, optionally allow participant receipts, enforce receipt visibility, preserve immutable order snapshots, connect history filters, and ask a member before saving Manager-selected food as a Favorite.

**Completion evidence for every order bundle:** Existing domain policies plus new repository, API, authorization, state-transition, browser, and Android emulator tests.

### Operational sequence

#### Supervised catalog refresh

**Depends on:** Private files and catalog imports.

**Build:** Run supervised refreshes, classify changes and risks, preserve published data on failure, support pause/retry/review decisions, and connect Refresh Queue.

#### Deadlines and notifications

**Depends on:** Stable order contracts.

**Why it exists:** Notification and job tables exist, but both provider packages are empty.

**Build:** Implement signed and idempotent QStash callbacks, deadline handling, provider-neutral notification events, OneSignal Android/web delivery, device registration, retries, and in-app notification history. If a scheduled deadline is missed, allow manual Manager or Group Owner resolution.

#### Client delivery and release verification

**Depends on:** The complete member order journey.

**Build:** Add iPhone PWA installation and notification guidance, produce the private Android APK, verify production Better Auth redirects, run complete security/accessibility/failure-state tests, and document free-tier warning thresholds without enabling paid services.

## 5. Recommended execution order

1. Access entry and multi-group migration.
2. Effective permissions and account suspension.
3. Group membership and management.
4. Restaurant catalog and Favorites.
5. Private files and catalog imports.
6. Platform Admin operations.
7. Complete the order journey in sequence.
8. Supervised refresh, deadlines, and notifications.
9. Client delivery and release verification.

Restaurant catalog discovery may begin in parallel with effective permissions after the multi-group schema migration is stable. Private storage may also proceed independently after its authorization contract is fixed.

## 6. Decision conflict to resolve before group management

- `context/product-decisions-questionnaire.md` answer A2 says Managers may not invite users.
- The permission table in the same questionnaire says Managers may invite users.
- Do not implement Manager invitation authority until this is resolved. Group Owners and Platform Admins remain approved inviters either way.

## 7. Completion rule

A bundle is complete only when its real data and mutations work through the UI, API, authorization layer, and Neon persistence. A screen containing mock data is useful UI progress but is not a completed product journey.
