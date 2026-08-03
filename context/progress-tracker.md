# Progress Tracker

Current state and pending work only. Historical completion evidence, session notes, and per-task verification logs live in [`context/history/`](history/) — one file per task (`v1-XX.md`). Append to the matching file when a task is squash-merged to `main`.

Update this file when implementation changes the current goal or moves a pending task to done.

## Current Phase

- V1-06 platform-admin approval complete and squash-merged to `main`.
- V1-05 invitation-only access, roles, and admin-request submission complete and squash-merged to `main`.
- Next task: V1-07 R2 private storage, direct signed uploads, and file metadata. No task branch yet.

## Current Goal

Pick up V1-07 from the reviewed V1-06 `main` boundary: private Cloudflare R2 storage, direct signed uploads, and file metadata. V1-06B (mobile `/team` parity with the web owner surface) is a deferred follow-up and may be slotted before V1-22 verification at the user's discretion.

## V1 Implementation Tasks

- [x] V1-01 Initialize the TypeScript monorepo, shared tooling, Expo Android app, and Next.js web app
- [x] V1-02 Define shared API contracts and provider-neutral domain types
- [x] V1-03 Create the Neon schema, migrations, pooled database access, and immutable audit model
- [x] V1-04 Integrate Clerk Google sign-in across Android and web and map identities into Neon
- [x] V1-04A Replace Clerk authentication with Better Auth on Neon
- [x] V1-05 Implement invitation-only access, one-group membership, owners, organizers, members, and admin requests
- [x] V1-06 Implement platform-admin approval and limited mobile-admin permissions
- [ ] V1-06B Mobile `/team` parity with the web owner surface (deferred from V1-06)
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

## Architecture Decisions

- Use split clients: Expo Android and Next.js iPhone PWA/admin.
- Use Vercel as the trusted API boundary.
- Use Neon PostgreSQL for relational product data and roles.
- Use Google OAuth for identity proof and self-hosted Better Auth for sessions; do not use Better Auth Infrastructure.
- Keep Better Auth records separate from product users and keep all product roles in Neon product tables.
- Use `context/services/service-limits.md` for current allowances and warning thresholds; no threshold authorizes paid usage.
- Use private Cloudflare R2 for images, receipts, and imports.
- Use OneSignal for Android and web-push delivery.
- Use QStash for deadline work and recurring reminders.
- Keep Computer Use external, supervised, and import-based.
- Keep Grab checkout manual and preserve an immutable history snapshot.
- Target USD 0 required monthly infrastructure cost during V1 prototype use.

## Open V1 Decisions

- Choose whether to purchase a custom domain or use the free Vercel domain.
- Confirm the exact Grab branch-link behavior available during implementation; the copyable handoff remains the required fallback.

## V2 / Out of Scope

- Public release or public registration
- Multiple groups per user
- Automatic Grab cart, checkout, payment, or order placement
- In-app payment collection or repayment tracking
- Unattended menu scraping
- Multi-delivery-platform collection
- Restaurant recommendation AI, dietary matching, chat, delivery tracking, promotions, and final-fee estimation
