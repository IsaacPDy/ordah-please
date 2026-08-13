# Progress Tracker

Current state and remaining work. Completed bundle evidence lives in [`context/history/`](history/).

## Current Phase

- V1-01 through V1-06 and Multi-group foundation are merged to `main`.
- Restaurant catalog import, admin editing, and member browsing are connected to Neon on web. Other persistence, permission enforcement, order actions, file uploads, notifications, and background work remain deferred.

## Completed

- V1-01 Monorepo, Expo Android, Next.js web
- V1-02 Shared contracts and provider-neutral domain types
- V1-03 Neon schema, migrations, pooled access, immutable audit
- V1-04 Clerk Google sign-in (replaced by V1-04A)
- V1-04A Better Auth Google sign-in on Neon
- V1-05 Invitation-only access, one-group membership, roles, admin requests
- V1-06 Platform-admin approval and limited mobile-admin permissions
- Multi-group foundation — multi-membership, Manager rename, one active Owner per group, group-scoped authorization
- V1-07 Group details, creation, and persistent invites — Group details read path on web and mobile, web admin Create group, Owner rename and rotate-link actions, persistent multi-use per-group invite links replacing single-use tokens for new acceptances. The simple role checks introduced here will be refactored by the Effective permissions foundation bundle.
- Profile menu and sign out — Real avatar, name, and email in the web member header, web admin header, and mobile member header. Working Sign out on all three surfaces. Removes the hardcoded `profile-mia.jpg` mock and threads the Better Auth session profile fields through `AppIdentity`, `AppIdentitySummary`, and `/api/identity/me`.
- Admin Create group modal — Centered modal styling, dirty-form wobble on backdrop clicks, and explicit discard confirmation from the X close control.
- Users & permissions real users list — Platform Admin now sees real users (themselves included), real group roles, and Platform Admin status on the admin Users & permissions page, replacing the prior mock UI. Working client-side search by name/email. Effective permissions panel and Save are deferred to their own foundation bundle; Add-user-to-group and Suspend-account buttons stay visible but disabled. Automated checks (unit, provider integration, lint, typecheck, web build) all pass; manual browser verification is the remaining step before squash-merge.
- Member and admin UI polish — Member groups list now shows initials-icon, name, member count, and role pill on each card. Group details page centers the title at the top with a single roster that pins the Owner first, followed by Members, plus an "Add people" action for owners. Admin catalog page dropped the nested panel wrapper, gave the search its own labeled field, and aligned restaurant card content under a single body padding. Admin import dropzone centers an "Upload" button, switches to a centered restaurant-name + logo preview after a file is picked, and exposes "Import this Restaurant" as the confirming action.

## Journey Bundles

**Foundation** (sequential):

- [ ] Effective permissions and account overrides
- [ ] Group membership journey — after Effective permissions

**After Multi-group** (parallel):

- [x] Restaurant catalog — implementation, strict public API mapping, source-ID replacement, required-field/upload validation, admin search/branch editing/recent imports, and focused checks pass. Development Neon accepted McDonald's (158 items) and KFC (129 items), admin edit persistence passed, authenticated web Home/detail passed, migrations `0006`/`0007` are present, and the verified `0004`–`0007` journal drift was reconciled; the normal migration runner now completes successfully. Android acceptance remains blocked by an Expo SDK 57 Router/Worklets native crash reproduced in both this app and a fresh official Router control project on the installed Android 16 emulator; a plain Expo control project stays open.
- [ ] Favorites — honest empty states are in place; saving and ranking favorites remain a separate bundle.
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

## Out of Scope

Automatic Grab cart/checkout/payment/placement, in-app payment or repayment, unattended menu scraping, multi-platform collection, recommendation AI, dietary matching, chat, delivery tracking, promotions, fee estimation.
