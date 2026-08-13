# Users & Permissions Real Users List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fully mocked Users & Permissions admin page with real Neon data so the Platform Admin sees every signed-in user (themselves included), their group memberships/roles, and their Platform Admin status — with working client-side search and Next.js streaming so the shell paints immediately.

**Architecture:** One new repository method (`listUsersWithSummary`) joins `users` to `auth_users` and bundles each user's active memberships. A new `usersRuntime` helper resolves group names and maps roles. The page is a synchronous server component that wraps an async child (`UsersAdminData`) in a `<Suspense>` boundary with a skeleton fallback; the async child fetches and renders a client component (`UsersAdminView`) that owns search and row-selection state.

**Tech Stack:** Next.js App Router (server + client components, Suspense streaming), Drizzle ORM, Neon PostgreSQL, React + TypeScript, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-13-users-and-permissions-real-users-design.md`

---

## File Map

**Create:**
- `apps/web/src/features/users/users-runtime.ts` — runtime helper exposing `listUsersForAdmin()` that returns each user with group-name-resolved memberships.
- `apps/web/app/admin/users/users-admin-data.tsx` — async server component inside Suspense; calls runtime and renders the client view.
- `apps/web/app/admin/users/users-admin-view.tsx` — client component with search + selection state, list, and detail panel.
- `apps/web/app/admin/users/users-admin-view.test.tsx` — component tests.

**Modify:**
- `packages/db/src/repositories/identity-access.ts` — add `listUsersWithSummary()` method to interface and implementation; add `authUsers` to schema import.
- `packages/db/src/repositories/repositories.provider.integration.test.ts` — add a test case for the new method.
- `apps/web/app/admin/users/page.tsx` — rewrite from static-mock server component into sync server component with Suspense + disabled action button.

**No DB migration** is required. Existing schema exports (`users`, `memberships`, `authUsers`) cover the read.

---

## Task 1: Add `listUsersWithSummary()` to the identity-access repository

**Files:**
- Modify: `packages/db/src/repositories/identity-access.ts`
- Test: `packages/db/src/repositories/repositories.provider.integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

Open `packages/db/src/repositories/repositories.provider.integration.test.ts`. Find the `describe("focused repositories", ...)` block (starts around line 113). Add this new test case as the last `it(...)` inside that block, before the closing `});` of the `describe`:

```ts
  it("lists users with profile, admin flag, and active memberships", async () => {
    const repositories = createRepositories(database);

    const ownerAuthId = randomUUID();
    const memberAuthId = randomUUID();
    const noAuthProductId = randomUUID();

    await database.insert(authUsers).values({
      email: `summary-owner-${ownerAuthId}@example.test`,
      emailVerified: true,
      id: ownerAuthId,
      name: "Summary Owner",
    });
    await database.insert(authUsers).values({
      email: `summary-member-${memberAuthId}@example.test`,
      emailVerified: true,
      id: memberAuthId,
      name: "Summary Member",
      image: "https://example.test/member.png",
    });

    const owner = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId: ownerAuthId,
      displayName: "Summary Owner",
      email: "summary-owner@example.test",
      imageUrl: null,
    });
    const member = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId: memberAuthId,
      displayName: "Summary Member",
      email: "summary-member@example.test",
      imageUrl: "https://example.test/member.png",
    });
    // User with no linked auth_users row (authUserId null) — insert directly.
    await database.insert(users).values({
      displayName: "No Auth User",
      id: noAuthProductId,
    });
    // Archived user — should be excluded from the summary.
    const archivedAuthId = randomUUID();
    await database.insert(authUsers).values({
      email: `summary-archived-${archivedAuthId}@example.test`,
      emailVerified: true,
      id: archivedAuthId,
      name: "Archived User",
    });
    const archived =
      await repositories.identityAccess.ensureUserForAuthIdentity({
        authUserId: archivedAuthId,
        displayName: "Archived User",
        email: "summary-archived@example.test",
        imageUrl: null,
      });
    await database
      .update(users)
      .set({ archivedAt: new Date("2026-08-13T00:00:00.000Z") })
      .where(eq(users.id, archived.id));

    const [groupA] = await database
      .insert(groups)
      .values({ createdByUserId: owner.id, name: "Summary Group A" })
      .returning();
    const [groupB] = await database
      .insert(groups)
      .values({ createdByUserId: owner.id, name: "Summary Group B" })
      .returning();
    if (groupA === undefined || groupB === undefined) {
      throw new Error("Expected summary test groups to be created.");
    }
    await repositories.identityAccess.addMembership({
      groupId: groupA.id,
      role: "owner",
      userId: owner.id,
    });
    await repositories.identityAccess.addMembership({
      groupId: groupB.id,
      role: "manager",
      userId: owner.id,
    });
    await repositories.identityAccess.addMembership({
      groupId: groupA.id,
      role: "member",
      userId: member.id,
    });
    // A removed membership — should NOT appear in the summary.
    await repositories.identityAccess.addMembership({
      groupId: groupB.id,
      role: "member",
      userId: member.id,
    });
    await repositories.groupAccess.removeMembership(
      groupB.id,
      member.id,
      new Date("2026-08-13T01:00:00.000Z"),
    );

    await repositories.identityAccess.setPlatformAdminFlag(owner.id, true);

    const summaries =
      await repositories.identityAccess.listUsersWithSummary();

    // Archived user is excluded.
    expect(summaries.find((u) => u.id === archived.id)).toBeUndefined();

    const fetchedOwner = summaries.find((u) => u.id === owner.id);
    expect(fetchedOwner).toBeDefined();
    expect(fetchedOwner).toMatchObject({
      displayName: "Summary Owner",
      email: "summary-owner@example.test",
      imageUrl: null,
      isPlatformAdmin: true,
    });
    expect(fetchedOwner?.memberships).toHaveLength(2);
    expect(fetchedOwner?.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupId: groupA.id, role: "owner" }),
        expect.objectContaining({ groupId: groupB.id, role: "manager" }),
      ]),
    );

    const fetchedMember = summaries.find((u) => u.id === member.id);
    expect(fetchedMember).toMatchObject({
      displayName: "Summary Member",
      email: "summary-member@example.test",
      imageUrl: "https://example.test/member.png",
      isPlatformAdmin: false,
    });
    expect(fetchedMember?.memberships).toEqual([
      { groupId: groupA.id, role: "member" },
    ]);

    // User without an auth row still appears with nullish profile fields and no memberships.
    const fetchedNoAuth = summaries.find((u) => u.id === noAuthProductId);
    expect(fetchedNoAuth).toMatchObject({
      displayName: "No Auth User",
      email: null,
      imageUrl: null,
      isPlatformAdmin: false,
      memberships: [],
    });

    // Ordered alphabetically by displayName.
    const names = summaries.map((u) => u.displayName);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });
```

The `users`, `authUsers`, `groups`, and `eq` imports are already at the top of the file (verified by lines 12–21 and line 6 of the existing test file). No new imports needed.

- [ ] **Step 2: Run the test to verify it fails**

Run from the repo root:

```bash
npm test -- --run packages/db/src/repositories/repositories.provider.integration.test.ts
```

Expected: FAIL with a TypeScript error like `Property 'listUsersWithSummary' does not exist on type 'IdentityAccessRepository'`, or a runtime "is not a function" error.

- [ ] **Step 3: Add `authUsers` to the schema import in `identity-access.ts`**

Open `packages/db/src/repositories/identity-access.ts`. Locate line 3:

```ts
import { memberships, users } from "../schema/index.js";
```

Replace with:

```ts
import { authUsers, memberships, users } from "../schema/index.js";
```

- [ ] **Step 4: Add the `UserSummaryRow` interface and repository interface entry**

Still in `packages/db/src/repositories/identity-access.ts`, find the `export interface IdentityAccessRepository { ... }` block (around lines 15–35). Just above that interface, add:

```ts
export interface UserMembershipSummaryRow {
  readonly groupId: string;
  readonly role: "owner" | "manager" | "member";
}

export interface UserSummaryRow {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly imageUrl: string | null;
  readonly isPlatformAdmin: boolean;
  readonly archivedAt: Date | null;
  readonly memberships: readonly UserMembershipSummaryRow[];
}
```

Then add the following line as the last member of the `IdentityAccessRepository` interface (just before the closing brace, after `setPlatformAdminFlag`):

```ts
  listUsersWithSummary(): Promise<readonly UserSummaryRow[]>;
```

- [ ] **Step 5: Implement `listUsersWithSummary` in the repository factory**

In the same file, find the `createIdentityAccessRepository` function (around line 40). The returned object's last member is `setPlatformAdminFlag`. Add this new method as the last member of the returned object, after `setPlatformAdminFlag`:

```ts
    listUsersWithSummary: async () => {
      const userRows = await database
        .select({
          archivedAt: users.archivedAt,
          displayName: users.displayName,
          email: authUsers.email,
          id: users.id,
          imageUrl: authUsers.image,
          isPlatformAdmin: users.isPlatformAdmin,
        })
        .from(users)
        .leftJoin(authUsers, eq(users.authUserId, authUsers.id))
        .where(isNull(users.archivedAt))
        .orderBy(asc(users.displayName));

      const membershipRows = await database
        .select({
          groupId: memberships.groupId,
          role: memberships.role,
          userId: memberships.userId,
        })
        .from(memberships)
        .where(isNull(memberships.removedAt));

      const membershipsByUser = new Map<
        string,
        { groupId: string; role: "owner" | "manager" | "member" }[]
      >();
      for (const membership of membershipRows) {
        const list = membershipsByUser.get(membership.userId);
        if (list === undefined) {
          membershipsByUser.set(membership.userId, [
            {
              groupId: membership.groupId,
              role: membership.role,
            },
          ]);
        } else {
          list.push({ groupId: membership.groupId, role: membership.role });
        }
      }

      return userRows.map((row) => ({
        archivedAt: row.archivedAt,
        displayName: row.displayName,
        email: row.email,
        id: row.id,
        imageUrl: row.imageUrl,
        isPlatformAdmin: row.isPlatformAdmin,
        memberships: membershipsByUser.get(row.id) ?? [],
      }));
    },
```

The `asc`, `and`, `eq`, `isNull` imports are already present at the top of the file (line 1: `import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";`).

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test -- --run packages/db/src/repositories/repositories.provider.integration.test.ts
```

Expected: PASS. All test cases including the new one succeed.

If the test fails because the `DATABASE_MIGRATION_URL` environment variable is not set, the existing `npm test` script wires Neon via the project's `.env` — check `package.json` and the existing integration tests already run with this configuration.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/repositories/identity-access.ts packages/db/src/repositories/repositories.provider.integration.test.ts
git commit -m "feat(db): list users with profile and memberships for admin"
```

---

## Task 2: Create the `usersRuntime` helper

**Files:**
- Create: `apps/web/src/features/users/users-runtime.ts`

- [ ] **Step 1: Create the runtime file**

Create `apps/web/src/features/users/users-runtime.ts` with this exact content:

```ts
import {
  createDatabaseClient,
  createRepositories,
  type Database,
} from "@ordah-please/db";

let runtimeDatabase: Database | undefined;

/** Reuses one lazy pooled database across warm authenticated admin requests. */
function getRuntimeDatabase(): Database {
  runtimeDatabase ??= createDatabaseClient().database;
  return runtimeDatabase;
}

const MEMBERSHIP_ROLE_MAP = {
  manager: "manager",
  member: "member",
  owner: "group-owner",
} as const satisfies Readonly<
  Record<"owner" | "manager" | "member", AdminUserMembershipRole>
>;

export type AdminUserMembershipRole = "group-owner" | "manager" | "member";

export interface AdminUserMembership {
  readonly groupId: string;
  readonly groupName: string;
  readonly role: AdminUserMembershipRole;
}

export interface AdminUserSummary {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly imageUrl: string | null;
  readonly isPlatformAdmin: boolean;
  readonly memberships: readonly AdminUserMembership[];
}

export const usersRuntime = {
  /** Lists every active product user with profile fields and group-name-resolved memberships, for the admin portal. */
  listUsersForAdmin: async (): Promise<readonly AdminUserSummary[]> => {
    const repositories = createRepositories(getRuntimeDatabase());
    const summaries = await repositories.identityAccess.listUsersWithSummary();
    return Promise.all(
      summaries.map(async (user) => {
        const memberships = await Promise.all(
          user.memberships.map(async (membership) => {
            const groupSummary =
              await repositories.groupAccess.findGroupSummary(membership.groupId);
            return {
              groupId: membership.groupId,
              groupName: groupSummary?.name ?? "Group",
              role: MEMBERSHIP_ROLE_MAP[membership.role],
            };
          }),
        );
        return {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          imageUrl: user.imageUrl,
          isPlatformAdmin: user.isPlatformAdmin,
          memberships,
        };
      }),
    );
  },
} as const;
```

- [ ] **Step 2: Typecheck the new file**

```bash
npm run typecheck
```

Expected: PASS with no new errors. (The file is standalone and not yet imported anywhere, so an unused warning won't appear because `usersRuntime` is exported.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/users/users-runtime.ts
git commit -m "feat(web): add usersRuntime admin helper"
```

---

## Task 3: Create the `UsersAdminView` client component (TDD)

**Files:**
- Create: `apps/web/app/admin/users/users-admin-view.tsx`
- Create: `apps/web/app/admin/users/users-admin-view.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `apps/web/app/admin/users/users-admin-view.test.tsx` with this content:

```tsx
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UsersAdminView } from "./users-admin-view";
import type { AdminUserSummary } from "../../../src/features/users/users-runtime";

afterEach(cleanup);

const users: readonly AdminUserSummary[] = [
  {
    displayName: "Alice Admin",
    email: "alice@example.test",
    id: "user-alice",
    imageUrl: null,
    isPlatformAdmin: true,
    memberships: [
      {
        groupId: "group-friends",
        groupName: "Friends",
        role: "group-owner",
      },
    ],
  },
  {
    displayName: "Mia Member",
    email: "mia@example.test",
    id: "user-mia",
    imageUrl: "https://example.test/mia.png",
    isPlatformAdmin: false,
    memberships: [],
  },
  {
    displayName: "Jordan Diaz",
    email: "jordan@example.test",
    id: "user-jordan",
    imageUrl: null,
    isPlatformAdmin: false,
    memberships: [
      {
        groupId: "group-friends",
        groupName: "Friends",
        role: "member",
      },
      {
        groupId: "group-design",
        groupName: "Design team",
        role: "manager",
      },
    ],
  },
];

describe("UsersAdminView", () => {
  it("renders all users when search is empty and selects the first by default", () => {
    render(<UsersAdminView users={users} />);

    expect(screen.getByText("Alice Admin")).toBeTruthy();
    expect(screen.getByText("Mia Member")).toBeTruthy();
    expect(screen.getByText("Jordan Diaz")).toBeTruthy();

    // First row (Alice) is selected; PA pill renders somewhere on the page.
    expect(screen.getAllByText("Platform Admin").length).toBeGreaterThan(0);
    const detail = screen.getByText("Group roles").parentElement!;
    expect(within(detail).getByText("Friends")).toBeTruthy();
    expect(within(detail).getByText("Group Owner")).toBeTruthy();
  });

  it("filters by name case-insensitively", () => {
    render(<UsersAdminView users={users} />);

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "JOR" },
    });

    expect(screen.getByText("Jordan Diaz")).toBeTruthy();
    expect(screen.queryByText("Alice Admin")).toBeNull();
    expect(screen.queryByText("Mia Member")).toBeNull();
  });

  it("filters by email case-insensitively", () => {
    render(<UsersAdminView users={users} />);

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "MIA@" },
    });

    expect(screen.getByText("Mia Member")).toBeTruthy();
    expect(screen.queryByText("Alice Admin")).toBeNull();
  });

  it("shows the empty-result message when search matches nobody and falls back to a 'Select a user' detail state", () => {
    render(<UsersAdminView users={users} />);

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "nobody" },
    });

    expect(screen.getByText(/No users match/)).toBeTruthy();
    expect(screen.getByText("Select a user.")).toBeTruthy();
  });

  it("auto-selects the first visible row when the current selection is filtered out", () => {
    render(<UsersAdminView users={users} />);

    // Alice is selected by default. Filter to Jordan.
    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "jordan" },
    });

    // Detail panel should now show Jordan, not Alice.
    const detail = screen.getByText("Group roles").parentElement!;
    expect(within(detail).getByText("Friends")).toBeTruthy();
    expect(within(detail).getByText("Design team")).toBeTruthy();
    expect(within(detail).getByText("Manager")).toBeTruthy();
  });

  it("renders initials fallback when imageUrl is null and an <img> when it is present", () => {
    const { container } = render(<UsersAdminView users={users} />);

    // Alice (no image) → initials "A" appears in the list row AND the detail header.
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
    // Mia (has image) → at least one img tag in the document.
    expect(
      container.querySelector('img[src="https://example.test/mia.png"]'),
    ).toBeTruthy();
  });

  it("shows 'Not in any groups yet.' for a user with zero memberships", () => {
    render(<UsersAdminView users={users} />);

    // Select Mia (second row).
    fireEvent.click(screen.getByText("Mia Member"));

    expect(screen.getByText("Not in any groups yet.")).toBeTruthy();
  });

  it("renders the Suspend account button disabled with the Coming soon tooltip", () => {
    render(<UsersAdminView users={users} />);

    const suspendButton = screen.getByRole("button", {
      name: "Suspend account",
    });

    expect(suspendButton.hasAttribute("disabled")).toBe(true);
    expect(suspendButton.getAttribute("title")).toBe("Coming soon");
  });

  it("renders the empty state when there are zero users", () => {
    render(<UsersAdminView users={[]} />);

    expect(screen.getByText("No users yet.")).toBeTruthy();
    expect(screen.getByText("Select a user.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --run apps/web/app/admin/users/users-admin-view.test.tsx
```

Expected: FAIL with a module-not-found error for `./users-admin-view`.

- [ ] **Step 3: Implement the client component**

Create `apps/web/app/admin/users/users-admin-view.tsx` with this content:

```tsx
"use client";

import { useMemo, useState } from "react";

import type { AdminUserSummary } from "../../../src/features/users/users-runtime";

const ROLE_LABELS: Readonly<Record<AdminUserSummary["memberships"][number]["role"], string>> = {
  "group-owner": "Group Owner",
  manager: "Manager",
  member: "Member",
};

interface UsersAdminViewProps {
  readonly users: readonly AdminUserSummary[];
}

/** Renders the admin user list and detail panel with client-side search and row selection. */
export function UsersAdminView({ users }: UsersAdminViewProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    users[0]?.id ?? null,
  );

  const visibleUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0) return users;
    return users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(normalized) ||
        (user.email?.toLowerCase().includes(normalized) ?? false),
    );
  }, [query, users]);

  const effectiveSelectedId =
    selectedId !== null && visibleUsers.some((user) => user.id === selectedId)
      ? selectedId
      : (visibleUsers[0]?.id ?? null);
  const selected = users.find((user) => user.id === effectiveSelectedId) ?? null;

  return (
    <>
      <section className="admin-panel admin-list-panel">
        <label className="admin-search">
          <input
            aria-label="Search users"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            type="search"
            value={query}
          />
        </label>
        {visibleUsers.length === 0 ? (
          <p className="admin-empty">
            {users.length === 0
              ? "No users yet."
              : `No users match "${query.trim()}".`}
          </p>
        ) : (
          <div className="admin-user-list">
            {visibleUsers.map((user) => (
              <button
                className={
                  user.id === effectiveSelectedId
                    ? "admin-user-row admin-user-row--active"
                    : "admin-user-row"
                }
                key={user.id}
                onClick={() => setSelectedId(user.id)}
                type="button"
              >
                <Avatar
                  displayName={user.displayName}
                  imageUrl={user.imageUrl}
                />
                <div>
                  <strong>{user.displayName}</strong>
                  <p>
                    {user.email ?? "—"} · {user.memberships.length}{" "}
                    {user.memberships.length === 1 ? "group" : "groups"}
                  </p>
                </div>
                {user.isPlatformAdmin ? (
                  <span className="status-pill">Platform Admin</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </section>
      {selected === null ? (
        <section className="admin-panel permission-panel">
          <p className="admin-empty">Select a user.</p>
        </section>
      ) : (
        <section className="admin-panel permission-panel">
          <div className="permission-panel__identity">
            <Avatar
              displayName={selected.displayName}
              imageUrl={selected.imageUrl}
            />
            <div>
              <h2>{selected.displayName}</h2>
              <p>{selected.email ?? "—"} · App active</p>
            </div>
            {selected.isPlatformAdmin ? (
              <span className="status-pill">Platform Admin</span>
            ) : null}
            <button
              className="secondary-action"
              disabled
              title="Coming soon"
              type="button"
            >
              Suspend account
            </button>
          </div>
          <div className="permission-groups">
            <h3>Group roles</h3>
            {selected.memberships.length === 0 ? (
              <p className="admin-empty">Not in any groups yet.</p>
            ) : (
              selected.memberships.map((membership) => (
                <div key={membership.groupId}>
                  <span>{membership.groupName}</span>
                  <strong>{ROLE_LABELS[membership.role]}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </>
  );
}

interface AvatarProps {
  readonly displayName: string;
  readonly imageUrl: string | null;
}

function Avatar({ displayName, imageUrl }: AvatarProps) {
  if (imageUrl !== null && imageUrl.length > 0) {
    return <img alt="" className="member-avatar" src={imageUrl} />;
  }
  const initial =
    displayName.length === 0
      ? "?"
      : displayName.charAt(0).toUpperCase();
  return <span className="member-avatar">{initial}</span>;
}
```

The "Add user to group" button is intentionally NOT rendered here — it lives in the page header (Task 5), so its disabled/Coming-soon state is verified via manual verification rather than this component's test suite.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- --run apps/web/app/admin/users/users-admin-view.test.tsx
```

Expected: PASS — all nine test cases succeed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/users/users-admin-view.tsx apps/web/app/admin/users/users-admin-view.test.tsx
git commit -m "feat(web): add UsersAdminView client component"
```

---

## Task 4: Create the `UsersAdminData` async server component

**Files:**
- Create: `apps/web/app/admin/users/users-admin-data.tsx`

- [ ] **Step 1: Create the file**

Create `apps/web/app/admin/users/users-admin-data.tsx` with this content:

```tsx
import { usersRuntime } from "../../../src/features/users/users-runtime";

import { UsersAdminView } from "./users-admin-view";

/** Fetches the admin user list and renders the interactive view inside the page's Suspense boundary. */
export async function UsersAdminData() {
  const users = await usersRuntime.listUsersForAdmin();
  return <UsersAdminView users={users} />;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/admin/users/users-admin-data.tsx
git commit -m "feat(web): wire UsersAdminData async server component"
```

---

## Task 5: Rewrite `page.tsx` with Suspense + skeleton + disabled action

**Files:**
- Modify: `apps/web/app/admin/users/page.tsx`

- [ ] **Step 1: Replace the entire contents of `page.tsx`**

Open `apps/web/app/admin/users/page.tsx`. The current file imports `Search`, `ShieldCheck`, and `SlidersHorizontal` from `lucide-react` and renders a fully static mock UI. Replace the entire file contents with:

```tsx
import { Suspense } from "react";

import { AdminPage } from "../../components/admin-page";

import { UsersAdminData } from "./users-admin-data";

/** Shows real users, their group roles, and Platform Admin status. Effective-permission overrides arrive in a future bundle. */
export default function UsersPermissionsPage() {
  return (
    <AdminPage
      actions={
        <button
          className="admin-primary-button"
          disabled
          title="Coming soon"
          type="button"
        >
          Add user to group
        </button>
      }
      description="Role permissions apply by default. Account-wide overrides arrive in a future bundle."
      eyebrow="Access control"
      title="Users & permissions"
    >
      <div className="admin-split">
        <Suspense fallback={<UsersAdminSkeleton />}>
          <UsersAdminData />
        </Suspense>
      </div>
    </AdminPage>
  );
}

function UsersAdminSkeleton() {
  return (
    <>
      <section className="admin-panel admin-list-panel">
        <p className="admin-empty">Loading users…</p>
        <div className="admin-user-list" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div className="admin-user-row" key={index}>
              <span className="member-avatar" />
              <div>
                <strong>·</strong>
                <p>·</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="admin-panel permission-panel">
        <p className="admin-empty">Loading details…</p>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: PASS with no new errors. The previously imported `lucide-react` icons (`Search`, `ShieldCheck`, `SlidersHorizontal`) are no longer referenced and must not appear at the top of the file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/admin/users/page.tsx
git commit -m "feat(web): wire Users & Permissions page to real data with Suspense"
```

---

## Task 6: Focused checks and manual verification

**Files:** none modified.

- [ ] **Step 1: Run the full focused check set**

From the repo root:

```bash
npm run test
npm run lint
npm run typecheck
npm run build --workspace apps/web
```

Expected: all four commands pass. If `npm run test` skips integration tests because `DATABASE_MIGRATION_URL` is not set in this shell, also run them via the project's existing CI command (check `package.json` `scripts.test`).

- [ ] **Step 2: Manual verification in the browser**

Start the web dev server:

```bash
npm run dev --workspace apps/web
```

Open the printed local URL and:

1. Sign in with the Platform Admin Google account.
2. Open the admin workspace (the URL ends in `/admin`).
3. Click **Users & permissions** in the sidebar.
4. Confirm the sidebar, header, page title, and the disabled "Add user to group" button appear immediately, with a brief skeleton in the list area.
5. Confirm the list then populates with every signed-in user (yourself included), sorted alphabetically by display name.
6. Confirm your own row shows the **Platform Admin** pill.
7. Click your own row. Confirm the detail panel shows your real group memberships with the correct roles (Group Owner / Manager / Member).
8. Type a partial name and a partial email into the search box. Confirm the list filters live and the detail panel auto-selects the first visible row when your current selection no longer matches.
9. Confirm the "Effective permissions" panel is gone.
10. Confirm both "Add user to group" and "Suspend account" are visibly disabled and show "Coming soon" on hover.

- [ ] **Step 3: Write the completion history note**

Create `context/history/users-and-permissions-real-users.md` with this content (fill in any concrete numbers you observed):

```md
# Users & Permissions Real Users List

**Branch:** `task/users-and-permissions-real-users`
**Squash title:** `Users & permissions real users list`
**Date:** 2026-08-13

## What landed

- `listUsersWithSummary()` repository method joins `users` to `auth_users` and
  bundles each user's active memberships.
- `usersRuntime.listUsersForAdmin()` resolves group names and maps roles.
- The Users & Permissions admin page now renders real users, real group roles,
  and the Platform Admin pill. The admin (self) appears in the list.
- Working client-side search by name or email.
- The Effective permissions panel and Save override button are removed; the
  "Add user to group" and "Suspend account" buttons remain visible but disabled
  with a Coming soon tooltip.
- The page uses Next.js Suspense streaming so the admin shell paints first and
  the list streams in once Neon responds.

## Verification

- `npm run test` — all unit and integration tests pass, including the new
  identity-access integration test and the new UsersAdminView component tests.
- `npm run lint` — clean.
- `npm run typecheck` — clean.
- `npm run build --workspace apps/web` — succeeds.
- Manual: signed in as Platform Admin, confirmed the list shows me with the
  Platform Admin pill and my real group roles, search filters correctly, and
  the Effective permissions panel is gone.

## Deferred

- Effective permissions / override grid / Save — Effective permissions
  foundation bundle.
- Working "Add user to group" — Group membership journey bundle.
- Working "Suspend account" — Platform Admin operations bundle.
```

- [ ] **Step 4: Update the progress tracker**

Open `context/progress-tracker.md`. Find the "Completed" section under "Current Phase" (around line 11) and add a new bullet at the end of that list:

```md
- Users & permissions real users list — Platform Admin now sees real users (themselves included), real group roles, and Platform Admin status on the admin Users & permissions page, replacing the prior mock UI. Working client-side search by name/email. Effective permissions panel and Save are deferred to their own foundation bundle; Add-user-to-group and Suspend-account buttons stay visible but disabled.
```

- [ ] **Step 5: Commit history and tracker**

```bash
git add context/history/users-and-permissions-real-users.md context/progress-tracker.md
git commit -m "docs: record users-and-permissions real users completion"
```

---

## Self-Review Notes

- The spec required: real users list, admin in the list, real group roles,
  Platform Admin pill, working search, hidden Effective permissions panel,
  disabled Coming-soon action buttons, Next.js streaming with skeleton, three
  layers of tests, no DB migration. Each is covered above.
- The spec's "Page smoke test" line item is intentionally not implemented as a
  separate automated test — the project has no existing page-test pattern (no
  `page.test.tsx` exists in `apps/web/app/admin/`). Page behavior is covered
  by the component test (which asserts the contract the page relies on) plus
  the manual verification steps.
- All file paths, function names, type names, and CSS classes referenced in
  later tasks match what earlier tasks define.
- No placeholders.
```
