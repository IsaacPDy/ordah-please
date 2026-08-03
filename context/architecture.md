# Architecture Context

## Stack

| Category | Technology | Role |
| --- | --- | --- |
| Android client | Expo React Native + TypeScript | Native Android experience and private APK |
| iPhone client | Next.js PWA + TypeScript | Installable iPhone web experience |
| Admin portal | Next.js + TypeScript | Full desktop admin and limited responsive admin UI |
| Hosting and API | Vercel + Next.js Route Handlers | Trusted server boundary for clients and integrations |
| Database | Neon PostgreSQL | Structured product data, relationships, permissions, and audit history |
| Database access | Drizzle ORM and Neon pooled connection | Typed queries, migrations, and serverless-safe connections |
| Authentication | Self-hosted Better Auth with Google sign-in | User identity and sessions only |
| Object storage | Cloudflare R2 private buckets | Thumbnails, receipts, import files, and validation reports |
| Notification delivery | OneSignal | Android native push and iPhone PWA web push |
| Scheduling | Upstash QStash | Delayed deadline work and recurring refresh reminders |
| Mobile builds | Expo EAS | Development builds and private Android APKs |
| External collection | Codex Computer Use | Human-supervised menu reading and JSON/CSV preparation |

## Application Identifiers

- **Display name:** `ordah please`
- **Project slug:** `ordah-please`
- **Android application ID:** `ordahplease.app`
- **Android namespace:** `ordahplease.app`

Do not change the Android application ID after the first distributed APK without treating it as an application migration.

## Why Each Backend Service Exists

- **Google OAuth:** Proves control of a Google identity.
- **Better Auth:** Creates and verifies the application's session.
- **Vercel API:** Decides whether that user may perform the requested action.
- **Neon:** Stores and queries structured records.
- **R2:** Stores file bytes that do not belong in PostgreSQL.
- **QStash:** Tells the API when deadline or reminder work must run.
- **OneSignal:** Delivers the resulting alert to a device.

## System Boundaries

- `apps/mobile/` owns the Expo Android UI, device integration, native push registration, and outgoing Grab link.
- `apps/web/` owns the iPhone PWA, web admin portal, web-push registration, and all Next.js API route handlers.
- `packages/domain/` owns framework-independent order, voting, ranking, permission, and state-transition rules.
- `packages/contracts/` owns validated API request and response schemas shared by clients and server.
- `packages/db/` owns the Neon schema, migrations, typed queries, and transactions.
- `packages/storage/` owns R2 object naming, signed URL creation, and file metadata coordination.
- `packages/notifications/` owns provider-neutral notification events and the OneSignal adapter.
- `packages/jobs/` owns QStash scheduling, verification, idempotency, and job handlers.
- `context/` owns product truth, architecture, standards, current progress, and V1 specifications.

Clients never connect directly to Neon, R2, QStash, or OneSignal. Every privileged operation crosses the authenticated API boundary.

## Storage Model

### Neon PostgreSQL

Store Better Auth users, sessions, accounts, and verifications separately from provider-neutral product users, private-group membership, roles, admin requests, the group's default delivery address, restaurants, branches, menus, menu versions, categories, items, variants, modifiers, availability, import drafts, refresh runs, favorites, favorite lines, orders and their delivery-address snapshots, selected participants, votes, food selections, order lines, notification records, receipt metadata, audit events, and timestamps.

### Cloudflare R2

Use private buckets for cached menu thumbnails, optional receipts, uploaded JSON/CSV files, and validation reports. Store only object keys and metadata in Neon. Clients upload and download through short-lived signed URLs issued after authorization.

### Client Cache

Cache only non-secret display data and short-lived session state. The server remains authoritative for permissions, deadlines, votes, totals, and order state.

## Auth and Access Model

- Google OAuth proves control of a Google identity, and Better Auth creates and verifies the application session.
- Better Auth runs inside the existing Next.js application and stores `auth_users`, `auth_sessions`, `auth_accounts`, and `auth_verifications` in Neon.
- Neon maps each Better Auth user through nullable, unique `users.auth_user_id`; product roles stay on the product user and are never accepted from Google or Better Auth.
- No external identity webhook exists. A product user is created or reused on the first authenticated request, with uniqueness protecting concurrent provisioning.
- Web uses same-origin HTTP-only cookies. Android uses the Better Auth Expo plugin with SecureStore-backed cookies and sends that cookie to the trusted API.
- Every API request verifies the Better Auth session, ensures or loads the application identity, loads application roles from Neon, and checks resource-level permission.
- Group owners issue expiring invitation tokens whose public values are deployment-bound; Neon stores only their hashes so a database read cannot reveal a usable invitation.
- Invitation acceptance consumes the token and creates or reactivates one group membership in a transaction. A user may hold multiple active memberships with a different role in each group, while acceptance never enrolls the member in an order.
- Browser product mutations reject cross-site origins before session work; Android may send its SecureStore cookie without a browser Origin header.
- Group Owners and Managers act only through their effective action permissions. Role changes, removal, assignment, suspension, and account-wide Platform Admin overrides are audited; compare-and-set updates prevent duplicate role events.
- Authentication deletion or session revocation never erases product history.
- Platform admins manage catalog and admin requests.
- Group Owners and Managers manage membership actions allowed by their effective permissions.
- Managers manage only orders they are authorized to manage.
- Members mutate only their own favorites and their own active-order responses.
- Order data is visible only to the organizer and selected participants, except platform admins performing support or audit duties.

## Core Data Rules

- A user may belong to multiple groups and has one role per group membership.
- Each group has exactly one Group Owner and may have multiple Managers.
- An order contains an explicit participant list; group membership alone never enrolls a user in an order.
- Favorites belong to one user and one restaurant branch and have unique ranks 1 through 3.
- A fourth favorite cannot be saved until an existing rank is replaced.
- Prices copied into an order line are immutable historical snapshots.
- Menu refreshes create versioned changes; failed refreshes never erase the last published menu.
- Every imported restaurant remains due for weekly supervised refresh unless a platform admin explicitly pauses it.
- Each order copies the selected delivery address so later group-address changes do not alter history.
- Receipt objects are optional and private.

## Order State Model

`DRAFT -> RESTAURANT_VOTING -> FOOD_CONFIRMATION -> READY_FOR_HANDOFF -> ORDERED | CANCELLED`

- Voting-disabled orders may move directly from Draft to Food Confirmation.
- State transitions run only through domain services and are idempotent.
- At the restaurant deadline, an option with at least 50% of selected-participant votes can win; the initial restaurant wins if the threshold is unmet or the result is tied.
- At the food deadline, a valid Rank 1 is included for a non-responder. Missing or invalid selections require organizer resolution before handoff.

## Background Work

- QStash schedules one-time deadline and reminder callbacks and one recurring weekly catalog reminder.
- Each callback is signed, authenticated, idempotent, and safe to retry.
- The callback invokes the Vercel API; QStash never writes directly to Neon or sends directly through OneSignal.
- External Computer Use collection is supervised and never runs as an unattended backend scraper.

## Failure Handling

- Invalid imports remain drafts and return row-level validation errors.
- Failed menu refreshes retain the last published version and alert admins.
- Suspicious removals or major changes require review rather than automatic publication.
- Duplicate job delivery is ignored through idempotency keys.
- Failed notification delivery is logged and does not roll back the underlying order transition.
- Missing or unavailable favorites block readiness until the member or organizer resolves them.
- R2 upload failures do not create finalized database records.
- Grab-opening failure leaves the consolidated handoff copyable and visible.

## Cost Boundary

Target required infrastructure cost is USD 0 per month using self-hosted Better Auth plus the Neon, R2, OneSignal, QStash, Vercel Hobby, Expo EAS Free, and GitHub Actions free allowances. Better Auth Infrastructure is not used. A custom domain is optional. Follow `context/services/service-limits.md`; no paid upgrade is authorized by a warning threshold.

## Invariants

1. Clients never receive database, R2, QStash, OneSignal, or other server credentials.
2. Every mutation verifies identity, application role, resource access, and validated input.
3. Product roles and membership live in Neon product tables; Google and Better Auth provide identity and sessions only.
4. Files live in R2; structured relationships and file metadata live in Neon.
5. Prices in completed order history never change when menus refresh.
6. A menu refresh never removes the last approved menu on failure.
7. Group membership never implies participation in a specific order.
8. Only selected participants influence that order's vote threshold.
9. No service automatically places, pays for, or confirms a Grab order.
10. Computer Use never bypasses access controls, CAPTCHAs, or other safeguards.
