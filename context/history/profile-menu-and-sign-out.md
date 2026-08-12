# Profile menu and sign out

Subtasks:

- Design spec and implementation plan for the profile menu and sign out work
- `verify-session.ts` extended to read `email` and `image` from the Better Auth session and surface them on `VerifiedSession`
- `AuthIdentityInput` (`packages/db/src/repositories/identity-access.ts`) widened to carry `email` and `imageUrl`, threaded through `loadAppIdentity` and `loadRuntimeIdentity`
- `AppIdentity` and `AppIdentitySummary` contracts extended with `displayName`, `email`, and nullable `imageUrl`; the strict parsers validate all three
- `/api/identity/me` route returns the three profile fields on the summary payload
- Web `ProfileMenu` client component (`apps/web/app/components/profile-menu.tsx`) with avatar button, initials fallback, dropdown panel, Escape / outside-click close, and `signOut` + `router.refresh()` on success
- Mobile `ProfileMenu` component (`apps/mobile/src/components/profile-menu.tsx`) with `Pressable` avatar, initials fallback, backdrop close, and `signOut` + gate retry on success
- `MobileMemberGate` exposes a sign-out callback via a new `MobileSignOutContext` so `MemberPage` can trigger the gate's clear-and-retry flow
- Web layouts (`(member)/layout.tsx`, `admin/layout.tsx`) render `ProfileMenu` with the signed-in profile fields; admin header gains a profile area
- Mobile `MemberPage` reads `displayName`, `email`, `imageUrl` from `useMobileAppIdentity()` and renders `ProfileMenu` in the header
- Mock `profile-mia.jpg` deleted from `apps/mobile/assets/images/` and `apps/web/public/images/`; the single web fixture usage in the active-order avatar stack switched to an `M` initials span
- `globals.css` styles for `.profile-menu`, `.profile-menu__avatar-button`, `.profile-menu__initials`, `.profile-menu__panel`, `.profile-menu__identity`, `.profile-menu__divider`, `.profile-menu__sign-out`, `.profile-menu__error`, and `.admin-header__profile`

## Session notes

- Implemented on `task/profile-menu-and-sign-out` off the V1-07 + Multi-group foundation `main`. The visible header on web member, web admin, and mobile member surfaces now shows the signed-in user's real Google profile picture and surfaces a working Sign out.
- The backend wiring is additive only — no new tables, columns, or migrations. The existing `verify-session` already had access to the Better Auth session; it now extracts `email` and `image`, normalizes image to `string | null`, and threads the pair into `AuthIdentityInput` so `loadAppIdentity` can return them on `AppIdentity` without an extra database read. The mobile `/api/identity/me` route returns the same three fields on `AppIdentitySummary`.
- The web `ProfileMenu` is a client component rendered inside the server-layout access view. Server layouts read the profile fields from `getCurrentServerPageIdentity()` and pass them as props; the dropdown opens on avatar click, closes on Escape, outside click, or successful sign-out, and calls `authClient.signOut()` followed by `router.refresh()` so the server layout re-evaluates identity and the access gate renders the existing sign-in prompt. Sign-out failures surface an inline `Could not sign out.` message with a Try again button so the user is never in an ambiguous signed-in/signed-out state.
- The mobile `ProfileMenu` mirrors the same visual structure. Because `MemberPage` is reused by every member screen, it reads profile fields directly from `useMobileAppIdentity()` (already provided via `MobileAppIdentityContext`) instead of threading props through every screen. A new `MobileSignOutContext` (populated by `MobileMemberGate` when the gate enters the authenticated branch) exposes `() => getMobileAuthClient().signOut().then(identityState.retry)` so any descendant can clear the session and ask the gate to re-evaluate. After sign-out, the gate's next identity fetch sees no cookie and renders the existing unauthenticated surface — no new sign-in screen is built.
- Initials fallback: when `imageUrl` is `null`, empty, or fails to load, the avatar shows the uppercase first letter of `displayName` (or `?` if `displayName` is also missing) inside a colored circle. The web avatar uses `next/image` with `unoptimized` so arbitrary Google profile picture URLs render without `remotePatterns` config changes.
- Avatar stack fixture cleanup: `apps/web/app/(member)/page.tsx` used `/images/profile-mia.jpg` for one of the four avatar-stack entries in the active-order preview. That single `<Image>` was replaced with an `<span>M</span>` initials fallback so the asset could be deleted without breaking the page; the existing `JD`, `AK`, and `+3` entries were already initials-style.
- Testing additions:
  - `apps/web/app/components/profile-menu.test.tsx` — jsdom-env vitest tests for image render, initials fallback, empty-name `?` fallback, open/close on click, Escape, and outside-click, successful sign-out + router refresh, and sign-out rejection surfacing Try again. The repo root `package.json` adds `@testing-library/dom`, `@testing-library/react`, and `jsdom` as devDependencies; the test file uses a `// @vitest-environment jsdom` docblock so the rest of the suite keeps the default Node environment.
  - `apps/mobile/src/components/profile-menu.test.tsx` — Jest + React Native Testing Library tests for image render, initials fallback, empty-name `?` fallback, open/close on avatar and backdrop tap, successful sign-out + retry, and sign-out rejection surfacing Try again.
  - `apps/mobile/src/features/access/mobile-member-gate.test.tsx` — extended with a test that mounts a `SignOutProbe` inside the gate, fires the gate-supplied sign-out, and asserts the auth client's `signOut` is called before the gate's `retry`.
  - `apps/web/src/features/access/access-route-handlers.test.ts` — extended with a test that pins `/api/identity/me` propagating a non-null Google `imageUrl` end-to-end through the response summary.
  - `apps/web/app/shell-navigation.test.tsx` — extended with assertions that the member and admin headers render the avatar button's profile-menu aria-label from `getCurrentServerPageIdentity()`.
  - `apps/mobile/src/features/access/use-app-identity.test.ts` and the mobile test fixtures in `member-access-state.test.tsx` / `member-navigation.test.tsx` updated to include the three new profile fields wherever they construct an `AppIdentitySummary`.
- Provider-free verification from a clean working tree on `task/profile-menu-and-sign-out`:
  - `npm run test:unit` (Vitest): 59 of 60 server test files pass with 332 of 333 tests. The single failure (`apps/web/app/shell-navigation.test.tsx > shows every real membership with its exact role`) requires `DATABASE_URL` at test time and fails identically on the previous commit `d727b15` before any of this session's work; it is not caused by this bundle and is tracked separately.
  - `npm run test:mobile` (Jest + React Native Testing Library): 14 of 14 suites pass with 51 of 51 tests, including the new `apps/mobile/src/components/profile-menu.test.tsx` and the extended `mobile-member-gate.test.tsx`.
  - `npm run lint` from root: 0 errors. One pre-existing React Hooks warning remains in `apps/mobile/src/features/access/admin-decision-panel.tsx` (untouched by this bundle).
  - `npm run typecheck` from root: passes for every workspace.
  - `npm run build:web`: every workspace build succeeds and the Next.js production build completes, including the new `(member)` and `admin` layout compositions with `ProfileMenu`.

## What's deferred

- Settings screen, profile editing, account management, theme picker, or any profile mutation beyond Sign out.
- Mobile admin surface — admin remains web-only.
- Switching accounts without signing out first.
- Showing email verification status (Google-verified emails are already trusted).
- Provider-backed browser and Android emulator acceptance (owned by the user as part of the split acceptance approach; see "What the user needs to run with credentials" below).

## What the user needs to run with credentials

- Manual browser checks: web member header shows real name/picture after Google sign-in; web admin header shows real name/picture; Sign out on both surfaces returns the user to the existing sign-in prompt.
- Manual Android emulator checks: mobile member header shows real name/picture; Sign out returns the user to the existing Sign in with Google surface.
- `npm run test:providers` with `DATABASE_MIGRATION_URL` if a provider-backed pass is desired before merging (this bundle adds no migrations and no new DB writes, so a provider pass is not strictly required for safety).
