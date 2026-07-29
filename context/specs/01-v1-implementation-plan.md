# ordah please — V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved private food-order coordination system from an empty repository into a verified Android APK, iPhone PWA, web admin portal, and trusted API without automating Grab checkout or exceeding the V1 scope.

**Architecture:** Use one TypeScript monorepo with Expo Android and Next.js web clients. Both clients call authenticated Next.js Route Handlers; shared domain packages own business rules, Neon owns structured state, R2 owns private file bytes, QStash invokes scheduled API work, and OneSignal delivers push events. Development proceeds in vertical slices so every phase produces a testable capability rather than a disconnected technical layer.

**Tech Stack:** npm workspaces, TypeScript, Expo React Native, Expo Router, React Native Paper, Next.js, shadcn/ui, self-hosted Better Auth, Google OAuth, Neon PostgreSQL, Drizzle ORM, Cloudflare R2, Upstash QStash, OneSignal, Vitest, React Native Testing Library, Playwright, Expo EAS, and Vercel.

---

## 1. Planning Rules and Fixed Decisions

This plan implements the approved product design in `context/specs/00-v1-product-design.md` and the numbered V1 items in `context/progress-tracker.md`.

- Use npm workspaces without adding a task orchestrator in V1. The repository is small enough that root scripts can call each workspace directly.
- Keep all money as integer Philippine centavos.
- Store timestamps in UTC and render them in the viewer's timezone.
- Keep product roles in Neon product tables; Google proves identity and Better Auth creates the application session only.
- Use `context/service-limits.md` as the operating register. A warning threshold never authorizes paid usage.
- Never allow a client to connect directly to Neon, R2, QStash, or the OneSignal server API.
- Keep the last published menu usable when imports or refreshes fail.
- Copy price, item, modifier, branch, participant, and delivery-address snapshots into order history.
- Keep Grab ordering manual. Opening Grab never means an order was placed.
- Keep all application-authored language in English and preserve imported proper names exactly.
- Do not block initial development on a custom domain. Use the Vercel origin through `APP_BASE_URL` and decide on a custom domain before production push and OAuth configuration are frozen.
- Treat the outgoing Grab link as progressive enhancement. The copyable handoff is the required behavior.

## 2. Delivery Strategy

Three implementation sequences were considered:

1. **Vertical slices — selected.** Build foundations, then complete one usable workflow segment at a time across domain, database, API, and clients. This finds integration mistakes early and keeps the app demonstrable.
2. **Backend-first.** Finish schema and every API before UI work. This makes backend boundaries clear but delays real-user feedback and increases the chance that the API shape does not fit the screens.
3. **Service-first.** Connect every provider before product features. This proves credentials early but creates idle infrastructure, mixes environments too soon, and gives no product behavior to verify.

The selected order is: local foundation → pure business rules → Neon → Better Auth/access → catalog → favorites → order creation → voting and deadlines → food confirmation → handoff/history → notifications → platform hardening and releases.

## 3. Implementation Workstreams and Branch Ownership

The phase sequence remains the source of truth for dependency order. The workstreams below divide ownership so agents can work in separate branches and worktrees without treating the system as disconnected layers.

### Workstream A — Foundation and Integration

**Purpose:** Establish the shared workspace that every other workstream depends on and integrate reviewed branches in dependency order.

**Owns:** Root workspace configuration, root scripts, lockfile integration, shared TypeScript and lint settings, environment templates, CI entrypoints, merge coordination, and the progress tracker.

**Mapped tasks:** 0.1, 0.2, and cross-workstream integration checkpoints.

### Workstream B — User Interface and Design System

**Purpose:** Turn approved product behavior into accessible Android, iPhone PWA, and desktop-admin interfaces without owning business decisions.

**Owns:** `apps/mobile/app/`, mobile components and themes, web member/admin layouts and components, `packages/ui/`, PWA installation guidance, loading/empty/error states, and accessibility presentation.

**Mapped tasks:** 0.3; UI portions of 3.2–3.3, 4.3–4.4, 5.1–5.2, 6.1–6.2, 7.1–7.2, 8.1–8.4, 9.1–9.3, 10.1, and 10.5.

### Workstream C — Domain Rules and API Contracts

**Purpose:** Define shared language and prove product rules once so Android, web, and backend cannot disagree.

**Owns:** `packages/domain/` and `packages/contracts/`, including IDs, money, roles, validation schemas, voting, favorite ranking, order transitions, deadline behavior, and handoff calculations.

**Mapped tasks:** 1.1–1.3 and contract/policy portions of later vertical slices.

### Workstream D — Database Design and Persistence

**Purpose:** Store structured product truth with constraints, transactions, immutable snapshots, and audit history.

**Owns:** `packages/db/`, Drizzle schema and migrations, repositories, transaction boundaries, seed data, database integration tests, and persistence portions of later vertical slices.

**Mapped tasks:** 2.1–2.3 and database portions of 3.1–9.2.

### Workstream E — Backend API, Authentication, and Authorization

**Purpose:** Provide the trusted server boundary that verifies identity, validates input, checks permissions, and executes one use case per request.

**Owns:** `apps/web/app/api/`, `apps/web/src/application/`, `apps/web/src/auth/`, server composition, invitation/access workflows, and authorization tests.

**Mapped tasks:** 3.1–3.3 and API/use-case portions of 4.1–9.2.

### Workstream F — Storage, Imports, and Catalog Operations

**Purpose:** Manage private file bytes and reviewed restaurant data without allowing a failed import or refresh to erase approved data.

**Owns:** `packages/storage/`, R2 adapters, signed file flows, import parsing, catalog publication, version comparison, refresh risk classification, and supervised refresh operations.

**Mapped tasks:** 4.1–4.4 and 9.1.

### Workstream G — Scheduled Jobs and Notifications

**Purpose:** Run deadline/reminder work safely and deliver notifications without making external delivery part of state correctness.

**Owns:** `packages/jobs/`, `packages/notifications/`, QStash signature/idempotency logic, OneSignal adapter, provider-neutral events, and push onboarding adapters.

**Mapped tasks:** 6.3 and 9.2–9.3.

### Workstream H — Release, Security, and Quality

**Purpose:** Prove the complete system, prevent secrets and authorization leaks, and produce private Android and PWA releases.

**Owns:** `.github/workflows/`, `tests/e2e/`, cross-workspace release checks, security matrices, EAS profiles, release evidence, and free-tier operating guidance.

**Mapped tasks:** 0.2 and 10.1–10.6.

### Parallel Work Rules

1. Workstream A completes Task 0.1 before feature worktrees branch; this prevents conflicting workspace names, scripts, and dependency baselines.
2. Every concurrent agent uses its own Git branch and Git worktree. Agents never share a writable checkout.
3. A branch has one primary workstream owner. Cross-workstream changes must be explicitly listed in the handoff before integration.
4. Only the integration owner edits `context/progress-tracker.md` during parallel work. Feature agents report completed verification and the integration owner records it after merge.
5. Root `package.json`, `package-lock.json`, shared configuration, and provider variable names are integration-sensitive. Agents may change them only when their assigned task requires it and must call out the change before merge.
6. Domain and contract interfaces merge before database, backend, and UI consumers that depend on them.
7. Database migrations merge in one ordered line. Two agents never create migrations from the same schema baseline concurrently.
8. Every branch follows test-first development for behavior, runs focused verification, receives code review, and is merged only after Critical and Important findings are resolved.
9. Service-dependent work pauses at its named service gate. The agent tells the user exactly which account, login, dashboard value, or approval is required and continues only after the gate is satisfied.
10. After integration, all affected workspace checks run again because individually correct branches can still fail when combined.

## 4. Planned Repository Map

```text
apps/
├── mobile/
│   ├── app/                         # Expo Router screens and route groups
│   └── src/
│       ├── api/                     # Typed HTTP client only
│       ├── auth/                    # Better Auth Expo client and SecureStore cookie bridge
│       ├── components/              # Mobile-only composed UI
│       ├── features/                # Catalog, favorites, orders, team, admin
│       ├── notifications/           # OneSignal device adapter
│       └── theme/                   # React Native Paper mapping to shared tokens
└── web/
    ├── app/
    │   ├── (member)/                # iPhone PWA member and organizer routes
    │   ├── admin/                   # Desktop and limited responsive admin routes
    │   └── api/                     # Thin authenticated Route Handlers
    └── src/
        ├── application/             # Server use cases and authorization orchestration
        ├── auth/                    # Better Auth server/client composition and product-user mapping
        ├── components/              # Web-only composed UI
        ├── features/                # Member and admin feature modules
        └── lib/                     # Environment parsing and server composition
packages/
├── contracts/src/                   # Validated API schemas and stable error codes
├── db/src/                          # Drizzle schema, queries, repositories, transactions
├── domain/src/                      # Pure rules, policies, types, and state transitions
├── jobs/src/                        # QStash publishing, verification, idempotent handlers
├── notifications/src/               # Provider-neutral events and OneSignal adapter
├── storage/src/                     # R2 keys, validation, and signed URL adapter
└── ui/src/                          # Shared semantic tokens; no cross-platform component hacks
tests/
└── e2e/                             # Cross-surface Playwright and release smoke tests
```

Every exported function and every non-obvious internal function receives a one-sentence description explaining what it does and why it exists.

## 5. Definition of Done for Every Work Package

A package is complete only when:

- Its focused tests pass.
- A failing test was observed before behavior was implemented.
- Type checking and linting pass for affected workspaces.
- Loading, empty, error, permission, retry, and accessibility states relevant to the package are verified.
- No provider secret is present in client bundles or committed files.
- `context/progress-tracker.md` reflects the implemented result.
- Any changed product, architecture, structure, UI, service, or coding decision is first reflected in its owning context document.
- The change is committed as one focused unit after review.

## 6. Phase 0 — Repository and Local Quality Foundation

### Task 0.1: Create the workspace shell (V1-01)

**Files:**

- Create: `package.json`, `package-lock.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`
- Create: `apps/web/`, `apps/mobile/`, and each `packages/*/package.json`
- Create: root ESLint and formatting configuration
- Modify after verification: `context/project-structure.md`, `context/progress-tracker.md`

- [ ] Confirm supported Node.js and npm versions and pin Node in `.nvmrc` and `package.json#engines`.
- [ ] Create npm workspaces for `apps/*` and `packages/*`.
- [ ] Add root scripts for `typecheck`, `lint`, `test`, `build:web`, and workspace-specific commands.
- [ ] Scaffold Next.js under `apps/web` with strict TypeScript, App Router, and no example product content.
- [ ] Scaffold Expo under `apps/mobile` with Expo Router and the fixed identity: `ordah please`, `ordah-please`, `ordahplease.app`, and `ordahplease` scheme.
- [ ] Create empty buildable shared packages with explicit public exports.
- [ ] Add `.env.example` containing only the variable names already approved in `context/services.md`.
- [ ] Add ignore rules for real environment files, Expo output, Next output, coverage, credentials, and native build artifacts.
- [ ] Run `npm install`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build:web`.
- [ ] Expected result: both apps start, all packages type-check, and no service credential is required.
- [ ] Commit as `chore: initialize ordah please workspaces`.

### Task 0.2: Establish shared tests and continuous integration (V1-01, V1-22)

**Files:**

- Create: `vitest.workspace.ts`, `.github/workflows/ci.yml`
- Create: `tests/e2e/playwright.config.ts`
- Modify: root and workspace `package.json` files

- [ ] Configure Vitest for pure package tests and server tests.
- [ ] Configure React Native Testing Library for mobile component tests.
- [ ] Configure Playwright for the web member and admin surfaces.
- [ ] Add a CI job that installs with `npm ci`, then runs lint, type checking, unit tests, and the web production build.
- [ ] Keep provider-dependent integration and E2E tests opt-in until development services exist.
- [ ] Break one sample assertion and confirm CI/local test failure, then restore it and confirm success.
- [ ] Commit as `test: establish repository quality gates`.

### Task 0.3: Implement approved design tokens and empty navigation shells (V1-01)

**Files:**

- Create: `packages/ui/src/tokens.ts`, `packages/ui/src/index.ts`
- Create: `apps/mobile/src/theme/paper-theme.ts`
- Create: `apps/web/src/app.css` or the equivalent global token mapping
- Create: initial mobile tabs and web member/admin layouts
- Test: token and navigation smoke tests in each workspace

- [ ] Write tests asserting the approved emerald, mint, canvas, text, border, warning, error, spacing, radius, and typography tokens.
- [ ] Implement the shared semantic token object without platform components.
- [ ] Map tokens into React Native Paper and web CSS variables.
- [ ] Add mobile Home, Orders, Favorites, and Team tabs with empty-state content.
- [ ] Add separate web member and admin shells so dense admin layout cannot leak into the member PWA.
- [ ] Verify 44-by-44 touch targets, visible keyboard focus, and dynamic-text-safe shell layouts.
- [ ] Commit as `feat: add shared visual foundation`.

**Phase 0 exit:** An engineer can clone the repository and run both empty clients plus all local quality checks without any external account.

## 7. Phase 1 — Pure Contracts and Domain Rules

### Task 1.1: Define shared identifiers, money, time, roles, and API envelopes (V1-02)

**Files:**

- Create: `packages/domain/src/types/ids.ts`, `money.ts`, `roles.ts`, `time.ts`
- Create: `packages/contracts/src/common/api-result.ts`, `errors.ts`, `pagination.ts`
- Test: matching `*.test.ts` files beside each module

- [ ] Add branded ID types for user, group, restaurant, branch, menu version, favorite, order, import, file, notification, and job records.
- [ ] Add integer-centavo validation and formatting boundaries; domain code must never accept floating-point pesos.
- [ ] Add exhaustive application-role and order-role unions.
- [ ] Add a typed success/error API envelope with stable codes for unauthenticated, forbidden, invalid input, conflict, unavailable, and internal failure.
- [ ] Test invalid money values, role exhaustiveness, and error serialization.
- [ ] Commit as `feat: define shared domain primitives`.

### Task 1.2: Define menu, favorite, order, vote, and history contracts (V1-02)

**Files:**

- Create focused modules under `packages/domain/src/catalog/`, `favorites/`, and `orders/`
- Create matching request/response schemas under `packages/contracts/src/`
- Test: schema and serialization tests beside each module

- [ ] Define immutable catalog read models and menu-version references.
- [ ] Define complete favorite combinations with item, quantity, variant, modifier, note, availability, and rank.
- [ ] Define the order state union: Draft, Restaurant Voting, Food Confirmation, Ready for Handoff, Ordered, and Cancelled.
- [ ] Define choice modes: voting disabled, shortlist, and global catalog.
- [ ] Define participant, vote, food-response, organizer-resolution, subtotal, handoff, receipt, and historical snapshot shapes.
- [ ] Reject unknown fields at API boundaries and preserve imported proper-name strings without normalization.
- [ ] Commit as `feat: define catalog and ordering contracts`.

### Task 1.3: Implement and prove pure business policies (V1-11, V1-13, V1-14, V1-17)

**Files:**

- Create: `packages/domain/src/favorites/ranking-policy.ts`
- Create: `packages/domain/src/orders/voting-policy.ts`, `food-deadline-policy.ts`, `state-machine.ts`, `handoff.ts`
- Test: focused policy tests beside every module

- [ ] Write failing boundary tests for favorite ranks 1–3 and required replacement of a fourth favorite.
- [ ] Write failing vote tests for below 50%, exactly 50%, above 50%, ties, organizer participation, and initial-restaurant fallback.
- [ ] Write failing food-deadline tests for valid Rank 1, unavailable Rank 1, explicit decline, explicit replacement, and missing favorite.
- [ ] Write failing transition tests for every allowed and rejected state transition and repeated idempotent calls.
- [ ] Write failing handoff tests for consolidation, member attribution, quantities, modifiers, notes, and integer subtotal.
- [ ] Implement only enough pure code to pass each group of tests.
- [ ] Commit as `feat: implement core ordering policies`.

**Phase 1 exit:** The hardest product rules are executable and proven with no database, UI, or provider connected.

## 8. Phase 2 — Neon Data Foundation and Auditability

### Service gate: connect development Neon only

Create separate development credentials. Store pooled `DATABASE_URL` and direct `DATABASE_MIGRATION_URL` outside Git. Do not create production credentials yet.

### Task 2.1: Create the relational schema and migrations (V1-03)

**Files:**

- Create: `packages/db/drizzle.config.ts`
- Create focused schema files under `packages/db/src/schema/`
- Create generated migrations under `packages/db/drizzle/`
- Test: `packages/db/src/schema/schema.integration.test.ts`

- [ ] Model users, invitations, groups, memberships, roles, admin requests, and addresses.
- [ ] Model restaurants, branches, menu versions, categories, items, variants, modifiers, availability, imports, refresh runs, and review outcomes.
- [ ] Model favorites and favorite lines with database-enforced ranks 1–3.
- [ ] Model orders, address snapshots, selected participants, votes, food selections, order lines, receipts, notifications, jobs, and audit events.
- [ ] Add foreign keys, unique constraints, check constraints, UTC timestamps, archive/pause fields, and immutable snapshot columns.
- [ ] Run the migration against a disposable development database and prove required constraints reject invalid records.
- [ ] Commit as `feat: add initial Neon schema`.

### Task 2.2: Add database composition, repositories, and transaction boundaries (V1-03)

**Files:**

- Create: `packages/db/src/client.ts`, `transaction.ts`, `index.ts`
- Create focused repositories under `packages/db/src/repositories/`
- Test: repository integration tests beside each repository

- [ ] Parse environment variables on the server and fail clearly when a required server value is missing.
- [ ] Use the pooled connection at runtime and direct connection only in migration commands.
- [ ] Implement small repository interfaces for identity/access, catalog, favorites, orders, files, notifications, jobs, and audit events.
- [ ] Keep permission and workflow decisions out of repositories.
- [ ] Prove multi-record state changes and their audit event commit or roll back together.
- [ ] Commit as `feat: add transactional data access`.

### Task 2.3: Add deterministic development fixtures (V1-03, V1-22)

**Files:**

- Create: `packages/db/src/dev/seed.ts`, `packages/db/src/dev/fixtures.ts`
- Test: seed idempotency integration test

- [ ] Create English-only fictional users and group data.
- [ ] Create a small reviewed menu fixture with exact imported names represented as external data.
- [ ] Make seeding development-only, repeatable, and impossible to run silently against production.
- [ ] Commit as `test: add deterministic development data`.

**Phase 2 exit:** The database can be created from zero, seeded safely, queried through focused repositories, and audited.

## 9. Phase 3 — Authentication, Invitations, Membership, and Roles

### Service gate: connect Vercel development/preview and Google OAuth

Deploy the web app to obtain exact HTTPS origins. Configure Google OAuth basic identity scopes and callbacks, Better Auth base URLs and environment-specific secrets, and the Expo scheme only for development/preview. Keep production isolated. Better Auth Infrastructure is not used.

### Task 3.1: Historical Clerk authenticated API boundary (V1-04)

**Files:**

- Create: `apps/web/src/auth/verify-session.ts`, `load-app-identity.ts`
- Create: `apps/web/src/application/authorize.ts`, `execute-route.ts`
- Create: `apps/web/app/api/webhooks/clerk/route.ts`
- Test: authentication and webhook integration tests

- [x] Verify Clerk sessions server-side.
- [x] Verify Clerk webhook signatures and map Clerk IDs to internal user IDs.
- [x] Make account synchronization idempotent and auditable.
- [x] Implement the route sequence: authenticate, validate, load roles, authorize, execute one use case, serialize a typed result.
- [x] Prove unauthenticated and forged webhook requests are rejected without leaking details.
- [x] Commit as `feat: establish authenticated API boundary`.

### Task 3.1A: Replace Clerk with Better Auth (V1-04A)

**Permanent design:** `context/specs/02-better-auth-migration-design.md`

**Files:**

- Create Better Auth schema, configuration, web handler/client, Expo client, and provider-neutral identity-link command
- Modify the authenticated route executor, identity repository, environment contract, fixtures, and active documentation
- Remove active Clerk packages, webhook, middleware, variables, and runtime code
- Test dependency policy, schema, session rejection, concurrent provisioning, web return flow, Android cookie flow, and built-client secret boundaries

- [x] Keep Better Auth records separate from product users and map through nullable, unique `users.auth_user_id`.
- [x] Preserve product user IDs, memberships, roles, invitations, audit records, and order history.
- [x] Run Better Auth inside the existing Next.js app with the Drizzle PostgreSQL adapter, Google provider, and Expo plugin.
- [x] Use same-origin web cookies and SecureStore-backed Android cookies.
- [x] Create or reuse the product identity on the first authenticated request without accepting provider roles.
- [x] Remove the external identity webhook because product identity provisioning happens at the trusted request boundary.
- [x] Keep old generated migrations immutable while adding an ordered migration for the new auth tables and product mapping.
- [x] Keep Google OAuth in Testing with only `openid`, `email`, and `profile`.
- [x] Prove provider-free, provider-backed, build, browser, Android, migration, and secret-scan verification before retiring Clerk.
- [x] Commit permanently as `V1-04A Replace Clerk authentication with Better Auth on Neon`.

### Task 3.2: Implement invitation-only onboarding and one-group membership (V1-05)

**Files:**

- Create invitation and membership contracts, repositories, use cases, routes, and screens under their owning feature folders
- Test: domain, API integration, mobile component, and web component tests

- [x] Create expiring, unpredictable invitation tokens stored as hashes.
- [x] Require Google sign-in before invitation acceptance.
- [x] Reject reuse, expiry, wrong deployment, and attempts to join a second group.
- [x] Keep joining the group separate from participation in any order.
- [x] Add owner member-list, promote-organizer, demote-organizer, and remove-member actions with audit events.
- [x] Add equivalent member onboarding on Android and iPhone PWA.
- [ ] Commit as `feat: add private group onboarding`.

### Task 3.3: Implement platform-admin requests and approval surfaces (V1-05, V1-06)

**Files:**

- Create admin-request contracts, use cases, routes, and admin pages
- Create limited mobile admin approval components
- Test: permission-matrix and duplicate-decision tests

- [ ] Allow a group owner to submit one pending platform-admin request.
- [ ] Allow an existing platform admin to approve or reject it once.
- [ ] Assign the first platform admin through an explicit development/operations command, not public UI.
- [ ] Limit mobile admin to approval, refresh-failure review, and restaurant pause actions.
- [ ] Prove members and organizers cannot access platform-admin operations.
- [ ] Commit as `feat: implement role approval workflows`.

**Phase 3 exit:** Invited users can sign in on both clients, join exactly one group, and receive only authorized capabilities.

## 10. Phase 4 — Private Files and Reviewed Catalog

### Service gate: connect development R2

Create a private development bucket and bucket-scoped credentials. Add only server credentials to local/Vercel development. Keep public access disabled.

### Task 4.1: Implement private signed uploads and file metadata (V1-07)

**Files:**

- Create focused modules in `packages/storage/src/`
- Create file use cases and signed-upload API routes in `apps/web/`
- Test: object-key, authorization, MIME, size, and finalization tests

- [ ] Define allowed purposes: menu thumbnail, receipt, import source, and validation report.
- [ ] Generate unpredictable object keys without names or email addresses.
- [ ] Validate owner, purpose, MIME type, and size before signing.
- [ ] Finalize database metadata only after object existence is verified.
- [ ] Issue short-lived authorized download URLs.
- [ ] Prove failed uploads do not create finalized file records.
- [ ] Commit as `feat: add private file storage`.

### Task 4.2: Build import parsing and validation (V1-08)

**Files:**

- Create: catalog import schemas and parser modules under `packages/contracts/src/catalog/` and `packages/domain/src/catalog/`
- Create: import application services and routes under `apps/web/`
- Test: valid JSON, valid CSV, malformed rows, duplicates, money, hierarchy, and rollback fixtures

- [ ] Define one canonical import model for JSON and CSV inputs.
- [ ] Parse external content as untrusted data with row-level errors.
- [ ] Validate restaurant, exact branch, menu hierarchy, integer prices, availability, variants, and modifiers.
- [ ] Store the source file, draft, validation result, and audit event without publishing invalid input.
- [ ] Preserve the previous published menu on every failure.
- [ ] Commit as `feat: validate catalog imports`.

### Task 4.3: Build desktop draft comparison and publication (V1-08)

**Files:**

- Create admin import list, upload, validation, comparison, and publication pages
- Create publication use case and transaction
- Test: admin E2E and publication transaction tests

- [ ] Show added, changed, unavailable, suspiciously removed, and structurally changed records.
- [ ] Require an explicit review action before initial publication.
- [ ] Publish a new immutable menu version transactionally.
- [ ] Prevent publication by non-admins and duplicate publication on retries.
- [ ] Verify dense desktop table/detail behavior and responsive error review.
- [ ] Commit as `feat: add reviewed catalog publication`.

### Task 4.4: Build member catalog browsing (V1-10)

**Files:**

- Create catalog list, branch detail, menu, loading, empty, stale, and unavailable states in both clients
- Create typed catalog read routes and queries
- Test: API integration, mobile components, web components, and Playwright flows

- [ ] Return only the latest published menu to members.
- [ ] Support restaurant search, exact branch selection, categories, items, variants, modifiers, availability, and cached thumbnails.
- [ ] Show stale-data and refresh-failure warnings while keeping usable menu data visible.
- [ ] Use food subtotal language only where price totals are shown.
- [ ] Commit as `feat: add published catalog browsing`.

**Phase 4 exit:** An admin can publish a reviewed menu and an invited member can browse it on Android and iPhone PWA.

## 11. Phase 5 — Favorites and Group Defaults

### Task 5.1: Implement three ranked complete combinations (V1-11)

**Files:**

- Create favorite repositories, use cases, routes, and screens in both clients
- Test: rank replacement, configuration, ownership, and unavailable-item cases

- [ ] Let a member build a combination from multiple items, quantities, variants, modifiers, and notes.
- [ ] Validate the combination against the currently published branch menu.
- [ ] Save ranks 1–3 and require an explicit replacement target for a fourth combination.
- [ ] Reorder ranks transactionally without temporary uniqueness violations.
- [ ] Mark affected combinations unavailable after a menu change without deleting them.
- [ ] Prove one member cannot read or mutate another member's private favorites.
- [ ] Commit as `feat: add ranked favorite combinations`.

### Task 5.2: Implement group delivery-address management (V1-12)

**Files:**

- Create address contracts, repositories, use cases, routes, and owner/organizer UI
- Test: owner permissions, organizer read access, validation, and snapshot behavior

- [ ] Let the group owner save one default delivery address.
- [ ] Let an organizer choose the default or provide an order-specific override while creating an order.
- [ ] Copy the selected address into the order so later edits do not change history.
- [ ] Avoid sending exact address data to users who are not selected for the order unless their role requires it.
- [ ] Commit as `feat: add group delivery address`.

**Phase 5 exit:** Members can prepare reusable food choices, and organizers have the address prerequisite for an order.

## 12. Phase 6 — Order Creation and Restaurant Resolution

### Task 6.1: Build draft order creation (V1-12)

**Files:**

- Create order-draft use cases, routes, queries, and organizer screens
- Test: participant, address, restaurant mode, deadline, and authorization cases

- [ ] Select explicit participants from current group members; do not auto-enroll the group.
- [ ] Select the default or overridden delivery address.
- [ ] Set the initial fallback restaurant and exact branch.
- [ ] Choose voting disabled, shortlist, or global catalog.
- [ ] Set restaurant and food deadlines with ordering and future-time validation.
- [ ] Save drafts without scheduling jobs or notifying participants.
- [ ] Commit as `feat: add draft order creation`.

### Task 6.2: Start an order and implement restaurant voting (V1-13)

**Files:**

- Create start-order and vote use cases, routes, queries, and active-order UI
- Test: all threshold, eligibility, duplicate, late, and retry cases

- [ ] On start, snapshot participants and the initial restaurant, and record the organizer's initial vote.
- [ ] Move voting-disabled orders directly to Food Confirmation.
- [ ] For voting orders, accept one replaceable vote per selected participant before the deadline.
- [ ] Limit choices according to shortlist or global mode.
- [ ] Show stage, deadline, response count, and fallback consequence on every active-order view.
- [ ] Resolve exactly once using the proven domain policy.
- [ ] Commit as `feat: add restaurant selection stage`.

### Service gate: connect development QStash

Use the local QStash development server when possible, then configure preview signing keys and token. Do not schedule production work yet.

### Task 6.3: Implement signed, idempotent deadline jobs (V1-15)

**Files:**

- Create focused modules in `packages/jobs/src/`
- Create QStash callback routes in `apps/web/app/api/jobs/`
- Test: signature, duplicate delivery, stale callback, retry, and transaction tests

- [ ] Publish one-time restaurant and food deadline callbacks only after the order-start transaction succeeds.
- [ ] Verify both current and next QStash signing keys.
- [ ] Persist idempotency keys and callback attempts.
- [ ] Re-read authoritative order state and deadline inside the handler.
- [ ] Make duplicate, early, late, and already-completed deliveries safe.
- [ ] Add reminder scheduling without making reminder delivery part of state correctness.
- [ ] Commit as `feat: automate order deadlines safely`.

**Phase 6 exit:** An organizer can start an order, participants can vote, and the restaurant resolves correctly by action or signed deadline callback.

## 13. Phase 7 — Food Confirmation and Organizer Resolution

### Task 7.1: Start food confirmation with Rank 1 preselection (V1-14)

**Files:**

- Create food-confirmation use cases, routes, queries, and participant screens
- Test: valid, unavailable, changed, declined, and unselected-participant cases

- [ ] Preselect each selected member's valid Rank 1 for the winning branch.
- [ ] Explain clearly that the valid Rank 1 will be included at the deadline unless changed or declined.
- [ ] Let a member confirm the preselection, choose another saved combination, build a new one, or decline.
- [ ] Capture current menu configuration and price references for validation.
- [ ] Reject responses from non-participants and after final resolution.
- [ ] Commit as `feat: add food confirmation stage`.

### Task 7.2: Resolve the food deadline and organizer exceptions (V1-14)

**Files:**

- Create deadline resolution and organizer-choice use cases, routes, and UI
- Test: non-response, missing favorite, unavailable favorite, organizer selection, and readiness tests

- [ ] Include valid Rank 1 for a non-responder at the deadline.
- [ ] Put missing or invalid cases into an explicit unresolved queue.
- [ ] Let the organizer choose a valid combination or mark the participant as not ordering.
- [ ] Preserve who made each selection and whether it was automatic, member-confirmed, or organizer-chosen.
- [ ] Block Ready for Handoff until every selected participant is resolved.
- [ ] Commit as `feat: resolve food selections`.

**Phase 7 exit:** Every selected participant has a valid, declined, or organizer-resolved food result with an auditable source.

## 14. Phase 8 — Handoff, Completion, Receipts, and History

### Task 8.1: Build the consolidated handoff (V1-17)

**Files:**

- Create handoff application service, read route, and organizer screens in both clients
- Test: consolidation, copy text, subtotal, accessibility, and Grab-link fallback

- [ ] Snapshot validated selections into immutable order lines before handoff.
- [ ] Consolidate identical configured lines while preserving a per-member breakdown.
- [ ] Label every total as food subtotal and state that Grab fees, discounts, and promotions are excluded.
- [ ] Produce deterministic copyable text with branch, delivery address, consolidated lines, member detail, and subtotal.
- [ ] Attempt an approved branch URL or generic Grab opening behavior without claiming cart transfer.
- [ ] Keep the handoff readable and copyable when opening Grab fails.
- [ ] Commit as `feat: add manual Grab handoff`.

### Task 8.2: Record Ordered or Cancelled and optional receipt (V1-18)

**Files:**

- Create completion use cases, routes, receipt upload UI, and result screens
- Test: transition, receipt authorization, duplicate completion, and failure cases

- [ ] Allow the organizer to explicitly choose Ordered or Cancelled.
- [ ] Never infer completion from app foregrounding, link opening, or elapsed time.
- [ ] Upload an optional receipt through the signed R2 flow and attach metadata transactionally.
- [ ] Make repeated completion calls idempotent and audit the actor and timestamp.
- [ ] Commit as `feat: record manual order completion`.

### Task 8.3: Build immutable order history (V1-18)

**Files:**

- Create history queries, routes, list/detail screens, and authorized receipt download
- Test: snapshot immutability, participant visibility, admin audit access, and pagination

- [ ] Show branch, address snapshot, participants, selections, captured prices, food subtotal, organizer, status, and timestamps.
- [ ] Limit visibility to the organizer and selected participants, except explicit platform-admin support/audit access.
- [ ] Prove later menu, membership, role, favorite, and address changes do not mutate history.
- [ ] Commit as `feat: add permanent order history`.

### Task 8.4: Offer organizer-chosen food as a proposed favorite (V1-19)

**Files:**

- Create proposal use cases, routes, notification record, and member approval UI
- Test: approval, rejection, rank replacement, stale menu, and ownership cases

- [ ] Create a proposal only after order completion and only for organizer-chosen food.
- [ ] Require the member to approve, reject, and if necessary choose a rank to replace.
- [ ] Revalidate availability before saving the favorite.
- [ ] Keep rejection from changing history.
- [ ] Commit as `feat: propose organizer choices as favorites`.

**Phase 8 exit:** The real-world loop ends in a manual Grab handoff, explicit result, optional receipt, and permanent history.

## 15. Phase 9 — Refresh Operations and Notifications

### Task 9.1: Build weekly supervised refresh operations (V1-09)

**Files:**

- Create refresh queue policies, repositories, use cases, routes, jobs, and admin screens
- Test: all-restaurants scheduling, pause, failure, stale fallback, risk classification, and publication

- [ ] Keep every imported restaurant due weekly unless a platform admin explicitly pauses it.
- [ ] Schedule a recurring reminder that creates or updates refresh work; never scrape in the backend.
- [ ] Accept new supervised import files and compare them with the last published version.
- [ ] Auto-publish ordinary price and availability changes only when the approved risk classifier marks them safe.
- [ ] Require review for suspicious removals and major structural changes.
- [ ] Retain old published data and show a refresh failure when collection or import fails.
- [ ] Expose failure review and pause actions in limited mobile admin.
- [ ] Commit as `feat: add supervised catalog refresh`.

### Service gate: connect development OneSignal and Expo development build

Configure Android through FCM in OneSignal, configure the exact preview PWA origin, and create an Expo development build because native OneSignal modules do not work in Expo Go. Use development users only.

### Task 9.2: Create provider-neutral notification events (V1-16)

**Files:**

- Create event types and OneSignal adapter under `packages/notifications/src/`
- Create notification application services, routes, and in-app center UI
- Test: audience, event creation, provider failure, and retry tests

- [ ] Define events for invitation/access, order started, voting reminder/result, food reminder, organizer unresolved work, ready for handoff, completion, refresh failure, and favorite proposal.
- [ ] Persist the in-app notification before attempting push delivery.
- [ ] Map OneSignal External ID to the stable internal user ID after sign-in.
- [ ] Log provider attempts and identifiers without rolling back valid product transitions.
- [ ] Make event creation idempotent so job retries do not spam users.
- [ ] Commit as `feat: add notification delivery and history`.

### Task 9.3: Complete Android and iPhone notification onboarding (V1-16, V1-20)

**Files:**

- Create mobile permission flow and device adapter
- Create PWA installation and web-push guidance
- Create stable OneSignal worker path under `apps/web/public/push/onesignal/`
- Test: permission denied, delayed enablement, logout, user switch, and installed-PWA behavior

- [ ] Ask for notification permission only after a clear user action.
- [ ] Explain that iPhone web push requires a supported iOS version and Home Screen installation.
- [ ] Separate the OneSignal worker path from the PWA service worker and test update behavior.
- [ ] Log out the device identity on account sign-out or switch.
- [ ] Keep the in-app notification center usable when push permission is denied.
- [ ] Commit as `feat: complete push onboarding`.

**Phase 9 exit:** Deadline and catalog events are visible in-app and delivered through tested Android and installed-iPhone push paths without controlling workflow correctness.

## 16. Phase 10 — Release Hardening, Private Distribution, and Cost Controls

### Task 10.1: Complete accessibility and failure-state verification (V1-22)

**Files:**

- Modify affected screens and components based on audit findings
- Create accessibility and failure-state test suites and a manual verification checklist

- [ ] Audit accessible names, focus, dialog behavior, contrast, dynamic text, touch targets, and status communication without color-only meaning.
- [ ] Verify loading, empty, stale, unavailable, validation, permission, offline/retry, and provider-failure states across both clients and admin.
- [ ] Verify English-only application copy and exact preservation of imported names.
- [ ] Verify all active-order screens show stage, deadline, participant status, and no-response consequence.
- [ ] Commit as `fix: harden accessibility and failure states`.

### Task 10.2: Run complete security and authorization verification (V1-22)

**Files:**

- Create authorization matrix tests, security regression tests, and release checklist
- Modify only root-cause failures found by tests

- [ ] Test every role against every mutation and private read route.
- [ ] Test invitation, webhook, upload, callback, and receipt authorization boundaries.
- [ ] Scan built client assets for server variable names and secret-like values.
- [ ] Verify signed URL expiry and object-prefix isolation.
- [ ] Verify QStash signature rejection and idempotent retries.
- [ ] Verify audit and history records cannot be hard-deleted through product APIs.
- [ ] Commit as `test: verify V1 security boundaries`.

### Task 10.3: Execute end-to-end V1 scenarios (V1-22)

**Files:**

- Create Playwright web scenarios, Android test checklist/automation, and cross-platform result fixtures

- [ ] Prove admin import → publication → member browse → favorite creation.
- [ ] Prove invitation → sign-in → explicit participant selection.
- [ ] Prove voting disabled, shortlist, global voting, exact-50% win, tie fallback, and no-threshold fallback.
- [ ] Prove Rank 1 default, member change, decline, unavailable favorite, non-response, and organizer resolution.
- [ ] Prove handoff consolidation, copy fallback, Ordered, Cancelled, receipt, history, and favorite proposal.
- [ ] Prove Android push and installed iPhone PWA push with matching internal user identity.
- [ ] Record evidence and fix root causes before release work continues.
- [ ] Commit as `test: cover the complete V1 order loop`.

### Service gate: create production environments only after all development/preview checks pass

Create isolated production Neon, Better Auth, Google OAuth, R2, OneSignal, QStash, Vercel, and EAS configuration. Decide whether to purchase a custom domain before final Google callback, OneSignal web, and QStash destination configuration. Never copy development secrets into production.

### Task 10.4: Produce and verify the private Android APK (V1-21)

**Files:**

- Create/modify: `apps/mobile/eas.json`, release documentation, and installation checklist

- [ ] Configure EAS development, preview, and production profiles.
- [ ] Confirm the permanent Android package is `ordahplease.app`.
- [ ] Build a preview APK and install it on at least one representative Android device.
- [ ] Verify sign-in callback, notification registration, camera/file receipt selection, copy, and outgoing Grab behavior.
- [ ] Build the production private APK only after preview acceptance.
- [ ] Record version, checksum, intended recipients, and rollback build.
- [ ] Commit as `release: prepare private Android distribution`.

### Task 10.5: Verify iPhone PWA and web admin production behavior (V1-20, V1-22)

**Files:**

- Create/modify PWA manifest, icons, service worker configuration, installation guidance, and release checklist

- [ ] Verify install from Safari, standalone launch, authentication return, cache update, push opt-in, file upload, copy, and external Grab opening.
- [ ] Verify responsive member experience and dense desktop admin behavior separately.
- [ ] Verify web push remains scoped to the final production origin.
- [ ] Commit as `release: prepare PWA and admin deployment`.

### Task 10.6: Add free-tier monitoring and upgrade triggers (V1-23)

**Files:**

- Create: `context/operations/free-tier-monitoring.md`
- Modify when necessary: `context/services.md`, `context/progress-tracker.md`

- [ ] Record current free-tier limits and dashboard locations for each provider at release time.
- [ ] Reverify and update `context/service-limits.md` warning thresholds for database/storage, bandwidth, function execution, QStash messages, OneSignal subscribers/messages, Google OAuth policy, GitHub Actions, and EAS builds.
- [ ] Assign a person and monthly review cadence.
- [ ] State that crossing a warning threshold requires review and does not authorize a paid upgrade.
- [ ] Commit as `docs: add free-tier operating guardrails`.

**Phase 10 exit:** V1 passes security, accessibility, failure, cross-platform, and end-to-end checks; production environments are isolated; the Android APK and iPhone PWA are ready for the invited group.

## 17. Dependency and Service Connection Summary

| Connect when | Service | Why now | Do not do yet |
| --- | --- | --- | --- |
| Phase 2 | Neon development | Schema and transaction tests require real PostgreSQL behavior | Do not connect clients or create production data |
| Phase 3 | Vercel preview | Supplies stable HTTPS routes for auth and later callbacks | Do not treat preview as production |
| Phase 3 | Better Auth and Google OAuth development | Enables real Google identity plus web and Expo sessions | Do not use Better Auth Infrastructure or store roles in auth tables |
| Phase 4 | R2 development | Catalog sources, thumbnails, reports, and receipts need private bytes | Do not enable public bucket access |
| Phase 6 | QStash local/preview | Restaurant and food deadlines now exist | Do not let jobs write directly to Neon |
| Phase 9 | OneSignal development | Product events and recipient identities now exist | Do not make push delivery workflow-critical |
| Phase 9 | Expo EAS development | Native OneSignal testing requires a development build | Do not distribute a production APK |
| Phase 10 | All production environments | Preview behavior has passed full verification | Do not reuse development credentials |

## 18. Milestones and Demonstrable Outcomes

1. **Foundation demo:** Both empty apps run with shared visual tokens and CI.
2. **Rules demo:** Voting, Rank 1, transitions, and totals pass deterministic tests.
3. **Access demo:** An invited user signs in and joins one group on both clients.
4. **Catalog demo:** An admin publishes a reviewed menu and a member browses it.
5. **Preparation demo:** A member saves three ranked combinations; an owner saves the group address.
6. **Restaurant-stage demo:** An organizer starts an order and voting resolves correctly.
7. **Food-stage demo:** Defaults, changes, declines, and organizer resolutions reach handoff readiness.
8. **Completion demo:** The organizer copies the handoff, opens Grab, records a result, and views history.
9. **Operations demo:** Refresh reminders and push/in-app notifications work without damaging state on failure.
10. **Release candidate:** Android APK, installed iPhone PWA, and desktop admin pass the full V1 test matrix.

## 19. Risks and Controls

| Risk | Control in this plan |
| --- | --- |
| Too many services obscure product bugs | Pure rules and local shells are built before provider integration |
| Cross-client rules drift | Domain and contracts are shared; clients never reimplement workflow decisions |
| Deadline retries duplicate transitions or alerts | Signed callbacks, persisted idempotency keys, and authoritative state rechecks |
| Menu refresh destroys usable data | Immutable versions and last-published fallback |
| History changes after catalog or membership edits | Snapshot fields and no hard delete of referenced data |
| A client leaks a secret | Server-only environment parsing, client-bundle scan, and no direct provider access |
| iPhone push fails because PWA is not installed | Explicit installation guidance and in-app notifications as the reliable fallback |
| Grab link behavior varies | Deterministic copyable handoff remains required |
| Free tiers change before release | Recheck live limits during Phase 10 and require approval before any paid upgrade |

## 20. Plan Self-Review Result

- **Specification coverage:** V1-01 through V1-23 each map to at least one named task above.
- **Scope:** Public registration, multiple groups, payment, automatic Grab ordering, unattended scraping, recommendations, chat, delivery tracking, promotions, and final-fee estimation remain excluded.
- **Open decisions:** Custom domain and exact Grab link behavior are deferred to their safe decision points and have non-blocking fallbacks.
- **Security:** No task requires a client-side secret or direct client connection to a privileged provider.
- **Implementation state:** The user approved the V1 implementation on 2026-07-21. Phase 0 is authorized, beginning with the single-owner workspace foundation before parallel worktrees are created.
