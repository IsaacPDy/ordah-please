# Profile Menu and Sign Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded mock profile picture in the mobile/web member header and the empty web admin header with a real, clickable profile dropdown that shows the signed-in user's picture, name, and email, plus a Sign out button that returns them to the existing sign-in prompt.

**Architecture:** Extend the existing identity contracts (`AppIdentity`, `AppIdentitySummary`, `AuthIdentityInput`, `VerifiedSession`) to carry three new profile fields (`displayName`, `email`, `imageUrl`) end-to-end. The Better Auth session verifier already has access to these fields — we thread them through. Two new `ProfileMenu` components (one web, one mobile) consume the fields. Sign out reuses the existing access gates: clearing the session causes the layout's existing access view to render the sign-in prompt.

**Tech Stack:** TypeScript, Next.js 15 (web), Expo + React Native (mobile), Drizzle, Better Auth, Vitest (web/contracts), Jest (mobile), React Router (web), Expo Router (mobile).

**Spec:** `docs/superpowers/specs/2026-08-11-profile-menu-and-sign-out-design.md`

---

## File Structure

**Created:**
- `apps/web/app/components/profile-menu.tsx` — web ProfileMenu (client component)
- `apps/web/app/components/profile-menu.test.tsx` — web ProfileMenu tests
- `apps/mobile/src/components/profile-menu.tsx` — mobile ProfileMenu
- `apps/mobile/src/components/profile-menu.test.tsx` — mobile ProfileMenu tests

**Modified:**
- `packages/db/src/repositories/identity-access.ts` — `AuthIdentityInput` adds `email`, `imageUrl`
- `apps/web/src/auth/load-app-identity.ts` — `AppIdentity` adds three fields; passes through from input
- `apps/web/src/auth/verify-session.ts` — `BetterAuthSessionState.user` adds `image`; `VerifiedSession` adds `email`, `imageUrl`
- `apps/web/src/features/access/access-runtime.ts` — `loadRuntimeIdentity` threads new fields
- `apps/web/src/features/access/access-route-handlers.ts` — `/api/identity/me` handler returns profile fields
- `packages/contracts/src/access/identity-summary.ts` — parser accepts new fields
- `apps/web/app/(member)/layout.tsx` — replace static Mia image with `ProfileMenu`
- `apps/web/app/admin/layout.tsx` — add `ProfileMenu` to header
- `apps/mobile/src/components/member-page.tsx` — replace static Mia image with `ProfileMenu`
- Various existing test files updated for the new required fields

**Deleted:**
- `apps/mobile/assets/images/profile-mia.jpg`
- `apps/web/public/images/profile-mia.jpg`

---

## Task 1: Extend `AuthIdentityInput` and `AppIdentity` with profile fields

**Files:**
- Modify: `packages/db/src/repositories/identity-access.ts:7-10` (the `AuthIdentityInput` interface)
- Modify: `apps/web/src/auth/load-app-identity.ts:18-23` (the `AppIdentity` type) and `:32-54` (the loader)
- Test: `apps/web/src/auth/load-app-identity.test.ts`
- Test: `packages/db/src/repositories/identity-access.ts` (existing tests, if any reference `AuthIdentityInput`)

- [ ] **Step 1: Write the failing test**

Add this test to `apps/web/src/auth/load-app-identity.test.ts` (after the existing tests):

```ts
it("surfaces the auth user's profile fields on the loaded identity", async () => {
  const repository = createIdentityRepositoryStub({
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      authUserId: "auth-1",
      displayName: "Stored Name",
      isPlatformAdmin: false,
      archivedAt: null,
    },
  });

  const identity = await loadAppIdentity(
    {
      authUserId: "auth-1",
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
    },
    repository,
  );

  expect(identity).toMatchObject({
    displayName: "Mia Tan",
    email: "mia@example.com",
    imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
  });
});
```

If the existing test file does not already export a `createIdentityRepositoryStub` helper, mirror the stub pattern already used in that file. The stub must return whatever shape `loadAppIdentity` reads from `repository.ensureUserForAuthIdentity`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run apps/web/src/auth/load-app-identity.test.ts`
Expected: FAIL with a TypeScript error (`email` and `imageUrl` do not exist on `AuthIdentityInput`) or a runtime mismatch.

- [ ] **Step 3: Extend `AuthIdentityInput`**

Edit `packages/db/src/repositories/identity-access.ts` so the interface reads:

```ts
export interface AuthIdentityInput {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}
```

- [ ] **Step 4: Extend `AppIdentity` and the loader**

Edit `apps/web/src/auth/load-app-identity.ts` so the type and loader read:

```ts
export interface AppIdentity {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
  readonly isPlatformAdmin: boolean;
  readonly memberships: readonly GroupMembershipIdentity[];
  readonly userId: UserId;
}
```

```ts
export async function loadAppIdentity(
  authIdentity: AuthIdentityInput,
  repository: IdentityReader,
): Promise<AppIdentity> {
  const user = await repository.ensureUserForAuthIdentity(authIdentity);
  if (user.archivedAt !== null) {
    throw new PublicApiError("UNAVAILABLE", "Your account is not available.");
  }

  const memberships = (await repository.listActiveMemberships(user.id))
    .map((membership) => ({
      groupId: parseId<GroupId>(membership.groupId),
      role: MEMBERSHIP_ROLE_MAP[membership.role],
    }))
    .sort((left, right) => left.groupId.localeCompare(right.groupId));

  return {
    authUserId: authIdentity.authUserId,
    displayName: authIdentity.displayName,
    email: authIdentity.email,
    imageUrl: authIdentity.imageUrl,
    isPlatformAdmin: user.isPlatformAdmin,
    memberships,
    userId: parseId<UserId>(user.id),
  };
}
```

- [ ] **Step 5: Update existing tests that call `loadAppIdentity`**

Search for all test files that construct an `AuthIdentityInput` or assert on `AppIdentity`:

Run: `grep -rn "loadAppIdentity\|authUserId:" apps/web/src packages/db/src --include="*.test.ts"`

For each call site that passes an `authIdentity` literal, add `email: "..."` and `imageUrl: null` (or a string URL) to the literal. For each assertion that uses `toMatchObject` against an `AppIdentity`, the new fields are accepted automatically; for `toEqual` assertions, add the three new keys.

- [ ] **Step 6: Run all affected tests**

Run: `npm run test:unit -- --run apps/web/src/auth/load-app-identity.test.ts packages/db`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/repositories/identity-access.ts apps/web/src/auth/load-app-identity.ts apps/web/src/auth/load-app-identity.test.ts
git commit -m "feat(identity): add profile fields to AuthIdentityInput and AppIdentity"
```

---

## Task 2: Extend `VerifiedSession` and `verifySession` to extract profile from Better Auth

**Files:**
- Modify: `apps/web/src/auth/verify-session.ts:5-45`
- Test: `apps/web/src/auth/verify-session.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `apps/web/src/auth/verify-session.test.ts`:

```ts
it("returns the auth user's email and image alongside the user id and name", async () => {
  const request = new Request("https://app.example.com/");
  const verify = (input: { readonly headers: Headers }) =>
    Promise.resolve<BetterAuthSessionState>({
      session: { expiresAt: futureDate, id: "session-1" },
      user: {
        email: "mia@example.com",
        id: "auth-1",
        image: "https://lh3.googleusercontent.com/mia.jpg",
        name: "Mia Tan",
      },
    });

  const session = await verifySession(request, verify, now);

  expect(session).toEqual({
    authUserId: "auth-1",
    displayName: "Mia Tan",
    email: "mia@example.com",
    imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
  });
});

it("returns a null image url when the auth user has no picture", async () => {
  const request = new Request("https://app.example.com/");
  const verify = (input: { readonly headers: Headers }) =>
    Promise.resolve<BetterAuthSessionState>({
      session: { expiresAt: futureDate, id: "session-1" },
      user: {
        email: "mia@example.com",
        id: "auth-1",
        image: null,
        name: "Mia Tan",
      },
    });

  const session = await verifySession(request, verify, now);

  expect(session.imageUrl).toBeNull();
});
```

Use the same `futureDate` and `now` fixtures the existing tests already use (mirror their setup).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run apps/web/src/auth/verify-session.test.ts`
Expected: FAIL with TypeScript errors on `image` not existing on the user type, and `email`/`imageUrl` not on `VerifiedSession`.

- [ ] **Step 3: Extend types and extractor**

Replace the contents of `apps/web/src/auth/verify-session.ts` with:

```ts
import { PublicApiError } from "@ordah-please/contracts";

import { getServerAuth } from "./server-auth";

export interface BetterAuthSessionState {
  readonly session: {
    readonly expiresAt: Date;
    readonly id: string;
  };
  readonly user: {
    readonly email: string;
    readonly id: string;
    readonly image: string | null;
    readonly name: string;
  };
}

export type ReadBetterAuthSession = (input: {
  readonly headers: Headers;
}) => Promise<BetterAuthSessionState | null>;

export interface VerifiedSession {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}

/** Rejects requests without a live Better Auth session and returns trusted identity fields only. */
export async function verifySession(
  request: Request,
  readSession: ReadBetterAuthSession = ({ headers }) =>
    getServerAuth().api.getSession({ headers }),
  now: Date = new Date(),
): Promise<VerifiedSession> {
  const sessionState = await readSession({ headers: request.headers });
  if (
    sessionState === null ||
    sessionState.session.expiresAt.getTime() <= now.getTime()
  ) {
    throw new PublicApiError("UNAUTHENTICATED", "Sign in is required.");
  }

  return {
    authUserId: sessionState.user.id,
    displayName: sessionState.user.name,
    email: sessionState.user.email,
    imageUrl: sessionState.user.image,
  };
}
```

- [ ] **Step 4: Update existing verify-session tests**

Existing tests in `verify-session.test.ts` that build a `BetterAuthSessionState` literal need to add `image: null` to the `user` object (or a URL string where appropriate). Existing assertions on `VerifiedSession` need to add `email: "..."` and `imageUrl: null` (or matching value).

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test:unit -- --run apps/web/src/auth/verify-session.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/auth/verify-session.ts apps/web/src/auth/verify-session.test.ts
git commit -m "feat(auth): extract email and image from Better Auth session"
```

---

## Task 3: Thread profile fields through `loadRuntimeIdentity`

**Files:**
- Modify: `apps/web/src/features/access/access-runtime.ts:56-67`
- Test: `apps/web/src/features/access/access-runtime.ts` (or `.test.ts` if present)

- [ ] **Step 1: Write the failing test**

If `access-runtime.ts` does not have a co-located test, the change is exercised end-to-end by the route handler tests in Task 4. In that case skip Step 1–2 and go straight to Step 3. Otherwise add:

```ts
it("passes email and image url from the session into the identity loader", async () => {
  // Build the runtime against a stubbed database + repository that records
  // the AuthIdentityInput it received. Assert the recorded input includes
  // email and imageUrl from the session.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --run apps/web/src/features/access/access-runtime`
Expected: FAIL (or skip if no co-located test).

- [ ] **Step 3: Update `loadRuntimeIdentity`**

Edit `apps/web/src/features/access/access-runtime.ts:56-67` so the function reads:

```ts
/** Provisions and loads the authenticated user's current product identity from Neon. */
export function loadRuntimeIdentity(session: {
  readonly authUserId: string;
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}) {
  return loadAppIdentity(
    {
      authUserId: session.authUserId,
      displayName: session.displayName,
      email: session.email,
      imageUrl: session.imageUrl,
    },
    createRepositories(getRuntimeDatabase()).identityAccess,
  );
}
```

- [ ] **Step 4: Run unit tests to confirm nothing breaks**

Run: `npm run test:unit -- --run apps/web/src/features/access`
Expected: PASS (or no test files matched if there are no co-located tests; that is acceptable for this task).

- [ ] **Step 5: Typecheck to catch any caller mismatches**

Run: `npm run typecheck`
Expected: PASS. If typecheck reveals callers that pass a narrower session shape, update those callers to thread the new fields through. Likely sites: anywhere `loadRuntimeIdentity` is invoked with a stub session in tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/access/access-runtime.ts
git commit -m "feat(access): thread profile fields through loadRuntimeIdentity"
```

---

## Task 4: Extend `AppIdentitySummary` parser and `/api/identity/me` response

**Files:**
- Modify: `packages/contracts/src/access/identity-summary.ts:15-22,42-70`
- Modify: `packages/contracts/src/access/identity-summary.test.ts`
- Modify: `apps/web/src/features/access/access-route-handlers.ts:405-436` (the identity-me handler)
- Test: `apps/web/src/features/access/access-route-handlers.test.ts`

- [ ] **Step 1: Write the failing parser test**

Append to `packages/contracts/src/access/identity-summary.test.ts`:

```ts
it("surfaces the auth user's profile fields on the identity summary", () => {
  expect(
    parseAppIdentitySummary({
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
      isPlatformAdmin: false,
      memberships: [],
      pendingAdminRequestCount: 0,
    }),
  ).toEqual({
    displayName: "Mia Tan",
    email: "mia@example.com",
    imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
    isPlatformAdmin: false,
    memberships: [],
    pendingAdminRequestCount: 0,
  });
});

it("accepts a null image url", () => {
  expect(
    parseAppIdentitySummary({
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [],
      pendingAdminRequestCount: 0,
    }).imageUrl,
  ).toBeNull();
});
```

Also update the existing `it.each` rejection cases so each input object includes `displayName`, `email`, and `imageUrl: null` — otherwise the new "reject unknown fields" parser will reject them for the wrong reason.

- [ ] **Step 2: Run parser test to verify it fails**

Run: `npm run test:unit -- --run packages/contracts/src/access/identity-summary.test.ts`
Expected: FAIL with missing-field TypeError.

- [ ] **Step 3: Update the parser**

Edit `packages/contracts/src/access/identity-summary.ts`:

```ts
export type AppIdentitySummary = Readonly<{
  displayName: string;
  email: string;
  imageUrl: string | null;
  isPlatformAdmin: boolean;
  memberships: readonly Readonly<{
    groupId: GroupId;
    role: (typeof GROUP_MEMBERSHIP_ROLES)[number];
  }>[];
  pendingAdminRequestCount: number;
}>;
```

```ts
/** Validates the minimal authenticated identity shared by web and native clients. */
export function parseAppIdentitySummary(value: unknown): AppIdentitySummary {
  const object = parseStrictObject(value, "App identity summary");
  rejectUnknownFields(
    object,
    [
      "displayName",
      "email",
      "imageUrl",
      "isPlatformAdmin",
      "memberships",
      "pendingAdminRequestCount",
    ],
    "App identity summary",
  );
  const memberships = parseArray(
    object.memberships,
    "Identity memberships",
    parseGroupMembership,
  );
  const uniqueGroupIds = new Set(memberships.map(({ groupId }) => groupId));
  if (uniqueGroupIds.size !== memberships.length) {
    throw new TypeError("Identity memberships contain a duplicate group id.");
  }

  return {
    displayName: parseString(object.displayName, "Display name"),
    email: parseString(object.email, "Email"),
    imageUrl: parseNullableString(object.imageUrl, "Profile image url"),
    isPlatformAdmin: parseBoolean(
      object.isPlatformAdmin,
      "Platform Admin state",
    ),
    memberships,
    pendingAdminRequestCount: parseNonNegativeInteger(
      object.pendingAdminRequestCount,
      "Pending admin request count",
    ),
  };
}
```

`parseNullableString` already exists in `packages/contracts/src/common/strict-boundary.ts:61`.

- [ ] **Step 4: Run parser tests to verify pass**

Run: `npm run test:unit -- --run packages/contracts/src/access/identity-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `/api/identity/me` route handler**

Edit `apps/web/src/features/access/access-route-handlers.ts:405-436`. The handler builds the response from `identity` (an `AppIdentity`). After Task 1, `identity` carries `displayName`, `email`, and `imageUrl`. Replace both `parseAppIdentitySummary({...})` calls inside `createIdentityMeHandler` with versions that include the new fields:

```ts
execute: async ({ identity }) => {
  if (identity.isPlatformAdmin) {
    const pending = await dependencies.countPendingAdminRequests();
    return parseAppIdentitySummary({
      displayName: identity.displayName,
      email: identity.email,
      imageUrl: identity.imageUrl,
      isPlatformAdmin: true,
      memberships: identity.memberships,
      pendingAdminRequestCount: pending.length,
    });
  }
  return parseAppIdentitySummary({
    displayName: identity.displayName,
    email: identity.email,
    imageUrl: identity.imageUrl,
    isPlatformAdmin: false,
    memberships: identity.memberships,
    pendingAdminRequestCount: 0,
  });
},
```

- [ ] **Step 6: Update route handler tests**

Open `apps/web/src/features/access/access-route-handlers.test.ts` and find the `createIdentityMeHandler` test cases. For every test that asserts on the response body, add `displayName`, `email`, and `imageUrl` to the expected object. For every test that stubs `loadIdentity`, ensure the returned `AppIdentity` includes the three new fields.

- [ ] **Step 7: Run route handler tests to verify pass**

Run: `npm run test:unit -- --run apps/web/src/features/access/access-route-handlers.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/contracts/src/access/identity-summary.ts packages/contracts/src/access/identity-summary.test.ts apps/web/src/features/access/access-route-handlers.ts apps/web/src/features/access/access-route-handlers.test.ts
git commit -m "feat(identity): expose profile fields on /api/identity/me response"
```

---

## Task 5: Create the web `ProfileMenu` component

**Files:**
- Create: `apps/web/app/components/profile-menu.tsx`
- Test: `apps/web/app/components/profile-menu.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/app/components/profile-menu.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ProfileMenu } from "./profile-menu";

const baseProfile = {
  displayName: "Mia Tan",
  email: "mia@example.com",
  imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
};

function renderMenu(overrides: Partial<Parameters<typeof ProfileMenu>[0]> = {}) {
  const signOut = vi.fn().mockResolvedValue(undefined);
  const onSignedOut = vi.fn();
  const utils = render(
    <ProfileMenu
      profile={baseProfile}
      signOut={signOut}
      onSignedOut={onSignedOut}
      {...overrides}
    />,
  );
  return { ...utils, signOut, onSignedOut };
}

describe("ProfileMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the profile picture as the avatar button", () => {
    renderMenu();
    const button = screen.getByRole("button", { name: /open profile menu/i });
    expect(button).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Mia Tan"),
    );
  });

  it("shows initials fallback when imageUrl is null", () => {
    renderMenu({ profile: { ...baseProfile, imageUrl: null } });
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("opens the dropdown and shows name, email, and sign out", () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /open profile menu/i }));
    expect(screen.getByText("Mia Tan")).toBeInTheDocument();
    expect(screen.getByText("mia@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("closes the dropdown on Escape", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: /open profile menu/i });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(
      screen.queryByRole("button", { name: /sign out/i }),
    ).not.toBeInTheDocument();
  });

  it("calls signOut and onSignedOut when Sign out is clicked", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /open profile menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => {
      /* signOut resolves */
    });
    expect(signOut).toHaveBeenCalled();
  });

  it("shows an error and Try again when signOut rejects", async () => {
    const signOut = vi.fn().mockRejectedValue(new Error("network"));
    render(
      <ProfileMenu
        profile={baseProfile}
        signOut={signOut}
        onSignedOut={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /open profile menu/i }));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() =>
      expect(screen.getByText(/sign out failed/i)).toBeInTheDocument(),
    );
  });
});
```

If the web test setup does not already import `@testing-library/react`, check `apps/web/package.json` for it. If missing, install it as a dev dependency: `npm install -D @testing-library/react @testing-library/jest-dom --workspace @ordah-please/web`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --run apps/web/app/components/profile-menu.test.tsx`
Expected: FAIL with module-not-found for `./profile-menu`.

- [ ] **Step 3: Create the component**

Create `apps/web/app/components/profile-menu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export interface ProfileMenuProfile {
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}

type ProfileMenuProps = Readonly<{
  profile: ProfileMenuProfile;
  signOut: () => Promise<unknown>;
  onSignedOut: () => void;
}>;

function initial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "?";
  }
  return trimmed[0].toUpperCase();
}

/** Avatar button with a dropdown that surfaces the signed-in user's profile and Sign out. */
export function ProfileMenu({
  profile,
  signOut,
  onSignedOut,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errored, setErrored] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onClick(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setSubmitting(true);
    setErrored(false);
    try {
      await signOut();
      setOpen(false);
      onSignedOut();
    } catch {
      setErrored(true);
    } finally {
      setSubmitting(false);
    }
  }

  const triggerLabel = `Open profile menu for ${profile.displayName}`;

  return (
    <div className="profile-menu" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={triggerLabel}
        className="profile-menu__avatar"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {profile.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="profile-menu__avatar-image"
            src={profile.imageUrl}
          />
        ) : (
          <span aria-hidden="true" className="profile-menu__avatar-initials">
            {initial(profile.displayName)}
          </span>
        )}
      </button>
      {open ? (
        <div className="profile-menu__dropdown" role="menu">
          <div className="profile-menu__identity">
            <p className="profile-menu__name">{profile.displayName}</p>
            <p className="profile-menu__email" title={profile.email}>
              {profile.email}
            </p>
          </div>
          <hr className="profile-menu__divider" />
          {errored ? (
            <div className="profile-menu__error">
              <p>Sign out failed.</p>
              <button
                disabled={submitting}
                onClick={handleSignOut}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : (
            <button
              className="profile-menu__sign-out"
              disabled={submitting}
              onClick={handleSignOut}
              type="button"
            >
              {submitting ? "Signing out…" : "Sign out"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Add CSS classes**

Append to `apps/web/app/globals.css` (or wherever the existing `profile-avatar` class is defined — search the file first):

```css
.profile-menu {
  position: relative;
}

.profile-menu__avatar {
  background: none;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  height: 44px;
  overflow: hidden;
  padding: 0;
  width: 44px;
}

.profile-menu__avatar-image {
  display: block;
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.profile-menu__avatar-initials {
  align-items: center;
  background: var(--accent, #f3a73d);
  color: #fff;
  display: flex;
  font-weight: 700;
  height: 100%;
  justify-content: center;
  width: 100%;
}

.profile-menu__dropdown {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  min-width: 220px;
  padding: 12px;
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 20;
}

.profile-menu__name {
  font-weight: 700;
  margin: 0;
}

.profile-menu__email {
  color: rgba(0, 0, 0, 0.65);
  font-size: 0.875rem;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-menu__divider {
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  margin: 10px 0;
}

.profile-menu__sign-out {
  background: none;
  border: none;
  color: #b91c1c;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 6px 4px;
  text-align: left;
  width: 100%;
}

.profile-menu__error p {
  color: #b91c1c;
  font-size: 0.85rem;
  margin: 0 0 4px;
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test:unit -- --run apps/web/app/components/profile-menu.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/profile-menu.tsx apps/web/app/components/profile-menu.test.tsx apps/web/app/globals.css apps/web/package.json package-lock.json
git commit -m "feat(web): add ProfileMenu component"
```

---

## Task 6: Wire `ProfileMenu` into the web member layout

**Files:**
- Modify: `apps/web/app/(member)/layout.tsx`
- Test: any existing test that asserts on the member layout structure (search for `(member)/layout`)

- [ ] **Step 1: Inspect the current layout test surface**

Run: `grep -rln "profile-mia\|profile-avatar\|MemberLayout" apps/web/app apps/web/src`

If matches exist in test files, open them and identify which assertions will change. If no test file covers this layout's structure, skip directly to Step 3.

- [ ] **Step 2: Write the failing test (only if a layout test exists)**

Update the existing layout test to assert that the rendered output contains a button with aria-label beginning `Open profile menu for` and the actual signed-in user's name. Drop any assertions on the hardcoded Mia image alt text.

- [ ] **Step 3: Replace the static image with `ProfileMenu`**

Edit `apps/web/app/(member)/layout.tsx`. The new contents:

```tsx
import type { ReactNode } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { MemberPageAccessView } from "../../src/features/access/page-access-view";
import { authClient } from "../../src/auth/auth-client";
import { MemberNavigation } from "../components/member-navigation";
import { ProfileMenu } from "../components/profile-menu";

/** Provides the focused member/PWA shell without exposing admin-only information architecture. */
export default async function MemberLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const identityResult = await getCurrentServerPageIdentity();
  const profile =
    identityResult.status === "authenticated"
      ? {
          displayName: identityResult.identity.displayName,
          email: identityResult.identity.email,
          imageUrl: identityResult.identity.imageUrl,
        }
      : null;

  return (
    <MemberPageAccessView result={identityResult}>
      <div className="member-shell">
        <a className="skip-link" href="#member-content">
          Skip to content
        </a>
        <header className="member-header">
          <span className="brand">ordah please</span>
          <div className="member-header__actions">
            <button
              aria-label="Open notifications"
              className="icon-button"
              type="button"
            >
              <Bell aria-hidden="true" size={24} strokeWidth={2.2} />
              <span aria-hidden="true" className="notification-dot" />
            </button>
            {profile ? (
              <MemberProfileMenu
                displayName={profile.displayName}
                email={profile.email}
                imageUrl={profile.imageUrl}
              />
            ) : null}
          </div>
        </header>
        <main className="member-content" id="member-content">
          {children}
        </main>
        <MemberNavigation />
      </div>
    </MemberPageAccessView>
  );
}

/** Client wrapper that hands the ProfileMenu its sign-out callback and refresh hook. */
function MemberProfileMenu(props: {
  displayName: string;
  email: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  return (
    <ProfileMenu
      profile={props}
      signOut={() => authClient.signOut()}
      onSignedOut={() => router.refresh()}
    />
  );
}
```

Note the removal of the `next/image` import and the Mia image.

- [ ] **Step 4: Run any layout tests; typecheck**

Run: `npm run test:unit -- --run apps/web/app/\(member\)`
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(member\)/layout.tsx
git commit -m "feat(web): wire ProfileMenu into member layout"
```

---

## Task 7: Wire `ProfileMenu` into the web admin layout

**Files:**
- Modify: `apps/web/app/admin/layout.tsx`

- [ ] **Step 1: Add `ProfileMenu` to the admin header**

Edit `apps/web/app/admin/layout.tsx`. New contents:

```tsx
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { AdminPageAccessView } from "../../src/features/access/page-access-view";
import { authClient } from "../../src/auth/auth-client";
import { AdminNavigation } from "../components/admin-navigation";
import { ProfileMenu } from "../components/profile-menu";

/** Provides a dense admin shell that remains structurally separate from the member experience. */
export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const identityResult = await getCurrentServerPageIdentity();
  const profile =
    identityResult.status === "authenticated"
      ? {
          displayName: identityResult.identity.displayName,
          email: identityResult.identity.email,
          imageUrl: identityResult.identity.imageUrl,
        }
      : null;

  return (
    <AdminPageAccessView result={identityResult}>
      <div className="admin-shell">
        <a className="skip-link" href="#admin-content">
          Skip to content
        </a>
        <aside className="admin-sidebar">
          <span className="brand">ordah please</span>
          <AdminNavigation />
        </aside>
        <div className="admin-workspace">
          <header className="admin-header">
            <p className="admin-workspace-title">Admin workspace</p>
            {profile ? (
              <AdminProfileMenu
                displayName={profile.displayName}
                email={profile.email}
                imageUrl={profile.imageUrl}
              />
            ) : null}
          </header>
          <main className="admin-content" id="admin-content">
            {children}
          </main>
        </div>
      </div>
    </AdminPageAccessView>
  );
}

/** Client wrapper that hands the ProfileMenu its sign-out callback and refresh hook. */
function AdminProfileMenu(props: {
  displayName: string;
  email: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  return (
    <ProfileMenu
      profile={props}
      signOut={() => authClient.signOut()}
      onSignedOut={() => router.refresh()}
    />
  );
}
```

- [ ] **Step 2: Adjust admin header CSS for right-alignment**

Open `apps/web/app/globals.css` and locate the `.admin-header` rule. Update it to display its children with `display: flex; justify-content: space-between; align-items: center;`. If `.admin-header` does not exist, add:

```css
.admin-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/admin/layout.tsx apps/web/app/globals.css
git commit -m "feat(web): wire ProfileMenu into admin header"
```

---

## Task 8: Delete the mock Mia asset on web

**Files:**
- Delete: `apps/web/public/images/profile-mia.jpg`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "profile-mia" apps/web`
Expected: no matches. If anything still references it, fix the reference before deleting.

- [ ] **Step 2: Delete the file**

```bash
git rm apps/web/public/images/profile-mia.jpg
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(web): remove mock profile image asset"
```

---

## Task 9: Plumb profile fields through mobile identity state

**Files:**
- Modify: `apps/mobile/src/features/access/mobile-member-gate.tsx` (the context value type and provider)
- Modify: `apps/mobile/src/features/access/use-app-identity.ts` (no code change needed if the contract parser already exposes the new fields; re-verify types compile)
- Test: `apps/mobile/src/features/access/use-app-identity.test.tsx`
- Test: `apps/mobile/src/features/access/mobile-member-gate.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/src/features/access/use-app-identity.test.tsx` (mirror the existing test pattern):

```tsx
it("exposes displayName, email, and imageUrl from the identity response", async () => {
  // Stub the request function to return an envelope whose data includes the
  // three new profile fields. Render the hook, advance, and assert the
  // returned identity includes them.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:mobile -- --run src/features/access/use-app-identity.test.tsx`
Expected: FAIL with missing fields.

- [ ] **Step 3: Extend the mobile identity context value**

Edit `apps/mobile/src/features/access/mobile-member-gate.tsx`. The `EMPTY_IDENTITY` constant and the `MobileAppIdentityProvider` already use the `AppIdentitySummary` type from contracts, which Task 4 extended. No code change is needed here unless TypeScript complains — if so, add the three fields to `EMPTY_IDENTITY`:

```ts
const EMPTY_IDENTITY: AppIdentitySummary = {
  displayName: "",
  email: "",
  imageUrl: null,
  isPlatformAdmin: false,
  memberships: [],
  pendingAdminRequestCount: 0,
};
```

- [ ] **Step 4: Run mobile tests to confirm**

Run: `npm run test:mobile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/access/mobile-member-gate.tsx apps/mobile/src/features/access/use-app-identity.test.tsx
git commit -m "feat(mobile): expose profile fields on the identity context"
```

---

## Task 10: Create the mobile `ProfileMenu` component

**Files:**
- Create: `apps/mobile/src/components/profile-menu.tsx`
- Test: `apps/mobile/src/components/profile-menu.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/components/profile-menu.test.tsx`:

```tsx
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as React from "react";
import { describe, expect, it, vi } from "jest-globals";

import { ProfileMenu } from "./profile-menu";

const baseProfile = {
  displayName: "Mia Tan",
  email: "mia@example.com",
  imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
};

function renderMenu(overrides: Partial<Parameters<typeof ProfileMenu>[0]> = {}) {
  const signOut = vi.fn().mockResolvedValue(undefined);
  const onSignedOut = vi.fn();
  const utils = render(
    <ProfileMenu
      profile={baseProfile}
      signOut={signOut}
      onSignedOut={onSignedOut}
      {...overrides}
    />,
  );
  return { ...utils, signOut, onSignedOut };
}

describe("ProfileMenu", () => {
  it("renders the avatar pressable", () => {
    const { getByA11yLabel } = renderMenu();
    expect(getByA11yLabel(/open profile menu for mia tan/i)).toBeTruthy();
  });

  it("shows initials fallback when imageUrl is null", () => {
    const { getByText } = renderMenu({
      profile: { ...baseProfile, imageUrl: null },
    });
    expect(getByText("M")).toBeTruthy();
  });

  it("opens the panel and shows name, email, sign out", () => {
    const { getByA11yLabel, getByText } = renderMenu();
    fireEvent.press(getByA11yLabel(/open profile menu for mia tan/i));
    expect(getByText("Mia Tan")).toBeTruthy();
    expect(getByText("mia@example.com")).toBeTruthy();
    expect(getByA11yLabel(/sign out/i)).toBeTruthy();
  });

  it("closes on backdrop press", () => {
    const { getByA11yLabel, queryByA11yLabel } = renderMenu();
    fireEvent.press(getByA11yLabel(/open profile menu for mia tan/i));
    fireEvent.press(getByA11yLabel(/close profile menu/i));
    expect(queryByA11yLabel(/sign out/i)).toBeNull();
  });

  it("calls signOut and onSignedOut", async () => {
    const { getByA11yLabel } = renderMenu();
    fireEvent.press(getByA11yLabel(/open profile menu for mia tan/i));
    fireEvent.press(getByA11yLabel(/sign out/i));
    await waitFor(() => {
      /* signOut resolves */
    });
  });
});
```

If `jest-globals` is not the project's import style, mirror the imports used in `apps/mobile/src/components/member-page.test.tsx` (or whichever existing component test is closest).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:mobile -- --run src/components/profile-menu.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Create the component**

Create `apps/mobile/src/components/profile-menu.tsx`:

```tsx
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { designTokens } from "@ordah-please/ui";

export interface ProfileMenuProfile {
  readonly displayName: string;
  readonly email: string;
  readonly imageUrl: string | null;
}

type ProfileMenuProps = Readonly<{
  profile: ProfileMenuProfile;
  signOut: () => Promise<unknown>;
  onSignedOut: () => void;
}>;

function initial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "?";
  }
  return trimmed[0].toUpperCase();
}

/** Avatar pressable with a small dropdown for the signed-in user's profile and Sign out. */
export function ProfileMenu({
  profile,
  signOut,
  onSignedOut,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errored, setErrored] = useState(false);

  async function handleSignOut() {
    setSubmitting(true);
    setErrored(false);
    try {
      await signOut();
      setOpen(false);
      onSignedOut();
    } catch {
      setErrored(true);
    } finally {
      setSubmitting(false);
    }
  }

  const triggerLabel = `Open profile menu for ${profile.displayName}`;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={triggerLabel}
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        style={styles.avatar}
      >
        {profile.imageUrl ? (
          <Image
            accessibilityLabel=""
            source={{ uri: profile.imageUrl }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={styles.avatarInitials}>
            <Text style={styles.avatarInitialsText}>
              {initial(profile.displayName)}
            </Text>
          </View>
        )}
      </Pressable>
      {open ? (
        <>
          <Pressable
            accessibilityLabel="Close profile menu"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <View style={styles.dropdown}>
            <View style={styles.identity}>
              <Text style={styles.name}>{profile.displayName}</Text>
              <Text style={styles.email} numberOfLines={1}>
                {profile.email}
              </Text>
            </View>
            <View style={styles.divider} />
            {errored ? (
              <View style={styles.errorRow}>
                <Text style={styles.errorText}>Sign out failed.</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={handleSignOut}
                  style={styles.signOutButton}
                >
                  <Text style={styles.signOutText}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                disabled={submitting}
                onPress={handleSignOut}
                style={styles.signOutButton}
              >
                <Text style={styles.signOutText}>
                  {submitting ? "Signing out…" : "Sign out"}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: designTokens.radii.pill,
    height: designTokens.touchTarget.minimum,
    overflow: "hidden",
    width: designTokens.touchTarget.minimum,
  },
  avatarImage: {
    height: "100%",
    width: "100%",
  },
  avatarInitials: {
    alignItems: "center",
    backgroundColor: designTokens.colors.primaryStrong,
    borderRadius: designTokens.radii.pill,
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  avatarInitialsText: {
    color: designTokens.colors.onPrimary,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.title,
    fontWeight: "700",
  },
  backdrop: {
    bottom: 0,
    height: 1,
    left: 0,
    opacity: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  container: {
    position: "relative",
  },
  divider: {
    backgroundColor: "rgba(0,0,0,0.08)",
    height: 1,
    marginVertical: 10,
  },
  dropdown: {
    backgroundColor: designTokens.colors.surface,
    borderRadius: 12,
    boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
    minWidth: 220,
    padding: 12,
    position: "absolute",
    right: 0,
    top: 52,
    zIndex: 20,
  },
  email: {
    color: "rgba(0,0,0,0.65)",
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.label,
  },
  errorRow: {
    gap: 4,
  },
  errorText: {
    color: "#b91c1c",
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.label,
  },
  identity: {
    gap: 2,
  },
  name: {
    color: designTokens.colors.textPrimary,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.body,
    fontWeight: "700",
  },
  signOutButton: {
    paddingVertical: 6,
  },
  signOutText: {
    color: "#b91c1c",
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.body,
    fontWeight: "600",
  },
});
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:mobile -- --run src/components/profile-menu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/profile-menu.tsx apps/mobile/src/components/profile-menu.test.tsx
git commit -m "feat(mobile): add ProfileMenu component"
```

---

## Task 11: Wire the mobile `ProfileMenu` into `MemberPage`

**Files:**
- Modify: `apps/mobile/src/features/access/mobile-member-gate.tsx` (expose `retry` through context)
- Modify: `apps/mobile/src/components/member-page.tsx`
- Test: `apps/mobile/src/components/member-page.test.tsx` (if it exists; otherwise add one)
- Test: `apps/mobile/src/features/access/mobile-member-gate.test.tsx`

- [ ] **Step 1: Expose `retry` through the mobile identity context**

The Better Auth expo client's `signOut()` clears the SecureStore cookie, but the `MobileMemberGate` only re-runs its identity fetch when `retry()` is called. Edit `apps/mobile/src/features/access/mobile-member-gate.tsx` so the context value also carries `retry`:

```ts
type MobileAppIdentityContextValue = Readonly<{
  identity: AppIdentitySummary;
  retry: () => void;
}>;

const MobileAppIdentityContext = createContext<MobileAppIdentityContextValue>({
  identity: EMPTY_IDENTITY,
  retry: () => {},
});

/** Returns the authenticated native identity supplied by the member-tab gate. */
export function useMobileAppIdentity(): AppIdentitySummary {
  return useContext(MobileAppIdentityContext).identity;
}

/** Returns the gate's retry callback so screens can force identity re-evaluation after sign out. */
export function useMobileAppIdentityRetry(): () => void {
  return useContext(MobileAppIdentityContext).retry;
}

/** Supplies a known identity and retry callback to native screen tests and authenticated child trees. */
export function MobileAppIdentityProvider({
  children,
  identity,
  retry,
}: Readonly<{ children: ReactNode; identity: AppIdentitySummary; retry: () => void }>) {
  return (
    <MobileAppIdentityContext.Provider value={{ identity, retry }}>
      {children}
    </MobileAppIdentityContext.Provider>
  );
}
```

Update the existing gate render in the same file so the authenticated branch passes `retry={identityState.retry}` into the provider:

```tsx
if (identityState.kind === "authenticated") {
  return (
    <MobileAppIdentityProvider
      identity={identityState.identity}
      retry={identityState.retry}
    >
      {children}
    </MobileAppIdentityProvider>
  );
}
```

Update any existing test in `mobile-member-gate.test.tsx` that mounts `MobileAppIdentityProvider` directly to supply the new `retry` prop (a `vi.fn()` or `jest.fn()` is fine).

- [ ] **Step 2: Inspect the current `MemberPage` test surface**

Run: `grep -rln "MemberPage\|profile-mia" apps/mobile/src apps/mobile/__tests__`

Identify whether a co-located test exists. If a test asserts on the mock Mia image, plan to replace those assertions.

- [ ] **Step 3: Write the failing test (only if a `MemberPage` test exists)**

Open the existing test file. Replace assertions that reference the mock Mia image with assertions that:
- The rendered output contains a pressable with accessibility label `Open profile menu for …`.
- Pressing it reveals a Sign out pressable.

Mirror the existing render helper — most likely it wraps `MemberPage` in a `MobileAppIdentityProvider`. Update the wrapper to also pass `retry: () => {}`.

If no `MemberPage` test exists yet, skip to Step 4.

- [ ] **Step 4: Replace the mock image with `ProfileMenu`**

Edit `apps/mobile/src/components/member-page.tsx`. The new contents:

```tsx
import { designTokens } from "@ordah-please/ui";
import { Bell } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { IconButton, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { getMobileAuthClient } from "../auth/auth-client";
import {
  useMobileAppIdentity,
  useMobileAppIdentityRetry,
} from "../features/access/mobile-member-gate";
import { ProfileMenu } from "./profile-menu";

type MemberPageProps = Readonly<{
  children: ReactNode;
  title?: string;
}>;

/** Provides the shared native member canvas, product header, profile action, and scroll behavior. */
export function MemberPage({ children, title }: MemberPageProps) {
  const identity = useMobileAppIdentity();
  const retry = useMobileAppIdentityRetry();

  return (
    <SafeAreaView
      edges={["top"]}
      style={styles.safeArea}
      testID="member-safe-area"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.screen}
        testID="member-shell"
      >
        <View style={styles.brandHeader}>
          <Text maxFontSizeMultiplier={2} style={styles.brand}>
            ordah please
          </Text>
          <View style={styles.headerActions}>
            <IconButton
              accessibilityLabel="Open notifications"
              icon={() => (
                <Bell color={designTokens.colors.textPrimary} size={23} />
              )}
              size={24}
            />
            <ProfileMenu
              profile={{
                displayName: identity.displayName,
                email: identity.email,
                imageUrl: identity.imageUrl,
              }}
              signOut={() => getMobileAuthClient().signOut()}
              onSignedOut={retry}
            />
          </View>
        </View>
        {title === undefined ? null : (
          <Text
            accessibilityLabel={title}
            accessibilityRole="header"
            maxFontSizeMultiplier={2}
            style={styles.title}
          >
            {title}
          </Text>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.display,
    letterSpacing: -1.1,
  },
  brandHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: designTokens.spacing.md,
  },
  content: {
    flexGrow: 1,
    gap: designTokens.spacing.lg,
    paddingBottom: designTokens.spacing.xxl,
    paddingHorizontal: designTokens.spacing.md,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
  },
  safeArea: {
    backgroundColor: designTokens.colors.canvas,
    flex: 1,
  },
  screen: {
    backgroundColor: designTokens.colors.canvas,
    flex: 1,
  },
  title: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
    lineHeight: 32,
  },
});
```

Note the removal of the `profileMia` import, the `Image` import, the `profile` style entry, and the static `<Image>` element.

- [ ] **Step 5: Run mobile tests**

Run: `npm run test:mobile`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/member-page.tsx apps/mobile/src/features/access/mobile-member-gate.tsx apps/mobile/src/components/member-page.test.tsx apps/mobile/src/features/access/mobile-member-gate.test.tsx
git commit -m "feat(mobile): wire ProfileMenu into MemberPage header"
```

---

## Task 12: Delete the mock Mia asset on mobile

**Files:**
- Delete: `apps/mobile/assets/images/profile-mia.jpg`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "profile-mia" apps/mobile`
Expected: no matches.

- [ ] **Step 2: Delete the file**

```bash
git rm apps/mobile/assets/images/profile-mia.jpg
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(mobile): remove mock profile image asset"
```

---

## Task 13: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: PASS for all web and contract tests.

- [ ] **Step 2: Run all mobile tests**

Run: `npm run test:mobile`
Expected: PASS.

- [ ] **Step 3: Typecheck the whole repo**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Production build**

Run: `npm run build:web`
Expected: PASS.

- [ ] **Step 6: Manual verification — web member**

Start the dev server: `npm run dev:web`
Open the app in a browser, sign in with Google, and verify:
- Member header shows the user's real Google profile picture (or initial if no picture).
- Clicking the avatar opens a dropdown showing the user's name and email.
- Clicking Sign out returns the user to the existing sign-in prompt.
- Pressing Escape closes the dropdown without signing out.
- Clicking outside the dropdown closes it.

- [ ] **Step 7: Manual verification — web admin**

In the same browser session, navigate to `/admin` (or whatever route the admin shell uses). Verify:
- Admin header now shows the avatar on the right side of the header.
- Clicking the avatar opens the same dropdown.
- Sign out works the same way and returns to the admin sign-in prompt.

- [ ] **Step 8: Manual verification — mobile member**

Start the mobile dev server: `npm run dev:mobile`
Open the app in an Android emulator (or a development build), sign in with Google, and verify:
- Member header shows the real profile picture.
- Tapping the avatar opens the dropdown.
- Tapping Sign out returns the user to the existing Sign in with Google screen.
- Tapping outside the dropdown closes it.

- [ ] **Step 9: Update progress tracker**

Edit `context/progress-tracker.md` and add a brief entry under Completed noting that profile menu and sign-out are now wired across the three surfaces. Per the AGENTS.md workflow, this is a non-V1-numbered UI hookup task; record it under a "UI fixes" section or similar.

- [ ] **Step 10: Final commit and squash-merge**

Per `AGENTS.md` workflow:

```bash
git add context/progress-tracker.md
git commit -m "docs(tracker): record profile menu and sign out completion"
```

Then squash-merge the branch into `main` with a title that summarizes the work (no V1-XX prefix is required for this task; confirm with the user before merging).

---

## Notes for the implementer

- The contract extension in Task 4 uses `rejectUnknownFields`, so any test or stub that previously built an `AppIdentitySummary` literal without the three new fields will now fail. Fix these in Step 6 of Task 4.
- The `BetterAuthSessionState.user` type widening in Task 2 is purely additive at the TypeScript level — Better Auth's runtime already returns `image`.
- The mobile `MemberPage` change in Task 11 requires touching `mobile-member-gate.tsx` to expose `retry` through context. Without this, sign out clears the cookie but the gate does not re-render into the unauthenticated state.
- If `@testing-library/react` is not already a dev dependency of `@ordah-please/web`, install it in Task 5 Step 1.
- The CSS in Task 5 Step 4 uses `var(--accent, #f3a73d)` for the initials fallback color. If the design tokens already define a different accent variable, prefer it.
