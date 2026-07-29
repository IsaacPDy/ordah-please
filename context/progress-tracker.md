# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- V1 product definition, architecture, and visual direction approved.
- V1 context documentation created.
- V1 implementation approved on 2026-07-21.
- Phase 0 repository and local-quality foundation complete.
- Phase 1 provider-free contracts and domain rules complete.
- Phase 2 Neon data foundation complete.
- The development Neon service-account gate is satisfied locally without committing credentials.

## Current Goal

- Replace Clerk with self-hosted Better Auth on Neon, verify the corrected authentication boundary on web and Android, retire Clerk, and then reconstruct V1-05 from the preserved recovery branch.

## Completed V1 Tasks

- [x] V1 product idea and primary-user definition
- [x] V1 core order workflow decisions
- [x] V1 roles and access model decisions
- [x] V1 catalog import and refresh decisions
- [x] V1 platform and distribution decisions
- [x] V1 backend architecture selection
- [x] V1 cost target and provider responsibility mapping
- [x] V1 context documentation
- [x] V1 final display name: `ordah please`
- [x] V1 technical project slug: `ordah-please`
- [x] V1 Android application ID and namespace: `ordahplease.app`
- [x] V1 Option 1 visual direction selected
- [x] V1 corrected Option 1 reference saved at `context/assets/ordah-please-option-1.png`
- [x] V1 English-only application-authored language rule
- [x] V1 service setup tutorial and variable registry in `context/services.md`
- [x] V1 service-limit and explicit-upgrade register in `context/service-limits.md`
- [x] Product-focused root `README.md` drafted
- [x] V1 context review and correction
- [x] V1 implementation plan documented in `context/specs/01-v1-implementation-plan.md`
- [x] V1 implementation plan approved
- [x] V1 implementation plan categorized into eight branch-owned workstreams
- [x] V1-01 Task 0.1 shared workspace shell
- [x] V1-01 Task 0.2 shared tests and continuous integration
- [x] V1-01 Task 0.3 shared visual foundation and navigation shells
- [x] V1-02 Task 1.1 shared domain primitives and API envelopes
- [x] V1-02 Task 1.2 menu, favorite, order, vote, and history contracts
- [x] V1-02 Task 1.3 pure business policies
- [x] V1-03 Task 2.1 initial Neon schema and generated migration
- [x] V1-03 Task 2.2 pooled database composition, repositories, and transactions
- [x] V1-03 Task 2.3 deterministic and development-safe database fixtures

## In Progress V1 Tasks

- V1-04A is active on `task/V1-04A-better-auth-migration` from reviewed V1-04 `main`. The approved design replaces Clerk with self-hosted Better Auth, keeps Google as the only V1 sign-in method, stores auth tables separately from product users, preserves Neon-owned roles and history, removes the external identity webhook, and uses same-origin web cookies plus SecureStore-backed Expo cookies.
- Documentation-first migration work is complete: permanent architecture, UI, service, environment, coding, workflow, product-design, implementation-plan, and service-limit records now describe Better Auth and the Google OAuth boundary. Vercel preview, Android device acceptance, and final integration remain.
- Better Auth dependencies are pinned at `1.6.25`, and RED-first schema tests now pass for the four UUID-keyed auth tables, normalized email uniqueness, nullable one-to-one product mapping, and explicit cascade/set-null deletion behavior. Generated migration `0002_adorable_lily_hollister.sql` adds the new tables and mapping, drops `clerk_user_id`, and leaves `0000`/`0001` unchanged.
- Provider-neutral identity provisioning now creates or reuses one product user on the first authenticated request, preserves archived users, and loads Neon roles before input validation. A guarded development link command requires explicit confirmation and writes an existing auth-to-product link with its audit event in one transaction without printing record or credential values.
- Better Auth server routing, strict environment parsing, trusted session verification, Google-only web auth, and SecureStore-backed Expo auth now pass focused provider-free tests and web/mobile type checks. Clerk runtime packages, middleware, and webhook code are removed.
- The local pooled and direct database URLs now resolve to Neon branch `development` and its distinct compute. Migration `0002` was applied there transactionally through the visible Neon SQL Editor; all four auth tables, constraints, nullable product link, removed Clerk column, preserved product counts, and journal entry 3 with the repository hash were verified. Production was not migrated.
- The complete provider-backed matrix passes 41 files and 178 tests against rollback-only temporary schemas on the development branch. Local Better Auth URL, secret length, Google client match, and Google secret presence validate without displaying values.
- Google OAuth is External and Testing with one approved test account, only `openid`, email, and profile scopes, and the localhost plus production redirect URIs registered. A visible-browser localhost sign-in completed the Google chooser, consent, Better Auth callback, and same-origin return without an authentication error.
- The live localhost acceptance created exactly one Better Auth user, Google account, and active session in the development Neon branch while preserving all three existing product users. No product identity was linked because the acceptance did not call a protected product API; V1-05 invitation acceptance will exercise and verify first-request product provisioning.
- Final local verification passes 41 provider-backed files with 178 tests against rollback-only development schemas, 172 provider-free Vitest tests, 13 mobile Jest tests, every workspace type check and lint check, Drizzle validation, every package and Next.js production build, Android Expo export, dependency-tree validation, and web/mobile built-client secret scans. Pruning removed stale installed Clerk packages; only optional native runtime helpers remain marked extraneous by npm.

## Pending V1 Implementation Tasks

- [x] V1-01 Initialize the TypeScript monorepo, shared tooling, Expo Android app, and Next.js web app
- [x] V1-02 Define shared API contracts and provider-neutral domain types
- [x] V1-03 Create the Neon schema, migrations, pooled database access, and immutable audit model
- [x] V1-04 Integrate Clerk Google sign-in across Android and web and map identities into Neon
- [ ] V1-04A Replace Clerk authentication with Better Auth on Neon
- [ ] V1-05 Implement invitation-only access, one-group membership, owners, organizers, members, and admin requests
- [ ] V1-06 Implement platform-admin approval and limited mobile-admin permissions
- [ ] V1-07 Implement R2 private storage, direct signed uploads, and file metadata
- [ ] V1-08 Build JSON/CSV catalog import, validation, draft review, publication, and audit history
- [ ] V1-09 Build weekly supervised refresh for every imported restaurant, admin pause, comparisons, stale fallback, and risk-based publication
- [ ] V1-10 Build global restaurant browsing, branch detail, menu display, and stale-data warnings
- [ ] V1-11 Build three ranked favorite combinations, replacement, modifiers, quantities, and availability checks
- [ ] V1-12 Build group default delivery address, per-order override, order creation, participant selection, fallback restaurant, choice mode, and deadlines
- [ ] V1-13 Build restaurant voting, 50% threshold, organizer vote, fallback, tie handling, and deadline transition
- [ ] V1-14 Build food confirmation, Rank 1 automatic inclusion, opt-out, new combinations, and organizer resolution
- [ ] V1-15 Integrate QStash delayed jobs, reminders, signed callbacks, retries, and idempotency
- [ ] V1-16 Integrate OneSignal Android push, iPhone web push, and in-app notification history
- [ ] V1-17 Build consolidated item totals, per-member breakdown, food subtotal, copyable text, and Grab handoff
- [ ] V1-18 Build manual Ordered or Cancelled completion, optional receipt, and immutable order history
- [ ] V1-19 Build post-order favorite approval for organizer-chosen food
- [ ] V1-20 Complete iPhone PWA installation guidance and notification onboarding
- [ ] V1-21 Complete Android private APK build and installation workflow
- [ ] V1-22 Complete security, accessibility, failure-state, cross-platform, and end-to-end verification
- [ ] V1-23 Confirm free-tier monitoring and document upgrade triggers without enabling paid plans

## V2 / Out of Scope

- Public release or public registration
- Multiple groups per user
- Automatic Grab cart, checkout, payment, or order placement
- In-app payment collection or repayment tracking
- Unattended menu scraping
- Multi-delivery-platform collection
- Restaurant recommendation AI, dietary matching, chat, delivery tracking, promotions, and final-fee estimation

## Open V1 Decisions

- Choose whether to purchase a custom domain or use the free Vercel domain.
- Confirm the exact Grab branch-link behavior available during implementation; the copyable handoff remains the required fallback.

## Architecture Decisions

- Use split clients: Expo Android and Next.js iPhone PWA/admin.
- Use Vercel as the trusted API boundary.
- Use Neon PostgreSQL for relational product data and roles.
- Use Google OAuth for identity proof and self-hosted Better Auth for sessions; do not use Better Auth Infrastructure.
- Keep Better Auth records separate from product users and keep all product roles in Neon product tables.
- Use `context/service-limits.md` for current allowances and warning thresholds; no threshold authorizes paid usage.
- Use private Cloudflare R2 for images, receipts, and imports.
- Use OneSignal for Android and web-push delivery.
- Use QStash for deadline work and recurring reminders.
- Keep Computer Use external, supervised, and import-based.
- Keep Grab checkout manual and preserve an immutable history snapshot.
- Target USD 0 required monthly infrastructure cost during V1 prototype use.

## Session Notes

- All product and architecture decisions approved in the planning conversation are recorded in `context/`.
- Read `context/specs/00-v1-product-design.md` for the consolidated approved design.
- Read `context/specs/01-v1-implementation-plan.md` for the dependency-aware build sequence, service gates, verification requirements, and release milestones.
- The user approved implementation on 2026-07-21.
- Parallel implementation is organized into Foundation, UI, Domain/Contracts, Database, Backend/Access, Storage/Catalog, Jobs/Notifications, and Release/Quality workstreams.
- Task 0.1 remains single-owner because all later worktrees depend on its workspace and dependency baseline.
- Task 0.1 merged after independent review. Clean verification passed for `npm ci`, type checking, linting, current test commands, the Next.js production build, all shared-package builds, formatting, Expo Android export, and dependency-tree validation.
- Task 0.2 merged after test-first implementation and independent review. Vitest covers pure/server TypeScript, Jest with Expo and React Native Testing Library covers native components, Playwright provides separate member/admin browser projects, and GitHub Actions runs the provider-free quality gates.
- Task 0.2 RED evidence was observed for Vitest, native component rendering, Playwright, and workspace-relative test discovery before the corrected suites passed.
- Task 0.3 merged into the V1-01 branch after RED-first token, navigation, contrast, safe-area, heading, and font-failure tests plus independent review. The member and admin shells share semantic tokens while keeping their navigation structures separate.
- Task 0.3 live browser verification passed at 390 by 844 for the member PWA and 1440 by 900 for admin: navigation, active state, keyboard focus, minimum target sizes, overflow, heading structure, computed colors/fonts, and console logs were checked. Native Android pixel fidelity remains an explicit release-gate check; tests and Android export passed without claiming emulator/device visual proof.
- No external service account or login was required for V1-01.
- Task 1.1 merged into the V1-02 branch after independent review. Branded IDs, integer-centavo boundaries, UTC timestamp helpers, roles, API envelopes, stable errors, and pagination contracts are covered by focused tests. Follow-up regressions reject negative zero, preserve maximum safe-integer centavos exactly, and reject explicit `null` pagination values.
- The reconstructed cumulative V1-02 branch passed a clean `npm ci`, all workspace type checks and lint checks, 61 Vitest tests, 7 mobile Jest tests, every package build, the 11-route Next.js production build, formatting, and `git diff --check`.
- No external service account or login was required for V1-02 Task 1.1. The next service gate remains Neon after Tasks 1.2 and 1.3 complete the provider-free domain foundation.
- Task 1.2 added immutable catalog/menu-version, branch-scoped favorite, food-selection, and terminal order-history domain shapes plus strict response and mutation parsers that reject unknown fields without normalizing imported names. History captures exact restaurant, branch, per-member selection, price, variant, modifier, note, and handoff details even when the source favorite or menu later changes.
- Task 1.2 passed 78 shared/server tests, 7 mobile tests, all workspace type checks and lint checks, dependency-ordered domain/contracts builds, task-file formatting, and `git diff --check`. A separate clean-state check passed 72 shared-package tests with ignored domain build output absent, proving tests resolve workspace source after `npm ci`. No external service account or login was required.
- Task 1.2 was committed on branch `v1-02` as `cd76388 feat: define catalog and ordering contracts` before Task 1.3 moved to its own branch.
- Task 1.3 completed favorite replacement, selected-participant voting with an explicit replaceable organizer initial vote, food-deadline defaults and organizer-resolution detection, exhaustive order-state transitions, and deterministic handoff consolidation. Review fixes reject outsider votes, invalid participant sets, and unsafe consolidated quantities; all 36 state pairs are covered.
- Task 1.3 passed 50 focused policy tests, all 122 domain tests, 128 repository unit tests, 7 mobile tests, all workspace type checks and lint checks, formatting, every package build, the 11-route Next.js production build, and `git diff --check`. Inline re-review found no remaining Critical or Important issue. No external service account or login was required.
- Phase 1 is complete. The development Neon gate is satisfied with pooled `DATABASE_URL` and direct `DATABASE_MIGRATION_URL` values stored only in the gitignored local web environment; no credential value is committed.
- Repository history policy clarified: agents keep descriptive progress commits on unique subtask branches and worktrees, the integration owner combines them on one numbered task branch, and `main` receives exactly one squash commit named with the task's exact progress-tracker title. The next task branch starts from the updated `main`.
- Task 2.1 added 32 provider-neutral PostgreSQL tables for identity, group access, file metadata, versioned catalogs, ranked favorites, order snapshots, notifications, jobs, and immutable audits. One generated migration passes Drizzle validation and a rollback-only Neon integration test that proves foreign keys, uniqueness, checks, selected-participant voting, idempotency, and snapshot survival without leaving test data behind.
- Task 2.2 added strict server-only `DATABASE_URL` parsing, a lazy pooled Neon client, a reusable transaction boundary, and focused identity/access, catalog, favorite, order, file, notification, job, and audit repositories. Live temporary-schema tests prove pooled repository access and prove an order state change and its audit event commit or roll back together; the direct migration suite remains green.
- Task 2.3 added fixed English fictional users, one group, and a small reviewed menu plus a guarded development-only seed command. The live idempotency test runs the seed twice, deliberately changes a fixture between runs, proves the rerun restores it without adding rows, and cleans up its temporary Neon schema. Provider test files run sequentially when explicitly enabled so pooled temporary-schema state cannot collide.
- V1-03 was squash-merged to `main` as `d176bff V1-03 Create the Neon schema, migrations, pooled database access, and immutable audit model`; local `main` and `origin/main` were verified at that commit before V1-04 began.
- V1-04 uses the primary checkout on `task/V1-04-clerk-authentication`. The local Clerk publishable keys and server secret are present outside Git, and the Clerk webhook signing secret is saved only in the Vercel Preview environment without being displayed or committed.
- V1-04 Task 3.1 has RED-first focused tests for unauthenticated Clerk rejection, internal identity loading and role mapping, authorization denial, the required route-execution sequence, stable HTTP error mapping, and internal-detail suppression.
- V1-04 Task 3.1 now verifies real Standard Webhooks signatures through Clerk's backend API, rejects forged or malformed callbacks with a safe 400, returns a safe retryable 500 on synchronization failure, and maps `user.created`, `user.updated`, and `user.deleted` into timestamp-aware Neon upsert/archive commands. Live temporary-schema tests prove the unique audit claim and user upsert commit together, a retry creates neither a second audit event nor a second mutation, and an older delayed create cannot resurrect an already-deleted Clerk identity. Provider-mode test bodies use a 30-second timeout while local unit tests retain the 5-second default.
- V1-04 integrated verification passes 159 provider-free Vitest tests, 7 mobile Jest tests, 43 server tests with all Neon provider suites enabled, all workspace type checks and lint checks, Drizzle migration validation, every package build, the 13-route Next.js production build including `/api/webhooks/clerk`, task-owned formatting, whitespace validation, and a built-client scan with no server variable names.
- The development Neon database now has the complete 32-table V1-03 baseline and the V1-04 `audit_events.idempotency_key` migration recorded in Drizzle's two-entry ledger. An unrelated empty `public.branches` bootstrap artifact was verified to contain zero rows and removed before the repository migrations were applied and independently checked.
- Commit `3799ad1` deployed successfully to the V1-04 Vercel branch preview at `https://ordah-please-web-git-task-v1-04-clerk-authentication-isaacpdy.vercel.app`. Vercel Authentication returns 401 before unsigned webhook requests reach the route, so Clerk setup is paused until Preview receives an approved deployment-protection bypass or is deliberately made public.
- The user confirmed the dedicated Vercel automation bypass was created and `CLERK_WEBHOOK_SIGNING_SECRET` was saved without sharing either value. Commit `dfae2c0` deployed READY on the V1-04 branch preview with that Preview environment. Clerk's signed `user.created`, `user.updated`, and `user.deleted` examples each returned HTTP 200. A read-only Neon check found the three expected internal identities, the deletion archived, and one idempotent immutable audit row for each event type.
- V1-04A development migration verification used the visible Neon SQL Editor on branch `development`: the four Better Auth tables, constraints, nullable product link, removed Clerk column, preserved product rows, and third Drizzle journal entry were verified after the ordered migration. Production was not migrated.
- V1-04A Google acceptance used the visible Google Cloud and in-app browser surfaces. OAuth remains External and Testing with one approved test account and only basic identity scopes; localhost sign-in returned successfully through the Better Auth callback. The development database then contained one auth user, one Google account, and one active session without changing the three pre-existing product users.
- V1-04A local quality verification passes all provider-free and provider-backed suites, workspace type checks and lint checks, Drizzle validation, package and Next.js builds, Android Expo export, dependency policy, dependency-tree validation after pruning stale Clerk installs, and built-client secret scans.
- Thirteen production transitive advisories (11 moderate and 2 high) remain in the existing official Next.js and Expo dependency trees. The Drizzle and PostgreSQL additions introduced no production advisories. Forced audit fixes are prohibited because npm proposes architecture-breaking major downgrades; adopt compatible upstream patches when available.
- Added a product-only root `README.md` that summarizes the approved purpose, capabilities, order flow, and manual Grab checkout boundary.
