# Admin CRUD on Users and Groups — Design

**Date:** 2026-08-13
**Status:** Spec — pending implementation plan
**Scope:** Web (admin only)
**Branch (proposed):** `task/admin-users-groups-crud`
**Squash title:** `Admin CRUD on users and groups`

## Goal

Give the Platform Admin the five administrative actions that are currently
either disabled or missing on the Users & Permissions and Groups admin pages:

1. **Add user to group** — as a Member.
2. **Remove user from group** — except when the user is that group's Owner.
3. **Suspend user** — sets `archivedAt`; the user disappears from lists but
   their history stays intact.
4. **Rename group** — admin-scoped rename that bypasses group-owner checks.
5. **Archive group** — sets `archivedAt`; the group disappears from lists but
   its history stays intact.

All five actions record an immutable audit event and require Platform Admin
authorization. No new database migrations.

## Background

The Users & Permissions real-users list (just landed) intentionally shipped
with two disabled buttons (`Add user to group`, `Suspend account`) marked
"Coming soon", and the Groups page has no per-row actions at all — rows are
non-interactive `<button>` elements with no `onClick`.

The progress tracker currently distributes this work across three future
bundles (Effective Permissions, Group Membership Journey, Platform Admin
Operations). The product owner has decided to pull the five specific actions
above forward into one bundle. Effective permissions, override Save, Platform
Admin promotion/demotion, role changes within a group, and changing group
ownership remain deferred.

The data model already supports everything here:

- `users.archivedAt` exists and is already filtered out by
  `listUsersWithSummary`.
- `groups.archivedAt` exists; `renameGroup` already guards against it via
  `isNull(groups.archivedAt)`. The admin group-list query does not yet filter
  archived groups and will need to.
- `memberships.removedAt` exists; `addMembership` and `removeMembership` (with
  conflict-handling re-add) already exist on `GroupAccessRepository`.

## Non-goals

- No new database tables, columns, or migrations.
- No Platform Admin promotion or demotion (`setPlatformAdminFlag` exists at
  the repo level but is not exposed to the admin UI in this bundle).
- No role changes within a group (Member ↔ Manager ↔ Owner). Adding a user
  always adds them as Member.
- No group ownership transfer.
- No bulk actions, server-side search, or pagination.
- No mobile admin surface (admin remains web-only).
- No restoration UI for archived users/groups. Archived rows stay in the
  database and could be restored via a future bundle, but no "Restore" button
  ships here.
- No new CSS or design tokens. Modal styling reuses the existing
  `CreateGroupDialog` classes.

## Architecture

The five actions follow the project's existing four-layer pattern:
**Repository → Service → Route handler → API route**, with the web UI calling
the API route from a client component and refreshing via `router.refresh()`.

```text
apps/web/app/admin/users/page.tsx
  └── <Suspense>
        └── users-admin-data.tsx              (async server component)
              └── users-admin-view.tsx        (client component, extended)
                    ├── Add-user-to-group modal      (new)
                    ├── Remove-from-group modal      (new)
                    └── Suspend-account modal        (new; replaces disabled button)

apps/web/app/admin/groups/page.tsx            (server component, list query)
  └── groups-admin-row.tsx                    (new client component, per-row)
        ├── Rename modal                      (new)
        └── Archive modal                     (new)
```

Five new API endpoints under `/api/admin/...`:

| Endpoint | Action | Body |
| --- | --- | --- |
| `POST /api/admin/users/[userId]/suspend` | Suspend user | — |
| `POST /api/admin/users/[userId]/memberships` | Add to group | `{ groupId }` |
| `POST /api/admin/users/[userId]/memberships/[groupId]/remove` | Remove from group | — |
| `POST /api/admin/groups/[groupId]/rename` | Rename | `{ name }` |
| `POST /api/admin/groups/[groupId]/archive` | Archive | — |

## Data Flow

### Repository layer

Two new methods.

On `IdentityAccessRepository`
(`packages/db/src/repositories/identity-access.ts`):

```ts
archiveUser(userId: string, archivedAt: Date): Promise<boolean>;
```

Sets `users.archivedAt` only when it is currently `NULL`. Returns `true` if a
row was updated, `false` if the user was already archived or does not exist.

On `GroupAccessRepository`
(`packages/db/src/repositories/group-access.ts`):

```ts
archiveGroup(groupId: string, archivedAt: Date): Promise<boolean>;
```

Sets `groups.archivedAt` only when it is currently `NULL`. Returns `true` if a
row was updated, `false` otherwise.

Existing methods are reused as-is: `addMembership`, `removeMembership`,
`renameGroup`, `findGroupSummary`, `listActiveMembers`, `listUsersWithSummary`.

The admin group-list query in
`apps/web/src/features/groups/group-runtime.ts:listAllGroupRows` gains an
`isNull(groups.archivedAt)` filter so archived groups disappear from the admin
list. (`listUsersWithSummary` already filters `users.archivedAt IS NULL`.)

### Service layer

Five new service functions live in two new files:

- `apps/web/src/features/users/users-admin-service.ts` — admin user actions
  - `addUserToGroupAsAdmin({ actorId, userId, groupId })`
  - `removeUserFromGroupAsAdmin({ actorId, userId, groupId })`
  - `suspendUserAsAdmin({ actorId, userId })`
- `apps/web/src/features/groups/groups-admin-service.ts` — admin group actions
  - `renameGroupAsAdmin({ actorId, groupId, name })`
  - `archiveGroupAsAdmin({ actorId, groupId })`

Each function:

1. Verifies the actor is a Platform Admin (`users.isPlatformAdmin = true`).
   Throws `PublicApiError("FORBIDDEN", ...)` otherwise.
2. Performs the action's specific guard (see Edge Cases).
3. Runs the mutation inside a single transaction via a new
   `runUsersAdminTransaction` / `runGroupsAdminTransaction` runtime helper
   that shares `identityAccess`, `groupAccess`, and `auditEvents`
   repositories — mirroring the existing `runGroupTransaction` pattern.
4. Appends an immutable audit event:
   - Add-to-group: `{ resourceType: "membership", resourceId: "${groupId}:${userId}", action: "admin.add_member", actorUserId: actorId }`
   - Remove-from-group: `{ resourceType: "membership", resourceId: "${groupId}:${userId}", action: "admin.remove_member", actorUserId: actorId }`
   - Suspend: `{ resourceType: "user", resourceId: userId, action: "admin.suspend_user", actorUserId: actorId }`
   - Rename: `{ resourceType: "group", resourceId: groupId, action: "admin.rename_group", actorUserId: actorId }`
   - Archive: `{ resourceType: "group", resourceId: groupId, action: "admin.archive_group", actorUserId: actorId }`

The actor identity comes from the existing `verifySession` →
`loadRuntimeIdentity` flow. The service receives `actorId` (the product
`users.id` of the authenticated admin) from the route handler.

### Route handler layer

Five new handler factories, structured exactly like the existing
`createRenameGroupHandler`:

- `apps/web/src/features/users/users-admin-route-handlers.ts` — three handlers
- `apps/web/src/features/groups/groups-admin-route-handlers.ts` — two handlers

Each factory wires: `verifySession`, `loadIdentity`, the matching service
function, and `now`. They parse the path parameters (`userId`, `groupId`),
the JSON body (where applicable), call the service, and return a JSON
response.

### Runtime layer

Two new helpers, alongside the existing `groupRuntime` and `usersRuntime`:

- `apps/web/src/features/users/users-runtime.ts` (existing file) gains a
  `runUsersAdminTransaction` plus three service-binding methods
  (`addUserToGroupAsAdmin`, `removeUserFromGroupAsAdmin`, `suspendUserAsAdmin`)
  on the exported `usersRuntime` object.
- `apps/web/src/features/groups/group-runtime.ts` (existing file) gains a
  `runGroupsAdminTransaction` plus two service-binding methods
  (`renameGroupAsAdmin`, `archiveGroupAsAdmin`) on the exported `groupRuntime`
  object.

### API routes

Five new thin pass-through route files, mirroring
`apps/web/app/api/groups/[groupId]/rename/route.ts`:

- `apps/web/app/api/admin/users/[userId]/suspend/route.ts`
- `apps/web/app/api/admin/users/[userId]/memberships/route.ts`
- `apps/web/app/api/admin/users/[userId]/memberships/[groupId]/remove/route.ts`
- `apps/web/app/api/admin/groups/[groupId]/rename/route.ts`
- `apps/web/app/api/admin/groups/[groupId]/archive/route.ts`

### Contracts

One new validator in a new file
`packages/contracts/src/users/user-requests.ts`
(the project has no `users/` contracts folder yet; this creates it):

- `parseAddUserToGroupRequest({ groupId: string })` — validates the body of
  the add-to-group endpoint. Rejects missing/empty/non-string `groupId`,
  strips unknown keys, trims.

The existing `parseRenameGroupRequest({ name: string })` is reused for the
admin rename endpoint — no new validator needed. The other three endpoints
have no request body.

### Page layer

#### Users page

`apps/web/app/admin/users/users-admin-view.tsx` is extended. It already holds
the selected user id and the full user list. New state:

- `addModalOpen: boolean` — controls the Add-to-group modal.
- `removeTarget: { groupId, groupName } | null` — controls the
  Remove-from-group confirm.
- `suspendConfirmOpen: boolean` — controls the Suspend confirm.

New handlers issue `fetch()` calls to the API, then call `router.refresh()`
from `next/navigation` on success. Errors surface as inline text inside the
active modal.

The "Add user to group" button in the page header (`page.tsx`) loses its
`disabled` attribute. The "Suspend account" button in the detail panel loses
its `disabled` attribute. The page header's `description` copy is updated to
drop the "future bundle" framing.

#### Groups page

`apps/web/app/admin/groups/page.tsx` becomes a thin server component that
loads groups via `groupRuntime.listAllGroupsForAdmin()` and renders one new
client component per row: `apps/web/app/admin/groups/groups-admin-row.tsx`.

`groups-admin-row.tsx` renders the existing row layout (Group / Owner /
Members / Active orders / Status) plus a new "Actions" cell with two small
buttons (`Rename`, `Archive`). Each button opens its respective modal,
issues the fetch on submit, and calls `router.refresh()` on success.

The current outer `<button>` per row becomes a `<div>` so the inner buttons
don't nest illegally.

### Client component structure

Five new modal components, all in the admin directory, all reusing
`CreateGroupDialog` styles:

- `apps/web/app/admin/users/add-user-to-group-dialog.tsx` — props:
  `{ users: AdminUserSummary[], groups: { groupId, name }[], defaultUserId: string | null }`.
  Two dropdowns + Add / Cancel buttons.
- `apps/web/app/admin/users/confirm-suspend-dialog.tsx` — props:
  `{ user: AdminUserSummary }`. Confirm / Cancel buttons.
- `apps/web/app/admin/users/confirm-remove-membership-dialog.tsx` — props:
  `{ user: AdminUserSummary, membership: AdminUserMembership }`. Confirm / Cancel
  buttons.
- `apps/web/app/admin/groups/rename-group-dialog.tsx` — props:
  `{ group: { groupId, name } }`. One text input prefilled, Save / Cancel.
- `apps/web/app/admin/groups/archive-group-dialog.tsx` — props:
  `{ group: { groupId, name } }`. Confirm / Cancel.

The Add-user-to-group modal needs the full list of groups (for the dropdown).
`users-admin-data.tsx` will additionally call `groupRuntime.listAllGroupsForAdmin()`
and pass the result down through `UsersAdminView` to the dialog.

## UI Components

### Add-user-to-group dialog

Centered modal reusing the existing `admin-modal` classes. Layout:

- Title: `Add user to group`
- Dropdown 1: `User` — every active user, default selection = the currently
  selected user in the list panel (or first user if none selected).
- Dropdown 2: `Group` — every active group, alphabetical.
- Buttons: `Add to group` (primary), `Cancel` (secondary).

Submit fails with inline text if the chosen user is already in the chosen
group. On success the modal closes and the detail panel refreshes to show
the new membership.

### Confirm-suspend dialog

- Title: `Suspend [displayName]?`
- Body: `They won't be able to sign in. Their past activity stays intact.`
  When the chosen user owns one or more groups, an additional line is
  appended: `[displayName] owns N group(s); those groups will have no active
  owner.`
- Buttons: `Suspend` (primary — the project has no destructive-button class
  today), `Cancel`.

### Confirm-remove-membership dialog

- Title: `Remove [displayName] from [groupName]?`
- Body: `They'll need a new invite to rejoin.`
- Buttons: `Remove` (primary), `Cancel`.

### Rename-group dialog

- Title: `Rename [currentName]`
- One text input, prefilled, autofocus, validated non-empty after trim (the
  existing `parseRenameGroupRequest` rule).
- Buttons: `Save` (primary), `Cancel` (secondary).

### Archive-group dialog

- Title: `Archive [name]?`
- Body: `It disappears for members but all history is kept.`
- Buttons: `Archive` (primary), `Cancel` (secondary).

### Disabled-action tooltip removal

The two existing `title="Coming soon"` attributes on the "Add user to group"
and "Suspend account" buttons are removed once those buttons become active.

## Edge Cases and Error Handling

| Case | Behavior |
| --- | --- |
| Actor is not a Platform Admin | Service throws `PublicApiError("FORBIDDEN", "Access denied.")`. API returns 403. UI never reaches this path because admin layout gates the page, but defense in depth. |
| Add user to a group they're already in | Service throws `PublicApiError("CONFLICT", "Already a member.")`. API returns 409. Modal shows the message inline. |
| Add user to an archived group | Service throws `PublicApiError("CONFLICT", "Group is archived.")` → 409. The dropdown excludes archived groups, so this is defense in depth. |
| Add an archived user to a group | Service throws `PublicApiError("CONFLICT", "User is suspended.")` → 409. The dropdown excludes archived users, so this is defense in depth. |
| Remove a user who is that group's Owner | Service throws `PublicApiError("CONFLICT", "Reassign ownership first.")` → 409. Modal shows the message inline. |
| Remove a membership that does not exist | Service throws `PublicApiError("NOT_FOUND", "Membership not found.")` → 404. |
| Suspend yourself | Service throws `PublicApiError("CONFLICT", "You can't suspend your own account.")` → 409. |
| Suspend a user who owns one or more groups | Allowed. Confirm-suspend dialog body appends `[displayName] owns N group(s); those groups will have no active owner.` before the admin confirms. |
| Suspend an already-archived user | Service throws `PublicApiError("CONFLICT", "User is already suspended.")` → 409. |
| Rename an archived group | Service throws `PublicApiError("CONFLICT", "Group is archived.")` → 409. |
| Rename to empty / whitespace | Existing `parseRenameGroupRequest` throws `PublicApiError("INVALID_INPUT", ...)` → 400. |
| Archive an already-archived group | Service throws `PublicApiError("CONFLICT", "Group is already archived.")` → 409. |
| Database write fails inside the transaction | Transaction rolls back, audit event is not written, route returns 500, default Next.js error boundary renders. |
| Network failure during fetch in the UI | Modal stays open, inline message `Couldn't reach the server. Try again.` |

**Sort orders, list refresh behavior, and Skeleton states are unchanged from
the existing pages.**

## Testing

### Repository integration tests

Added to the existing
`packages/db/src/repositories/repositories.provider.integration.test.ts`:

- `archiveUser` sets `archivedAt` on an active user and returns `true`.
- `archiveUser` on an already-archived user returns `false` and does not
  change the timestamp.
- `archiveUser` on a non-existent id returns `false`.
- `archiveGroup` sets `archivedAt` on an active group and returns `true`.
- `archiveGroup` on an already-archived group returns `false`.
- After `archiveUser`, the user no longer appears in `listUsersWithSummary`.
- After `archiveGroup`, the group no longer appears in the admin group list
  returned by `groupRuntime.listAllGroupsForAdmin()` (which filters
  `groups.archivedAt IS NULL`).

### Service unit tests

`apps/web/src/features/users/users-admin-service.test.ts` — three suites,
one per function. Each suite covers: actor-not-admin → throws; happy path →
mutation applied + audit event appended; every documented guard.

`apps/web/src/features/groups/groups-admin-service.test.ts` — same shape for
the two group functions.

Tests use the existing in-memory repository fakes already used by
`group-service.test.ts` and `access-service.test.ts`.

### Route handler tests

`apps/web/src/features/users/users-admin-route-handlers.test.ts` and
`apps/web/src/features/groups/groups-admin-route-handlers.test.ts`. Per
handler: non-admin identity → 403; happy path → 200 with the documented
response shape; each guard → the documented status code and error code.

### Contract tests

`packages/contracts/src/users/user-requests.test.ts` for the new
`parseAddUserToGroupRequest` — validates a well-formed body, rejects
missing/empty/malformed `groupId`, strips unknown keys.

### Client component tests

`apps/web/app/admin/users/users-admin-view.test.tsx` (existing file) is
extended to cover:

- Clicking `Add user to group` opens the modal; submitting calls fetch and
  `router.refresh` on success.
- Clicking `Remove` next to a membership opens the confirm; submitting calls
  fetch and refreshes.
- Clicking `Suspend account` opens the confirm; submitting calls fetch and
  refreshes.
- A 409 response surfaces the message inline in the modal.

`apps/web/app/admin/groups/groups-admin-row.test.tsx` (new) covers:

- `Rename` button opens the modal prefilled; submitting calls fetch and
  `router.refresh`.
- `Archive` button opens the confirm; submitting calls fetch and refresh.
- A 409 response surfaces the message inline.

### Page smoke tests

`apps/web/app/admin/users/page.test.tsx` — does not currently exist in the
repo and is not added by this bundle. The existing
`apps/web/app/admin/users/users-admin-view.test.tsx` covers the rendered
output; the page-level smoke test stays deferred.

`apps/web/app/admin/groups/page.test.tsx` — new. Server component renders
the table; archived groups are excluded.

### Focused checks

- `npm run test:unit`
- `npm run test:providers` (the repositories integration suite)
- `npm run lint`
- `npm run typecheck`
- `npm run build --workspace apps/web`

### Manual verification

1. Sign in as the Platform Admin on web.
2. **Users page → Add to group**: Click `Add user to group`, pick a user and
   a group, submit. Confirm the membership appears in the user's detail
   panel.
3. **Users page → Add duplicate**: Try to add the same user to the same
   group again. Confirm the modal shows `Already a member.`
4. **Users page → Remove from group**: Click `Remove` next to a non-Owner
   membership, confirm. Confirm the membership disappears from the detail
   panel.
5. **Users page → Remove owner blocked**: Try to remove an Owner. Confirm
   the modal shows `Reassign ownership first.`
6. **Users page → Suspend**: Pick a non-self user, click `Suspend account`,
   confirm. Confirm the user disappears from the list.
7. **Users page → Self-suspend blocked**: Try to suspend yourself. Confirm
   the modal shows `You can't suspend your own account.`
8. **Groups page → Rename**: Click `Rename` on a group, change the name,
   save. Confirm the row updates.
9. **Groups page → Archive**: Click `Archive` on a group, confirm. Confirm
   the group disappears from the list.
10. **Audit**: Open the admin Audit page and confirm each action appears
    with the right actor, target, and timestamp.

## Workflow

Per `AGENTS.md`:

1. **First**: finish the manual browser verification of the in-flight
   `task/users-and-permissions-real-users` branch, then squash-merge it to
   `main`. (Its history file is already written; only manual verification
   was pending.)
2. Branch from `main`: `task/admin-users-groups-crud`.
3. Commit work on the branch with descriptive messages.
4. Run focused checks: tests, lint, typecheck, web build.
5. Manual browser verification (the steps above).
6. Write `context/history/admin-users-groups-crud.md` with completion
   evidence (tests run, verification steps, decisions made).
7. Squash-merge to `main`. Squash commit title: `Admin CRUD on users and
   groups`.
8. Update `context/progress-tracker.md`.

## Out of Scope (restated)

- Effective permissions panel, override grid, Save button.
- Platform Admin promotion/demotion UI (repo method exists, not exposed).
- Role changes within a group (Member ↔ Manager ↔ Owner).
- Group ownership transfer.
- Restoration of archived users or groups.
- Server-side search, pagination, bulk actions.
- Mobile admin surface.
- Dedicated `error.tsx` for any of the new endpoints.
- Any database migration.
