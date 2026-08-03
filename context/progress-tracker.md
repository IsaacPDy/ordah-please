# Progress Tracker

Current product state and remaining journey bundles only. Completed numbered-task evidence stays in [`context/history/`](history/).

## Current Phase

- V1-01 through V1-06 remain complete and squash-merged to `main`.
- The approved member and admin UI baseline is now coded with realistic mock data on web/PWA and native mobile.
- The UI baseline is presentation only. Multiple-group persistence, effective permission enforcement, restaurant data, order actions, uploads, notifications, and background work are not connected yet.

## Current Goal

Start with **Multi-group foundation**. It changes the old one-group data and authorization boundary that every later group, order, and permission journey depends on.

## Completed Product History

- [x] V1-01 Initialize the TypeScript monorepo, shared tooling, Expo Android app, and Next.js web app
- [x] V1-02 Define shared API contracts and provider-neutral domain types
- [x] V1-03 Create the Neon schema, migrations, pooled database access, and immutable audit model
- [x] V1-04 Integrate Clerk Google sign-in across Android and web and map identities into Neon
- [x] V1-04A Replace Clerk authentication with Better Auth on Neon
- [x] V1-05 Implement invitation-only access, one-group membership, owners, organizers, members, and admin requests
- [x] V1-06 Implement platform-admin approval and limited mobile-admin permissions

## Journey Bundles

The dependency label states whether a bundle is sequential or may run separately after its prerequisite is complete.

### Foundation sequence

- [ ] **Multi-group foundation** — First and sequential. Migrate one-group membership to multiple memberships, rename Organizer to Manager, preserve existing users/invitations/audit history, and enforce one Group Owner per group.
- [ ] **Effective permissions and account overrides** — Sequential after Multi-group foundation. Define every action permission, calculate role defaults plus account-wide grants/blocks atomically, protect the Platform Admin account, and audit every change.
- [ ] **Group membership journey** — Sequential after Effective permissions. Connect invitations, direct admin assignment, Manager acceptance, leave/remove/rejoin, suspension, archive, group detail, and member management.

### Can proceed separately after Multi-group foundation

- [ ] **Restaurant catalog and Favorites journey** — Separate. Connect global browsing before membership, filters, exact branch menus, three ranked combinations, edit/removal confirmation, and admin-configurable rank limit.
- [ ] **Private files and import journey** — Separate. Add private R2 signed uploads and metadata, then connect JSON/CSV validation, draft comparison, publication, receipts, and audit history.
- [ ] **Platform Admin operations journey** — Separate after Effective permissions. Connect Overview, Users and Permissions, Groups, Catalog, Imports, Refresh Queue, Access Requests, and Audit Log; keep mobile admin limited to Groups, Catalog, Access Requests, and Audit Log.

### Order sequence

- [ ] **Order setup and participant journey** — Sequential after Group membership and Restaurant catalog. Connect group address/default override, participant selection, initial restaurant, choice mode, deadlines, fallback, and member-receipt setting.
- [ ] **Restaurant voting journey** — Sequential after Order setup. Connect selected-participant voting, 50% threshold, initial-restaurant fallback, ties, deadline state, and manual missed-deadline resolution.
- [ ] **Food confirmation journey** — Sequential after Restaurant voting. Connect Rank 1 automatic inclusion, opt-out/change, new combinations, unavailable food, and Manager resolution.
- [ ] **Handoff and completion journey** — Sequential after Food confirmation. Connect consolidated lines, member breakdown, food subtotal, copyable text, Grab handoff, and Ordered or Cancelled completion.
- [ ] **Receipts, history, and post-order Favorites journey** — Sequential after Handoff. Connect full-order receipts, optional member receipts, immutable order snapshots, filters, and approval of Manager-selected food as a Favorite.

### Operational sequence

- [ ] **Catalog refresh journey** — Sequential after Private files and import journey. Connect weekly supervised refresh, pause, comparisons, stale fallback, risk review, and failure recovery.
- [ ] **Deadlines and notifications journey** — May run separately after Order setup contracts stabilize. Connect QStash callbacks/retries/idempotency, OneSignal Android and web push, and in-app notification history.
- [ ] **Client delivery journey** — Sequential after the full member order loop. Complete iPhone PWA installation/notification guidance and private Android APK workflow.
- [ ] **Release verification journey** — Final and sequential. Verify security, discoverable admin authorization, accessibility, loading/empty/error/denied/suspended states, browser/PWA behavior, Android emulator behavior, production behavior, and free-tier monitoring.

## Completion Evidence

- Web/PWA bundles require focused automated tests, lint, type checking, production build, and browser verification.
- Native-mobile bundles require focused automated tests, lint, type checking, and Android emulator verification.
- Persistence or provider bundles additionally require migration/provider integration tests without exposing secrets.
- A UI screen using mock data does not count as connected journey completion.

## Open Product Decisions

- Choose whether to purchase a custom domain or use the free Vercel domain.
- Confirm the exact Grab branch-link behavior available during implementation; copyable handoff remains required.

## Out of Scope

- Automatic Grab cart, checkout, payment, or order placement
- In-app payment collection or repayment tracking
- Unattended menu scraping
- Multi-delivery-platform collection
- Restaurant recommendation AI, dietary matching, chat, delivery tracking, promotions, and final-fee estimation
