# Profile Menu and Sign Out — Design

**Date:** 2026-08-11
**Status:** Spec — pending implementation plan
**Scope:** Mobile (member), Web (member), Web (admin)

## Goal

Make the user's profile picture in the app header clickable, surface the
signed-in user's real name, email, and picture (replacing today's hardcoded
mock data), and provide a working Sign out button. Cover all three places
where a header is rendered today: mobile member header, web member header,
and web admin header.

## Background

The app authenticates through Better Auth (Google sign-in). The `auth_users`
table already stores each user's `name`, `email`, and `image` (the Google
profile picture URL). However, the existing identity surface
(`AppIdentity` on web, `AppIdentitySummary` on mobile) only exposes role
and membership data — not profile fields. As a result the UI shows a
hardcoded `profile-mia.jpg` image in the header with no name, no click
target, and no sign out.

## Non-goals

- No new identity provider integration.
- No new database tables, columns, or migrations.
- No settings screen, profile editor, account management, or theme picker.
  The dropdown ships with name, email, and Sign out only.
- No mobile admin surface (admin remains web-only).

## Architecture

One new `ProfileMenu` UI pattern, two platform-specific implementations:

| Surface | Today | After |
| --- | --- | --- |
| Mobile member header (`MemberPage`) | Static mock Mia image | Real avatar; tap opens a small dropdown with picture, name, email, Sign out |
| Web member header (`(member)/layout.tsx`) | Static mock Mia image | Real avatar; click opens the same dropdown |
| Web admin header (`admin/layout.tsx`) | No profile area at all | New avatar in the header; click opens the same dropdown |

Sign out relies on existing access gates. After the session is cleared,
the app re-evaluates identity. On web, the layout's existing access view
shows the sign-in prompt. On mobile, `MobileMemberGate` re-renders into
its unauthenticated state and shows the existing Sign in with Google
surface. No new sign-in screen is built.

## Data Flow and Contract Changes

Extend the existing identity contracts to carry profile fields. Both
types get the same three additive fields. All are nullable so the UI can
fall back gracefully.

**`AppIdentity`** (`packages/contracts` — server-side web identity):

```ts
export type AppIdentity = Readonly<{
  authUserId: string;
  displayName: string;
  email: string;
  imageUrl: string | null;
  isPlatformAdmin: boolean;
  memberships: readonly GroupMembershipIdentity[];
  userId: UserId;
}>;
```

**`AppIdentitySummary`** (`packages/contracts/src/access/identity-summary.ts`
— mobile identity response):

```ts
export type AppIdentitySummary = Readonly<{
  displayName: string;
  email: string;
  imageUrl: string | null;
  isPlatformAdmin: boolean;
  memberships: readonly Readonly<{
    groupId: GroupId;
    role: "group-owner" | "manager" | "member";
  }>[];
  pendingAdminRequestCount: number;
}>;
```

**Source of data:** Today `AuthIdentityInput` (in
`packages/db/src/repositories/identity-access.ts`) only carries
`authUserId` and `displayName`. The session verifier on web
(`verify-session.ts`) already has access to the full Better Auth session,
which contains the auth user's name, email, and image. Extend
`AuthIdentityInput` to add `email` and `imageUrl` so the verifier can
thread the auth-user profile through `loadAppIdentity` without a separate
database read.

- `verify-session.ts` reads name/email/image from the verified Better
  Auth session and passes them into `AuthIdentityInput`.
- `loadAppIdentity` passes them through into `AppIdentity`.
- The mobile `/api/identity/me` route handler does the same session read
  and returns the same three fields in `AppIdentitySummary`.
- If a profile field is missing (rare — Google always returns name and
  email), `displayName` falls back to `"Your account"`, `email` falls
  back to an empty string, and `imageUrl` falls back to `null`.

**No new endpoints, no new tables, no new migrations.** Existing
`/api/identity/me` (mobile) and `getCurrentServerPageIdentity()` (web)
return the extended shape.

## UI Components

### Web `ProfileMenu`

**New file:** `apps/web/app/components/profile-menu.tsx`.

A client component that renders an avatar button and, when opened, an
absolute-positioned dropdown panel. Server-rendered parent layouts pass
the profile fields in as props. The component:

- Renders an `<img>` (or `<Image>`) for the avatar when `imageUrl` is
  present, otherwise an initials circle.
- Toggles the dropdown on avatar click.
- Closes on outside click, Escape key, or after invoking Sign out.
- Calls `authClient.signOut()` on click, then calls `router.refresh()` so
  the layout re-evaluates identity and the access gate shows the sign-in
  prompt.
- Shows picture + name + email at the top of the dropdown, a divider, and
  a Sign out button.

**Used in:**

- `apps/web/app/(member)/layout.tsx` — replaces the static Mia `<Image>`.
- `apps/web/app/admin/layout.tsx` — adds a new profile area to the right
  side of the admin header.

### Mobile `ProfileMenu`

**New file:** `apps/mobile/src/components/profile-menu.tsx`.

A React Native component with the same visual structure. Uses a
`Pressable` avatar that toggles an absolutely-positioned `View` panel
with a backdrop `Pressable` to close on outside taps. The component:

- Renders the profile image when `imageUrl` is present, otherwise an
  initials circle.
- Calls `getMobileAuthClient().signOut()`, then calls the identity
  hook's `retry()` so `MobileMemberGate` re-evaluates and renders the
  unauthenticated surface.

**Used in:** `apps/mobile/src/components/member-page.tsx`, replacing the
static Mia `Image`.

### Initials fallback

If `imageUrl` is `null`, empty, or fails to load, the avatar shows the
first letter of `displayName` in uppercase inside a colored circle. If
`displayName` is also missing, the letter is `?`. No broken-image icons.

### Mock asset cleanup

After the new components are wired:

- Delete `apps/mobile/assets/images/profile-mia.jpg`.
- Delete `apps/web/public/images/profile-mia.jpg`.
- Remove the import from `apps/mobile/src/components/member-page.tsx`.
- Remove the `<Image>` reference from
  `apps/web/app/(member)/layout.tsx`.

## Sign Out Flow

1. User taps/clicks Sign out in the dropdown.
2. The dropdown shows a brief "Signing out…" disabled state.
3. The component calls the platform's `signOut()` (already exposed by the
   existing auth clients).
4. On success:
   - **Web:** call `router.refresh()`. The server layout re-evaluates
     identity, sees no session, and the existing access view renders the
     sign-in prompt.
   - **Mobile:** call `identityState.retry()`. `MobileMemberGate`
     re-runs its identity fetch, sees no cookie, and renders the existing
     unauthenticated surface.
5. On failure: keep the dropdown open, replace the Sign out button with
   an error message and a Try again button.

## Edge Cases

- **Missing picture:** initials fallback.
- **Missing display name:** show "Your account".
- **Long email:** truncate with ellipsis at the panel boundary; full
  email available via `title` attribute on web and
  `accessibilityLabel` on mobile.
- **Sign out network failure:** keep the dropdown open with an inline
  error; never leave the user in an ambiguous signed-in/signed-out
  state.
- **`useSession` not used:** this design does not rely on Better Auth's
  client `useSession` hook. Identity (including profile fields) flows
  through the existing identity surfaces only.

## Testing

**Contract tests** (`packages/contracts`):

- `AppIdentity` parser accepts and rejects the new fields.
- `AppIdentitySummary` parser (`parseAppIdentitySummary`) accepts the
  three new fields, rejects unknown fields, accepts `null` for
  `imageUrl`.

**Web `ProfileMenu` tests** (`apps/web/app/components/profile-menu.test.tsx`):

- Renders with name, email, and picture.
- Renders initials fallback when `imageUrl` is `null`.
- Opens and closes the dropdown on click, outside click, and Escape.
- Calls `signOut` on Sign out click and triggers `router.refresh()`.
- Shows error state when `signOut` rejects.

**Mobile `ProfileMenu` tests** (`apps/mobile/src/components/profile-menu.test.tsx`):

- Renders with name, email, and picture.
- Renders initials fallback when `imageUrl` is `null`.
- Opens and closes the panel on tap and backdrop tap.
- Calls `signOut` and the identity retry callback on Sign out tap.
- Shows error state when `signOut` rejects.

**Integration:**

- Web layout integration test confirms profile fields propagate from
  `getCurrentServerPageIdentity()` into the rendered header.
- Mobile identity endpoint test confirms `/api/identity/me` returns the
  three new fields.

**Manual verification:**

- Web member header shows real name/picture after Google sign-in.
- Web admin header shows real name/picture.
- Mobile member header shows real name/picture.
- Sign out returns the user to the existing sign-in prompt on all three
  surfaces.

## Workflow

Per the updated `AGENTS.md`:

- Branch from `main`: `task/profile-menu-and-sign-out` (numbering to be
  confirmed against `context/progress-tracker.md` at plan time — this
  work is not currently numbered as a V1-XX task).
- Commit work on the branch with descriptive messages.
- Update `context/progress-tracker.md` after the change lands.
- Squash-merge to `main` when complete and verified.

## Out of Scope (restated)

- Settings screen, profile editing, theme picker, account management.
- Mobile admin surface.
- Switching accounts without signing out first.
- Showing email verification status (Google-verified emails are already
  trusted).
