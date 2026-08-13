# Users & Permissions Real Users List — Design

**Date:** 2026-08-13
**Status:** Spec — pending implementation plan
**Scope:** Web (admin only)

## Goal

Replace the fully mocked Users & Permissions admin page with real data from
Neon, so the Platform Admin sees every signed-in user (themselves included),
their real group memberships and roles, and their Platform Admin status. The
admin's account is treated as a regular product user that happens to carry the
`isPlatformAdmin` flag — there is no separate "admin" type.

## Background

`apps/web/app/admin/users/page.tsx` is currently 100% hardcoded: three fake
users (Mia Perez, Jordan Diaz, Alex Kim), fake group roles, and a fake
"Effective permissions" override table with a Save button. None of it is
connected to Neon.

The real data already exists:

- The product `users` table has `id`, `authUserId`, `displayName`,
  `isPlatformAdmin`, `archivedAt`, and timestamps.
- The Better Auth `auth_users` table has `name`, `email`, and `image`.
- The `memberships` table has `groupId`, `userId`, `role`, `joinedAt`,
  `removedAt`.
- The Platform Admin user already has a `users` row like every other signed-in
  user. They can already be a Group Owner (when they create a group) or a
  regular Member (when they accept an invite link). The data model already
  supports the user's intent — only the UI hides it.

The "Effective permissions / Save override" panel belongs to the separately
planned **Effective permissions foundation** bundle and is explicitly out of
scope here.

## Non-goals

- No new database tables, columns, or migrations.
- No Effective permissions panel, override grid, or Save button (deferred to
  the Effective permissions foundation bundle).
- No working "Add user to group" action (deferred to the Group membership
  journey bundle). The button stays visible but disabled.
- No working "Suspend account" action (deferred to the Platform Admin
  operations bundle). The button stays visible but disabled.
- No server-side search, pagination, or filtering.
- No mobile admin surface (admin remains web-only).
- No dedicated `admin/users/error.tsx` route — the default Next.js error
  boundary is used.

## Architecture

The page uses Next.js App Router streaming so the admin shell paints
immediately and the data-dependent panel streams in once Neon responds.

```text
admin/layout.tsx
  └── admin/users/page.tsx                  (sync server component)
        ├── AdminPage header with disabled "Add user to group" action
        └── <Suspense fallback={<ListSkeleton />}>
              └── users-admin-data.tsx       (async server component)
                    └── users-admin-view.tsx  (client component)
                          ├── Left: search + filtered user list
                          └── Right: detail panel for selected user
```

**Why split `page.tsx` and `users-admin-data.tsx`:** the page itself must stay
synchronous so the header, sidebar, and action button paint without waiting on
Neon. Wrapping the data fetch in a Suspense boundary with an async child is the
standard Next.js streaming pattern and avoids adding an API route.

**Why a client component for the view:** search filtering and row selection are
interactive and work off data already in memory. With <30 users there is no
need for server-side search.

## Data Flow

### Repository layer

New method on `IdentityAccessRepository`
(`packages/db/src/repositories/identity-access.ts`):

```ts
listUsersWithSummary(): Promise<readonly UserSummaryRow[]>;
```

Where `UserSummaryRow` is:

```ts
interface UserSummaryRow {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly imageUrl: string | null;
  readonly isPlatformAdmin: boolean;
  readonly archivedAt: Date | null;
  readonly memberships: readonly {
    readonly groupId: string;
    readonly role: "owner" | "manager" | "member";
  }[];
}
```

The implementation does two reads inside one call (no transaction needed —
this is a read):

1. `users` left-joined to `auth_users` on `users.authUserId = auth_users.id`,
   filtered to `users.archivedAt IS NULL`, ordered by `users.displayName`
   ascending. Left join so a user without a matching auth row still appears.
2. Active memberships (`memberships.removedAt IS NULL`) joined to `users` for
   the same set of users, grouped in TypeScript by `userId`. Reads use the
   existing `memberships` and `authUsers` schema exports.

The existing `listUsers()` method is unchanged — the Create-Group dropdown
keeps using it.

### Runtime layer

A new `usersRuntime` helper in a new
`apps/web/src/features/users/users-runtime.ts`. Mirrors the existing
`groupRuntime.listAllGroupsForAdmin()` pattern (same file structure as
`apps/web/src/features/groups/group-runtime.ts` and
`apps/web/src/features/access/access-runtime.ts`):

```ts
listUsersForAdmin: async (): Promise<readonly AdminUserSummary[]>
```

Where `AdminUserSummary` is the runtime-facing type that bundles a group-name
lookup onto each membership so the client component doesn't have to know about
group IDs:

```ts
interface AdminUserSummary {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly imageUrl: string | null;
  readonly isPlatformAdmin: boolean;
  readonly memberships: readonly {
    readonly groupId: string;
    readonly groupName: string;
    readonly role: "group-owner" | "manager" | "member";
  }[];
}
```

For each membership, the runtime calls the existing
`groupAccess.findGroupSummary(groupId)` to resolve the name. If the group no
longer exists, `groupName` falls back to `"Group"` (matches the existing
behavior in `groupRuntime.listViewerGroupSummaries`).

The role mapping is the same one already used elsewhere
(`owner → group-owner`, `manager → manager`, `member → member`).

### Page layer

`apps/web/app/admin/users/page.tsx` becomes a synchronous server component.
It renders the existing `AdminPage` shell with the disabled action button,
then a `<Suspense>` boundary whose fallback is a small skeleton matching the
list panel's shape (a few greyed placeholder rows using existing admin panel
classes).

`apps/web/app/admin/users/users-admin-data.tsx` is a new async server
component that calls `usersRuntime.listUsersForAdmin()` and renders
`<UsersAdminView users={users} />`.

### Client component

`apps/web/app/admin/users/users-admin-view.tsx` is a new `"use client"`
component. State:

- `query: string` — the search box value.
- `selectedId: string | null` — the currently selected user id.

Initial `selectedId` is the first user's id (or `null` if the list is empty).
The list filters client-side by `displayName` or `email`
case-insensitively. If the current `selectedId` is filtered out, the component
auto-selects the first visible row.

The component renders two children:

- **Left list panel** — search input + one button per user. Each button shows
  avatar (or initials), name, email + group-count subtitle, and the Platform
  Admin pill when applicable. The selected row gets the `admin-user-row--active`
  class (already in the stylesheet).
- **Right detail panel** — for the selected user: avatar, name, email, "App
  active" status line, Platform Admin pill, the Group roles list, and the
  disabled "Suspend account" button.

## UI Components

### Avatar fallback

When `imageUrl` is `null`, empty, or fails to load, render the first letter of
`displayName` in uppercase inside a colored circle. If `displayName` is empty,
the letter is `?`. Same rule as the Profile Menu.

### Platform Admin pill

A small pill rendered next to the user's name in both the list row and the
detail panel header when `isPlatformAdmin` is true. Copy: `Platform Admin`.
Reuses the existing `status-pill` class.

### Group roles list

For each membership: group name on the left, role label on the right. Role
labels: `Group Owner` / `Manager` / `Member`. Empty state:
`Not in any groups yet.`

### Disabled action buttons

- Header "Add user to group" button: `disabled` with `title="Coming soon"`.
- Detail panel "Suspend account" button: `disabled` with `title="Coming soon"`.

### List skeleton

The Suspense fallback is inline JSX in `page.tsx` rendering three greyed
placeholder rows in the same shape as real user rows (avatar circle + name bar
+ subtitle bar). Uses existing neutral/admin-panel styles — no new CSS, no new
file.

## Mock Data Cleanup

Removed from `apps/web/app/admin/users/page.tsx`:

- The three hardcoded `<button>` user rows (Mia Perez, Jordan Diaz, Alex Kim).
- The inline permission-row array and the entire Effective permissions panel
  (`permission-heading`, `permission-table`, `permission-save`, override and
  effective chips).
- The mock Group roles section.

CSS classes that become temporarily unused (`permission-table`,
`permission-table__header`, `permission-table__row`, `permission-heading`,
`permission-save`, `override-chip`, `override-chip--blocked`, `effective`,
`effective--blocked`) stay in the stylesheet — the Effective Permissions
foundation bundle will use them.

No mock image assets are removed by this work (the Profile Menu work already
removed `profile-mia.jpg`).

## Edge Cases and Error Handling

| Case | Behavior |
| --- | --- |
| Zero users in the database | List panel shows `No users yet.` Detail panel shows a `Select a user` empty state. In practice unreachable because the viewing admin is themselves a user. |
| Search returns no matches | List shows `No users match "<query>".`. Detail panel falls back to `Select a user`. |
| User with zero memberships | Detail panel's Group roles section shows `Not in any groups yet.` |
| Avatar URL missing or fails to load | Initials fallback (first letter of `displayName`, uppercase, colored circle). Same rule as the Profile Menu. |
| User row without a linked `auth_users` row | Still appears. Email shows as `—`, avatar uses initials. Does not crash. |
| `archivedAt` set on a user | Excluded from the list entirely. |
| Selected user is filtered out by search | Auto-select the first visible row. |
| Database read fails inside Suspense | The default Next.js error boundary is triggered. A dedicated `admin/users/error.tsx` is intentionally out of scope. |
| Non-admin reaches the URL | Already handled by `admin/layout.tsx`'s `getCurrentServerPageIdentity()` gate. |

**Sort order:** alphabetical by `displayName` ascending (matches the existing
`listUsers()` ordering).

## Testing

### Repository integration test

Added to the existing provider integration test file
`packages/db/src/repositories/repositories.provider.integration.test.ts`
(matches where existing repository-level reads are covered):

- Returns multiple users with `email`, `imageUrl`, `isPlatformAdmin`, and
  bundled `memberships`.
- Returns a user with zero memberships as `memberships: []` (never `null`).
- Excludes users where `archivedAt` is set.
- Left join works: a user with no matching `auth_users` row still appears with
  `email: null` and `imageUrl: null`.
- Orders alphabetically by `displayName`.

### Client component test

`apps/web/app/admin/users/users-admin-view.test.tsx`:

- Renders all users when search is empty.
- Filters by name and by email (case-insensitive).
- Clicking a row updates the detail panel.
- Platform Admin pill renders for admins; absent for non-admins.
- Initials fallback renders when `imageUrl` is null.
- Empty state when given an empty user list.
- Selecting a row, then searching such that the row no longer matches,
  auto-selects the first visible row.
- Group roles section shows real memberships and the `Not in any groups yet`
  empty state.
- Both action buttons render `disabled` with the `Coming soon` tooltip.

### Page smoke test

`apps/web/app/admin/users/page.test.tsx`:

- Server component renders the header and disabled action button immediately.
- Suspense fallback (skeleton) renders before data arrives.
- Async data child eventually renders the list and detail panel.

### Focused checks

- `npm run test` (all unit and integration tests).
- `npm run lint`.
- `npm run typecheck`.
- `npm run build` for the web app.

### Manual verification

1. Sign in as the Platform Admin on web.
2. Open the admin workspace and click **Users & permissions**.
3. Confirm the page shell appears instantly and the list area briefly shows a
   skeleton.
4. Confirm the list shows **you** (the admin) plus every other user who has
   signed in, sorted alphabetically.
5. Confirm your own row shows the **Platform Admin** pill and the right group
   memberships with the right roles.
6. Type a partial name or email in the search box and confirm the list filters
   live.
7. Confirm the "Effective permissions" panel is gone and the two action
   buttons are visibly disabled with the Coming soon tooltip.

## Workflow

Per `AGENTS.md`:

1. Branch from `main`: `task/users-and-permissions-real-users`.
2. Commit work on the branch with descriptive messages.
3. Run focused checks: tests, lint, typecheck, web build.
4. Manual browser verification (the steps above).
5. Write `context/history/users-and-permissions-real-users.md` with completion
   evidence (tests run, verification steps, decisions made).
6. Squash-merge to `main`. Squash commit title: `Users & permissions real
   users list`.
7. Update `context/progress-tracker.md`.

## Out of Scope (restated)

- Effective permissions panel, override grid, and Save button.
- Working "Add user to group" action.
- Working "Suspend account" action.
- Server-side search, pagination, bulk actions.
- Mobile admin surface.
- Dedicated `error.tsx` for this route.
- Any database migration.
