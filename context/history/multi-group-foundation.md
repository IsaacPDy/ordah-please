# Multi-group foundation

Subtasks:

- Multi-group foundation design and implementation plan
- Replace active Organizer vocabulary with Manager across domain, contracts, schema, and UI
- Drizzle schema and `0003_multi_group_foundation.sql` migration with data-preserving enum and column renames
- Active-owner preflight, single-active-group-per-user index removal, and one-active-owner-per-group unique index
- Multi-membership identity load through `AppIdentity` with account-wide Platform Admin flag
- Group-scoped access contracts requiring explicit `groupId` on every group-scoped request
- Multi-group invitation acceptance and requested-group authorization with same-group conflict and member-management guards
- Server-rendered member and admin page gates via one request-cached page-identity loader
- Strict shared identity-summary contract consumed by web and Android
- Honest no-membership web states for Home, Orders, and Groups
- Android identity hook and multi-membership rendering with no-membership states
- Provider-backed migration and transaction verification
- Brand-led sign-in screen on web and mobile

## Session Notes

- Implemented on `task/multi-group-foundation` off the reviewed V1-06 `main`. The one-group access boundary is replaced by explicit group-scoped memberships, the legacy Organizer vocabulary is cut over to Manager, and every group-scoped API carries an explicit `groupId` and authorizes against the matching membership.
- Domain and contracts rename `organizerId`, `organizerInitialVote`, `OrganizerResolution`, and `organizer_resolution` to `managerId`, `managerInitialVote`, `ManagerResolution`, and `manager_resolution`. `APPLICATION_ROLES` is `member`, `manager`, `group-owner`, `platform-admin`; `ORDER_ROLES` is `participant`, `manager`. Persisted ownership remains `owner`.
- `packages/db/drizzle/0003_multi_group_foundation.sql` runs an active-owner preflight that aborts the migration if any active group has fewer or more than one active owner, drops `memberships_one_active_group_per_user`, renames `orders.organizer_user_id` to `manager_user_id`, renames `membership_role`, `order_participant_role`, and `food_selection_source` enum values from Organizer to Manager vocabulary, and creates `memberships_one_active_owner_per_group`. The food-selection source-fields check constraint is dropped and re-added to reference `manager_resolution`.
- `AppIdentity` exposes every active group membership plus the account-wide Platform Admin flag. Web and Android consume one minimal identity response through `/api/identity/me` and the strict `identity-summary` contract. Groupless users keep restaurant and Favorites access and see honest Orders and Groups empty states instead of mocked active orders.
- Group-scoped access contracts (`packages/contracts/src/access/access-requests.ts`) require an explicit `groupId`. Invitation acceptance permits membership in another group, rejects only a duplicate in the invited group, and returns a stable conflict when same-group invitations race. Group Owners and Platform Admins may issue invitations; member management protects Group Owners from demotion or removal through the requested-group authorization helpers in `apps/web/src/application/group-authorization.ts`.
- Server-rendered member and admin layouts verify one request-cached identity through `apps/web/src/auth/load-server-page-identity.ts` before exposing either navigation shell. Cookie-free `/` and `/admin` render only the sign-in surface and no protected navigation.
- Android loads the identity endpoint through its SecureStore-backed Better Auth cookie via `apps/mobile/src/features/access/use-app-identity.ts`, reloads identity after successful Google sign-in, and renders honest no-membership and multi-membership states on Home, Orders, and Groups.
- Provider verification expanded from 15 to 18 cases, adding legacy-data upgrade preservation, owner-preflight abort, and concurrent same-group invitations; all pass against isolated development-Neon schemas and rollback-only transactions.
- Provider-free verification from a clean install: 54 Vitest files with 276 tests, 12 mobile Jest suites with 42 tests, all workspace builds, typecheck, lint (one pre-existing React Hooks warning in `admin-decision-panel.tsx`), format check, Next.js production build, and `npx expo export --platform android` all succeed.
- The brand-led sign-in screen (`apps/web/src/features/access/sign-in-prompt-view.tsx`, `apps/mobile/src/features/access/mobile-member-gate.tsx`, and supporting globals.css) introduces the `ordah please` brand, tagline, and Google logo at the auth boundary; the redesigned surface is prettier-compliant and the web test was updated to match.
- Persistent Neon migration was applied to the development target (`late-term-azx5mseo`, ap-southeast-1) on 2026-08-03. Post-migration checks confirmed four applied migrations, the new `memberships_one_active_owner_per_group` index, the removed per-user index, `orders.manager_user_id`, and the `manager` enum value on `membership_role`. Production migration was deferred by the user to deploy time.
- Read-only API acceptance verified cookie-free `/` and `/admin` render only the sign-in state, `/api/identity/me` returns `UNAUTHENTICATED` (401), `/api/access/admin-requests/pending` returns `UNAUTHENTICATED` (401), and `/invite/[token]` remains reachable for the invitation flow.
- Live authenticated browser and Android emulator acceptance for groupless, multi-group, cross-group, non-admin, and Platform Admin states are owned by the user as part of the split acceptance approach; the bundle ships based on passing automated verification, build, export, and provider-free plus API-level evidence.
