# Admin CRUD on Users and Groups

**Branch:** `task/admin-users-groups-crud`
**Squash title:** `Admin CRUD Adjustments`
**Date:** 2026-08-15

## What landed

Five Platform Admin actions across the Users & Permissions and Groups admin
pages, each Platform-Admin-gated at both the service and route layers and each
appending an immutable audit event inside the same transaction as the
mutation:

1. **Add user to group** — any active user into any active group, always as a
   Member. Duplicate, archived-group, and suspended-user attempts return 409.
2. **Remove user from group** — blocked with `Reassign ownership first.` when
   the user owns the group.
3. **Suspend user** — sets `users.archivedAt`; the user disappears from the
   admin list. Self-suspension and double-suspension return 409. The confirm
   dialog warns when the user owns groups.
4. **Rename group (admin)** — bypasses the group-owner check, still refuses
   archived groups.
5. **Archive group** — sets `groups.archivedAt`; the group disappears from the
   admin list (new `isNull(groups.archivedAt)` filter in
   `listAllGroupRows`).

Layers added: `archiveUser`/`archiveGroup`/`findUserById` repository methods;
two admin services (`users-admin-service`, `groups-admin-service`) with
per-feature admin transaction runners on the runtimes; the
`parseAddUserToGroupRequest` contract; five route-handler factories; five
thin API routes under `/api/admin/...`; five modal components reusing the
existing `admin-dialog` classes (no new CSS); `groups-admin-row` client
component with per-row Rename/Archive actions. The disabled "Coming soon"
buttons and "future bundle" copy are gone from the Users page.

## Verification

- `npm run test:unit` — 444 / 444 tests pass across 79 files, including new
  suites: contracts validator (5), users-admin route handlers (7),
  groups-admin route handlers (5), `UsersAdminView` CRUD flows (12),
  `GroupsAdminRow` (4), groups page smoke (1).
- `npm run test:providers` (with dev-Neon `DATABASE_MIGRATION_URL` from
  `apps/web/.env.local`) — 471 / 472 pass. The single failure
  (`schema.provider.integration.test.ts` → expects
  `group_invite_links_status_values`, receives
  `group_invite_links_rotated_fields_match`) reproduces identically on
  `main` (verified in a clean worktree) — pre-existing, unrelated to this
  bundle, which adds no migrations.
- `npm run lint` — clean.
- `npm run typecheck` — clean across all workspaces.
- `npm run build --workspace apps/web` — succeeds.
- **Manual browser verification: complete (2026-08-15).** The product owner
  walked through the spec's steps (add, duplicate-add, remove, owner-remove
  block, suspend, self-suspend block, rename, archive, audit trail) and
  confirmed all pass.

## Deviations from the plan (convention fixes; design unchanged)

1. **Contract validator semantics.** The plan's `parseAddUserToGroupRequest`
   snippet threw `PublicApiError` and stripped unknown keys. Every existing
   contracts validator throws `TypeError` and rejects unknown keys; route
   handlers wrap `TypeError` into `INVALID_INPUT` → 400. The validator now
   follows the codebase convention (`parseStrictObject` +
   `rejectUnknownFields` + `parseRecordId<GroupId>`), and its tests assert
   `TypeError`.
2. **Service command shape in route-handler sketches.** The plan used
   `actorId`; the implemented services use `actorUserId` with branded
   `UserId`/`GroupId` types. Handlers and tests use the real shapes.
3. **Dialog state reset without effects.** The plan reset dialog state in
   `useEffect`; the project's ESLint `react-hooks/set-state-in-effect` rule
   forbids that. Confirm dialogs now reset in a `close()` handler, and the
   groups dialogs mount/unmount conditionally so `useState` initializes
   fresh.
4. **Vitest mock hygiene.** Tests use `mockReset()` (not `mockClear()`) in
   `beforeEach` so unconsumed `mockResolvedValueOnce` values from a failed
   test cannot leak into the next one.
5. **Page header action.** Plan option (b) taken: the page-header "Add user
   to group" button is removed; the live trigger lives in the detail panel
   next to Suspend account.

## Deferred

- Effective permissions panel, override Save, Platform Admin
  promotion/demotion, role changes within a group, group ownership transfer,
  restoration UI for archived users/groups, server-side search, pagination,
  bulk actions, mobile admin surface.
