# Users & Permissions Real Users List

**Branch:** `task/users-and-permissions-real-users`
**Squash title:** `Users & permissions real users list`
**Date:** 2026-08-13

## What landed

- `listUsersWithSummary()` repository method joins `users` to `auth_users` and
  bundles each user's active memberships.
- `usersRuntime.listUsersForAdmin()` resolves group names and maps roles
  (`owner → group-owner`).
- The Users & Permissions admin page now renders real users, real group roles,
  and the Platform Admin pill. The admin (self) appears in the list.
- Working client-side search by name or email, case-insensitive, with
  auto-selection of the first visible row when the current selection is
  filtered out.
- The Effective permissions panel and Save override button are removed; the
  "Add user to group" and "Suspend account" buttons remain visible but disabled
  with a `Coming soon` tooltip.
- The page uses Next.js Suspense streaming so the admin shell paints first and
  the list streams in once Neon responds. The skeleton reuses existing
  `admin-panel` / `admin-user-row` / `member-avatar` classes — no new CSS.
- Avatars use `next/image` with `unoptimized` for remote URLs, matching the
  Profile Menu pattern; initials fallback (`?` for empty names) otherwise.

## Verification

- `npm run test:unit` — 392 / 392 tests pass across 72 files, including the
  new `UsersAdminView` component tests (9 cases).
- `npm run test:providers -- packages/db/src/repositories/repositories.provider.integration.test.ts`
  — 13 / 13 tests pass, including the new "lists users with profile, admin
  flag, and active memberships" integration test.
- `npm run lint` — clean (one pre-existing `react-hooks/exhaustive-deps`
  warning in `apps/mobile/src/features/access/admin-decision-panel.tsx`,
  unrelated to this work).
- `npm run typecheck` — clean across all workspaces.
- `npm run build --workspace apps/web` — succeeds.
- **Manual browser verification: pending.** The steps in the spec require a
  Platform Admin Google sign-in that only the product owner can perform.

## Deviations from the plan (test-only fixes; design unchanged)

The plan as written contained two test bugs that would have failed against a
correct implementation. Both were test-data fixes; the design spec is
unchanged and the implementation matches it.

1. **Repository integration test email expectations.** The plan's test
   asserted the `email` value passed to `ensureUserForAuthIdentity`, but that
   parameter is never persisted — it passes through to AppIdentity at
   runtime. The canonical email source is `auth_users.email` (per the design
   spec, "users left-joined to auth_users"). Fixed by capturing the seeded
   `authUsers.email` values in named constants and asserting against those.
2. **Component test `getByText` collisions.** The selected user's name
   appears in both the list row and the detail header by design. The plan's
   test used `getByText`, which throws on multiple matches. Changed to
   `getAllByText(...).length > 0` for the three presence assertions where
   this collision occurs (Alice default-selected; Jordan and Mia each
   auto-selected after filtering).

A third plan deviation was made for code consistency: the component uses
`next/image` (with `unoptimized`) instead of plain `<img>`, matching the
existing Profile Menu and avoiding a `@next/next/no-img-element` lint
warning. The component test still passes because `next/image` renders an
`<img>` in jsdom.

## Pre-existing failure noted, not addressed

`packages/db/src/schema/schema.provider.integration.test.ts` fails on `main`
and on this branch with the same error — it expects a
`group_invite_links_status_values` constraint but a different constraint
fires first. Unrelated to this work and not touched here.

## Deferred

- Effective permissions / override grid / Save — Effective permissions
  foundation bundle.
- Working "Add user to group" — Group membership journey bundle.
- Working "Suspend account" — Platform Admin operations bundle.
