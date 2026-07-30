# V1-06 Platform-Admin Approval Design

## Goal

Let an existing platform admin approve or reject another group owner's pending platform-admin request, on both web and mobile, without changing the V1-05 access model, audit shape, or one-active-membership rule.

## Why This Task Exists

V1-05 let a group owner **submit** a platform-admin request but intentionally did not implement the decision flow. Those rows sit in `admin_access_requests` with status `pending` and no way to move them to `approved` or `rejected`. V1-06 closes that loop.

Approval flips `users.is_platform_admin` from `false` to `true` for the requesting owner, recorded with an immutable audit event. The first platform admin already exists (set manually in Neon); V1-06 is the path for any *additional* platform admins.

## Scope

### In scope for V1-06

- Web decision screen at `/admin/access-requests` for platform admins to list and decide pending requests.
- Mobile decision screen at `apps/mobile/app/admin/access-requests.tsx`, reached from a card on Home, only shown to platform admins.
- Backend decide endpoint and pending-list endpoint, both gated to `is_platform_admin = true`.
- Service, repository, contract, and audit changes needed to support the above.
- Audit events `platform_admin.approved` and `platform_admin.rejected`.

### Explicitly deferred to V1-06B

- Full mobile `/team` screen parity with web (list members, roles, promote/demote/remove, create invitation, submit platform-admin request). Mobile `/team` stays a stub until V1-06B.

### Out of scope

- Notification to the requester on decision (V1-16, OneSignal/email).
- A "list all platform admins" management view. Platform admins are provisioned manually in Neon; V1-06 does not change that.
- Bootstrap tooling. The first platform admin is already in Neon; no dev CLI is added.
- Any change to who may *submit* a request (still group owners only, as in V1-05).

## Database Changes

**None.** The V1-03 schema already supports V1-06 completely:

- `users.is_platform_admin` boolean exists, defaults `false`.
- `admin_access_requests` has `status`, `decided_by_user_id`, `decision_reason`, `decided_at`, with a check constraint tying the decision fields to a non-pending status.
- The partial unique index `admin_access_requests_one_pending_per_user` allows re-submission after rejection (only one *pending* per user is blocked).

No new migration is generated. The Drizzle journal stays at three entries.

## Contracts (`packages/contracts/src/access/access-requests.ts`)

Add a decide-request shape and a pending-list response shape. Both reuse the existing strict parsing helpers and reject unknown fields.

```ts
export type AdminAccessDecision = "approved" | "rejected";

export type DecideAdminAccessRequestRequest = Readonly<{
  requestId: AdminAccessRequestId;
  decision: AdminAccessDecision;
  reason?: string;
}>;

export type AdminAccessRequestSummary = Readonly<{
  id: AdminAccessRequestId;
  requesterUserId: UserId;
  requesterDisplayName: string;
  groupId: GroupId;
  groupName: string;
  status: "pending";
  createdAt: UtcTimestamp;
}>;

export type ListPendingAdminAccessRequestsResponse = Readonly<{
  requests: readonly AdminAccessRequestSummary[];
}>;
```

- `parseDecideAdminAccessRequestRequest` validates `requestId` as a record id, `decision` as exactly `"approved"` or `"rejected"`, and `reason` as an optional non-empty trimmed string (max 500 chars).
- `parseListPendingAdminAccessRequestsResponse` validates the list response shape returned to clients.

The existing `parseCreateAdminAccessRequest` is unchanged.

## Service (`apps/web/src/features/access/access-service.ts`)

Add two operations to the existing access service. Both run through the existing repository/transaction boundary.

### `decideAdminAccessRequest`

```ts
export interface DecideAdminAccessRequestCommand {
  requesterUserId: UserId;       // the platform admin deciding
  requestId: AdminAccessRequestId;
  decision: AdminAccessDecision;
  reason?: string;
}
```

Inside one transaction:

1. Load the request by `requestId`. If missing or already decided, fail with a typed `not_found` / `already_decided` error.
2. **Self-decision guard.** If `request.requesterUserId === command.requesterUserId`, fail with `cannot_decide_own_request`. (Defense in depth: the submitting owner is not a platform admin at submit time, so this only triggers if an admin somehow submits then tries to decide their own row.)
3. Update the request row: `status`, `decided_by_user_id`, `decided_at = now`, `decision_reason` (null if not supplied).
4. If `decision === "approved"`, set `users.is_platform_admin = true` for `request.requesterUserId`.
5. Insert one audit event:
   - action: `platform_admin.approved` or `platform_admin.rejected`
   - actor: `command.requesterUserId`
   - subject: `request.requesterUserId`
   - idempotency key includes `requestId` and `decision` so a retry cannot double-decide.
6. Commit. Any failure rolls back both the request update and the promotion.

The function returns the updated request summary.

### `listPendingAdminAccessRequests`

Loads all rows with `status = 'pending'`, joined to `users` (requester display name) and `groups` (group name). Returns the typed summary list. Read-only, no audit event.

## Repository (`packages/db/src/repositories/group-access.ts`)

Add focused methods that the service composes:

- `findAdminAccessRequestById(id)` — single row with current status.
- `listPendingAdminAccessRequests()` — join query for the platform-admin view.
- `decideAdminAccessRequest(params)` — single `UPDATE ... SET status, decided_by_user_id, decided_at, decision_reason WHERE id = :id AND status = 'pending'` returning the updated row. A row count of zero means the request was concurrently decided; the service surfaces this as `already_decided`.
- `promoteToPlatformAdmin(userId)` — `UPDATE users SET is_platform_admin = true WHERE id = :userId`.

All run on the pooled client through the existing transaction boundary.

## Authorization (`apps/web/src/application/authorize.ts`)

Add one helper:

```ts
export function requirePlatformAdmin(user: { isPlatformAdmin: boolean }): void {
  if (!user.isPlatformAdmin) {
    throw new ForbiddenError("platform_admin_required");
  }
}
```

This mirrors the existing `requireGroupOwner` / `requireRole` pattern. **Approach 1 from the design discussion:** each platform-admin endpoint calls `requirePlatformAdmin(user)` at the top. No middleware, no wrapper abstraction. Two endpoints do not justify more.

## API Routes

Both routes follow the existing `apps/web` route-execution sequence (verify session → load product identity → validate input → load roles → authorize → execute → return).

### `POST /api/access/admin-requests/decide`

- Authorize: `requirePlatformAdmin`.
- Body: `DecideAdminAccessRequestRequest`.
- Returns the updated `AdminAccessRequestSummary` (with the new status).
- Errors: `not_found`, `already_decided`, `cannot_decide_own_request`, `forbidden`.

### `GET /api/access/admin-requests/pending`

- Authorize: `requirePlatformAdmin`.
- No request body.
- Returns `ListPendingAdminAccessRequestsResponse`.

The existing `GET /api/access/admin-requests/route.ts` (V1-05, returns the *caller's own* pending request) is unchanged.

## Web UI

### `apps/web/app/admin/access-requests/page.tsx`

Replace the current `EmptyPage` stub with a server component that:

1. Loads the product identity for the current session.
2. If the user is not a platform admin, renders an honest "you do not have access" state. (Defense in depth; the API also enforces this.)
3. Fetches pending requests via the service (server-side, no fetch round-trip).
4. If empty, renders the existing `EmptyPage` with the existing copy.
5. Otherwise renders a list of request cards, each with:
   - Requester display name and group name.
   - Submitted-at timestamp.
   - Two buttons: **Approve** and **Reject**.
   - An optional reason text field, shown for both decisions.
6. The buttons call a client component that posts to `/api/access/admin-requests/decide` and refreshes the list on success, surfacing service errors inline.

### `apps/web/app/admin/layout.tsx`

The existing admin nav already lists Access Requests. V1-06 adds a server-side platform-admin check: non-platform-admins hitting `/admin/*` see the same honest "no access" state, with no nav to the protected sub-pages. This matches the existing pattern used for member/organizer gating.

## Mobile UI

### `apps/mobile/app/admin/access-requests.tsx` (new route, outside `(member)`)

A focused decision screen mirroring the web one:

1. Loads the session's product identity via the existing mobile auth client.
2. Non-platform-admins see an honest no-access state and cannot navigate here.
3. Fetches pending requests through the same `/api/access/admin-requests/pending` endpoint using the existing `authenticated-request` helper.
4. Renders the same card list with Approve / Reject / optional reason.
5. Posts decisions to `/api/access/admin-requests/decide`.

This route is **not** part of the member tab bar. It is reached only from a card on Home (below).

### `apps/mobile/app/(member)/index.tsx` (Home, modified)

Add a conditional card at the top of Home, rendered only when the signed-in user `is_platform_admin === true`:

- Title: "Platform-admin requests"
- Body: a count of pending requests, or "No pending requests" when zero.
- Tap target navigates to `/admin/access-requests`.

The card does not render for non-admins, so the member Home experience is unchanged for everyone else. When there are zero pending requests the card still renders (the admin can review history / check the empty state) — surfaced only to platform admins.

## Audit Events

Two new immutable events, written by `decideAdminAccessRequest` inside its transaction:

| Action | Actor | Subject | Idempotency key |
|---|---|---|---|
| `platform_admin.approved` | deciding platform admin | requester user id | `platform_admin:decide:<requestId>:approved` |
| `platform_admin.rejected` | deciding platform admin | requester user id | `platform_admin:decide:<requestId>:rejected` |

The idempotency key prevents a network retry from creating a second audit row or double-promoting. The existing V1-05 audit infrastructure is reused unchanged.

## Decisions Resolved in Brainstorming

- **First platform admin:** already set manually in Neon. No bootstrap work.
- **`decisionReason`:** optional on both approve and reject.
- **Self-decision guard:** enforced in the service.
- **Re-submission after rejection:** allowed (the schema already supports it).
- **Notification of decision:** out of scope (V1-16). The requester sees the outcome the next time they open `/team`.
- **Authorization pattern:** Approach 1, per-route guard via `requirePlatformAdmin`, no middleware or wrapper.
- **Mobile screen placement:** separate route outside `(member)`, reached from a Home card. No new tab.

## Tests

RED-first, per the project workflow. The new suites must fail before implementation and pass after.

### Service tests (`access-service.test.ts`)

- Decide on a pending request approves; the requester's `is_platform_admin` becomes true; one audit row with action `platform_admin.approved` exists; idempotency key blocks a duplicate.
- Decide reject leaves `is_platform_admin` false; one audit row with action `platform_admin.rejected` exists.
- Deciding an already-decided request fails with `already_decided` and writes no audit row.
- Self-decision fails with `cannot_decide_own_request` and writes no audit row.
- Approve rolls back atomically when the audit insert fails (simulated), leaving status `pending` and `is_platform_admin` false.

### Repository tests (provider integration, rollback-only temporary schema)

- `decideAdminAccessRequest` updates the row when pending and returns the new fields.
- A zero-row update is returned when the request is not pending (concurrent decision).
- `listPendingAdminAccessRequests` returns only pending rows with the correct join fields.
- `promoteToPlatformAdmin` flips the flag for exactly one user.

### API route tests

- Unauthenticated caller gets 401.
- Authenticated non-platform-admin gets 403.
- Valid approve returns the updated summary.
- Invalid body (missing `requestId`, bad `decision`, over-long reason) returns 400 without calling the service.
- Self-decision surfaces as the typed error, not a 500.

### Web UI tests

- Non-platform-admin page renders the honest no-access state.
- Empty list renders the existing empty state.
- Pending list renders one card per request.
- Approve / Reject buttons call the endpoint and refresh the list.
- Reason field is optional in both directions.

### Mobile tests

- Non-platform-admin cannot reach `/admin/access-requests` (renders no-access).
- Pending list renders correctly.
- Approve / Reject posts through `authenticated-request` with no bearer token (cookie only).
- Home card renders only for platform admins; tapping navigates to the decision route.
- Home card does not render for non-admins.

## Verification

V1-06 task-branch verification must pass before squash-merge to `main`:

- All provider-free Vitest suites (existing + new).
- All 7 mobile Jest suites (existing + new access-requests and Home-card suites).
- Provider-backed suites with the development Neon branch (existing + new repository and service integration tests).
- All workspace type checks and lint checks.
- Drizzle validation (no new migration; existing three entries unchanged).
- Every package build and the Next.js production build.
- Android Expo export.
- Whitespace, `git diff --check`, and the built-client secret scan.
- Active-Clerk scan stays clean (no regression from the V1-04A cutover).

Live acceptance (web + mobile) confirms a real platform admin can approve a real pending request end-to-end, the requester's flag flips in Neon, and exactly one immutable audit row exists. Mobile approval is verified through the Home card → decision route path. No physical-device claim is made; Android acceptance remains part of V1-22.

## Task Structure

Per `AGENTS.md`, the work decomposes into subtask worktrees under one `task/V1-06-platform-admin-approval` branch:

- `workstream/V1-06-decide-contracts` — contracts + parsers.
- `workstream/V1-06-decide-repositories` — repository methods, rollback-only integration tests.
- `workstream/V1-06-decide-service` — service + audit + service tests.
- `workstream/V1-06-decide-api` — two API routes + route tests.
- `workstream/V1-06-decide-web-ui` — admin page, nav gate, web tests.
- `workstream/V1-06-decide-mobile-ui` — mobile route, Home card, mobile tests.

Integration owner integrates each reviewed subtask branch into `task/V1-06-platform-admin-approval` one at a time, runs affected checks after each merge, runs full verification at the end, then squash-merges to `main` as a single commit titled exactly:

```
V1-06 Implement platform-admin approval and limited mobile-admin permissions
```
