# Progress Tracker

Current state and remaining work. Completed bundle evidence lives in [`context/history/`](history/).

## Current Phase

- V1-01 through V1-06 and Multi-group foundation are merged to `main`.
- UI screens use mock data; persistence, permission enforcement, restaurant data, order actions, uploads, notifications, and background work remain deferred.

## Completed

- V1-01 Monorepo, Expo Android, Next.js web
- V1-02 Shared contracts and provider-neutral domain types
- V1-03 Neon schema, migrations, pooled access, immutable audit
- V1-04 Clerk Google sign-in (replaced by V1-04A)
- V1-04A Better Auth Google sign-in on Neon
- V1-05 Invitation-only access, one-group membership, roles, admin requests
- V1-06 Platform-admin approval and limited mobile-admin permissions
- Multi-group foundation — multi-membership, Manager rename, one active Owner per group, group-scoped authorization

## Journey Bundles

**Foundation** (sequential):

- [ ] Effective permissions and account overrides
- [ ] Group membership journey — after Effective permissions

**After Multi-group** (parallel):

- [ ] Restaurant catalog and Favorites
- [ ] Private files and import
- [ ] Platform Admin operations — after Effective permissions

**Order sequence** (after Group membership + Restaurant catalog):

- [ ] Order setup and participant → Restaurant voting → Food confirmation → Handoff and completion → Receipts, history, post-order Favorites

**Operational**:

- [ ] Catalog refresh — after Private files and import
- [ ] Deadlines and notifications — after Order setup contracts stabilize
- [ ] Client delivery — after the full order loop
- [ ] Release verification — final

## Completion Evidence

- Web/PWA: focused tests, lint, typecheck, production build, browser verification.
- Native mobile: focused tests, lint, typecheck, Android emulator verification.
- Persistence/provider: migration and provider integration tests without exposing secrets.
- Mock-data UI does not count as connected journey completion.

## Open Decisions

- Custom domain vs free Vercel domain.
- Exact Grab branch-link behavior; copyable handoff remains required.

## Out of Scope

Automatic Grab cart/checkout/payment/placement, in-app payment or repayment, unattended menu scraping, multi-platform collection, recommendation AI, dietary matching, chat, delivery tracking, promotions, fee estimation.
