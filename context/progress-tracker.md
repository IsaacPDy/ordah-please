# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- V1 product definition, architecture, and visual direction approved.
- V1 context documentation created.
- V1 implementation approved on 2026-07-21.
- Phase 0 repository and local-quality foundation in progress.

## Current Goal

- Complete Task 0.2: establish real test infrastructure and continuous-integration gates before feature behavior begins.

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
- [x] Product-focused root `README.md` drafted
- [x] V1 context review and correction
- [x] V1 implementation plan documented in `context/specs/01-v1-implementation-plan.md`
- [x] V1 implementation plan approved
- [x] V1 implementation plan categorized into eight branch-owned workstreams
- [x] V1-01 Task 0.1 shared workspace shell

## In Progress V1 Tasks

- [ ] V1-01 Task 0.2 shared tests and continuous integration

## Pending V1 Implementation Tasks

- [ ] V1-01 Initialize the TypeScript monorepo, shared tooling, Expo Android app, and Next.js web app
- [ ] V1-02 Define shared API contracts and provider-neutral domain types
- [ ] V1-03 Create the Neon schema, migrations, pooled database access, and immutable audit model
- [ ] V1-04 Integrate Clerk Google sign-in across Android and web and map identities into Neon
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
- Use Clerk for identity only; do not use Clerk Organizations.
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
- Twelve moderate transitive advisories remain in the current official Next.js and Expo dependency trees. Forced audit fixes are prohibited because npm proposes architecture-breaking major downgrades; adopt compatible upstream patches when available.
- Added a product-only root `README.md` that summarizes the approved purpose, capabilities, order flow, and manual Grab checkout boundary.
