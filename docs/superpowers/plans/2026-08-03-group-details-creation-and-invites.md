# Group Details, Creation, and Persistent Invites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the multi-group foundation visible and usable on the apps by adding a Group details read path, a Platform-Admin group-creation flow, two working Owner actions (rename and rotate invite link), and a persistent per-group invite link that replaces the single-use token model for new acceptances.

**Architecture:** Add a new `group_invite_links` table alongside the existing single-use `invitations` table (preserved read-only). New APIs follow the existing seven-step handler discipline and use small group-authorization helpers that the upcoming Effective permissions bundle can later replace. Web admin gets a Create group form; member apps (web PWA + Android) get a Group details screen with role-gated sections.

**Tech Stack:** Next.js Route Handlers (web API + pages), Expo Router (Android), Drizzle ORM + Neon Postgres (DB), existing shared `packages/domain`, `packages/contracts`, `packages/db`. Tests via Vitest (server), Jest + React Native Testing Library (mobile), Playwright (browser).

**Spec:** `context/specs/05-group-details-creation-and-invites-design.md`. Read it first.

**Branch:** Create `task/V1-07-group-details-creation-and-invites` from latest `main`. All work goes on this branch. One squash commit to `main` when complete.

---

## File Map

### Create

- `packages/db/src/schema/group-invite-links.ts` — new table.
- `packages/db/drizzle/XXXX_add_group_invite_links.sql` — generated migration (use the next ordered prefix).
- `packages/db/src/repositories/group-invite-links.ts` — persistence only.
- `packages/db/src/repositories/group-details.ts` — read group + active owner + members.
- `packages/domain/src/groups/group-details.ts` — read model types + name validation policy.
- `packages/domain/src/groups/invite-link.ts` — public-value mint + hash + prefix helpers.
- `packages/contracts/src/groups/details.ts` — `GET /api/groups/:groupId/details` response parser.
- `packages/contracts/src/groups/rename.ts` — `POST /api/groups/:groupId/rename` request parser.
- `packages/contracts/src/groups/create.ts` — `POST /api/admin/groups` request parser.
- `packages/contracts/src/groups/invite-link.ts` — rotate response + accept request parsers.
- `apps/web/src/application/groups/load-group-details.ts` — read use case.
- `apps/web/src/application/groups/rename-group.ts` — rename use case.
- `apps/web/src/application/groups/rotate-invite-link.ts` — rotate use case.
- `apps/web/src/application/groups/create-group.ts` — admin create use case.
- `apps/web/app/api/groups/[groupId]/details/route.ts`
- `apps/web/app/api/groups/[groupId]/rename/route.ts`
- `apps/web/app/api/groups/[groupId]/invite-link/rotate/route.ts`
- `apps/web/app/api/admin/groups/route.ts`
- `apps/web/app/api/admin/groups/create/route.ts` (or extend `route.ts`)
- `apps/web/app/(member)/groups/[groupId]/page.tsx` — Group details web page.
- `apps/web/app/components/group-details-view.tsx` — shared details component (server-rendered shell + small client island for rename/copy/rotate).
- `apps/web/app/components/create-group-dialog.tsx` — admin create-group client component.
- `apps/mobile/app/(member)/groups/[groupId].tsx` — Group details Android screen.
- `apps/mobile/src/features/groups/group-details-screen.tsx` — RN component.

### Modify

- `packages/db/src/schema/identity.ts` — export `groupInviteLinks` from module index (table itself lives in the new file).
- `packages/db/src/schema/index.ts` — re-export.
- `packages/db/src/repositories/index.ts` — re-export new repositories.
- `packages/web/src/application/group-authorization.ts` — add `requireGroupMembership` helper (uses existing `findGroupMembership`).
- `apps/web/app/api/access/accept/route.ts` (existing single-use acceptance route) — branch: if the supplied value matches a `group_invite_links` row, run the new acceptance path; otherwise return the existing safe `CONFLICT`.
- `apps/web/app/(member)/groups/page.tsx` — render real names + owner from server-loaded identity; link each row to the new details route.
- `apps/web/app/components/groups-overview.tsx` — show name + role badge; make rows clickable links to `/groups/{groupId}`.
- `apps/web/app/admin/groups/page.tsx` — replace mock rows with real data; wire Create-group button to the dialog.
- `apps/mobile/app/(member)/groups.tsx` — render real names + roles; tap navigates to `[groupId]`.
- `apps/mobile/src/features/access/...` identity-loading — already provides memberships; reuse.
- `context/progress-tracker.md`, `context/architecture.md`, `context/project-structure.md`.

### Test files

- `packages/db/src/schema/group-invite-links.provider.integration.test.ts`
- `packages/db/src/repositories/group-details.test.ts`
- `packages/db/src/repositories/group-invite-links.test.ts`
- `packages/domain/src/groups/group-details.test.ts`
- `packages/domain/src/groups/invite-link.test.ts`
- `packages/contracts/src/groups/details.test.ts`
- `packages/contracts/src/groups/rename.test.ts`
- `packages/contracts/src/groups/create.test.ts`
- `packages/contracts/src/groups/invite-link.test.ts`
- `apps/web/src/application/groups/load-group-details.test.ts`
- `apps/web/src/application/groups/rename-group.test.ts`
- `apps/web/src/application/groups/rotate-invite-link.test.ts`
- `apps/web/src/application/groups/create-group.test.ts`
- `apps/web/src/application/group-authorization.test.ts` — extend with `requireGroupMembership` cases.
- `apps/mobile/__tests__/group-details-screen.test.tsx`
- `tests/e2e/member/groups-details.spec.ts` — Playwright member flow.
- `tests/e2e/admin/admin-create-group.spec.ts` — Playwright admin flow.

---

## Conventions

- Follow `context/code-standards.md` strictly (strict TS, integer centavos, UTC timestamps, one-sentence descriptions on exports, no `any`, discriminated unions).
- Follow the seven-step API discipline in `context/code-standards.md`.
- One-sentence description above every exported function.
- All application-authored copy and fixtures in English.
- Provider-backed Vitest files use the `*.provider.integration.test.ts` suffix and run only through explicit provider scripts. Run them sequentially.
- Default `npm test` and CI must remain provider-credential-free.
- Commit after every green test cycle. Use the project's branch hierarchy (`task/V1-07-...` → focused work branches if needed).

---

## Task 1: Persistent invite link schema and migration

**Files:**
- Create: `packages/db/src/schema/group-invite-links.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/XXXX_add_group_invite_links.sql` (next ordered prefix)
- Test: `packages/db/src/schema/group-invite-links.provider.integration.test.ts`

- [ ] **Step 1: Write the failing provider-backed test**

`packages/db/src/schema/group-invite-links.provider.integration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { groupInviteLinks } from "../schema/group-invite-links";
import { groups } from "../schema/identity";
import { users } from "../schema/identity";
import { withTemporarySchema } from "../dev/temporary-schema";

describe("group_invite_links schema", () => {
  it("enforces one active link per group", async () => {
    await withTemporarySchema(async (db) => {
      const [user] = await db.insert(users).values({ displayName: "U" }).returning();
      const [group] = await db
        .insert(groups)
        .values({ name: "G", createdByUserId: user.id })
        .returning();

      await db.insert(groupInviteLinks).values({
        groupId: group.id,
        tokenHash: "hash-a",
        tokenPrefix: "prefix-a",
        createdByUserId: user.id,
        status: "active",
      });

      await expect(
        db.insert(groupInviteLinks).values({
          groupId: group.id,
          tokenHash: "hash-b",
          tokenPrefix: "prefix-b",
          createdByUserId: user.id,
          status: "active",
        }),
      ).rejects.toThrow();
    });
  });

  it("allows one active and one rotated link for the same group", async () => {
    await withTemporarySchema(async (db) => {
      const [user] = await db.insert(users).values({ displayName: "U" }).returning();
      const [group] = await db
        .insert(groups)
        .values({ name: "G", createdByUserId: user.id })
        .returning();

      await db.insert(groupInviteLinks).values({
        groupId: group.id,
        tokenHash: "hash-a",
        tokenPrefix: "prefix-a",
        createdByUserId: user.id,
        status: "active",
      });
      await db.insert(groupInviteLinks).values({
        groupId: group.id,
        tokenHash: "hash-b",
        tokenPrefix: "prefix-b",
        createdByUserId: user.id,
        status: "rotated",
      });

      const rows = await db
        .select()
        .from(groupInviteLinks)
        .where(sql`${groupInviteLinks.groupId} = ${group.id}`);
      expect(rows).toHaveLength(2);
    });
  });
});
```

If `withTemporarySchema` does not exist in `packages/db/src/dev/`, grep for the existing provider-test isolation helper and use it instead. The multi-group provider test (`packages/db/src/schema/multi-group.test.ts` or similar) is the reference.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --provider neon packages/db/src/schema/group-invite-links.provider.integration.test.ts`
Expected: FAIL with module-not-found or table-does-not-exist.

- [ ] **Step 3: Write the schema module**

`packages/db/src/schema/group-invite-links.ts`:

```ts
import { sql } from "drizzle-orm";
import { pgTable, uuid, text, check, uniqueIndex } from "drizzle-orm/pg-core";
import { utcTimestamp } from "./_columns"; // use the repo's existing timestamp helper
import { groups } from "./identity";
import { users } from "./identity";

/**
 * Persistent, multi-use, deployment-bound invite links for group membership.
 *
 * Replaces the single-use `invitations` table for new acceptances. The raw public
 * link value is never stored — only its hash and a short non-secret prefix.
 */
export const groupInviteLinks = pgTable(
  "group_invite_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    rotatedAt: utcTimestamp("rotated_at"),
    status: text("status").notNull(),
  },
  (table) => [
    uniqueIndex("group_invite_links_one_active_per_group")
      .on(table.groupId)
      .where(sql`${table.status} = 'active'`),
    check(
      "group_invite_links_status_values",
      sql`${table.status} in ('active', 'rotated')`,
    ),
    check(
      "group_invite_links_rotated_fields_match",
      sql`(${table.status} = 'active' and ${table.rotatedAt} is null) or (${table.status} = 'rotated' and ${table.rotatedAt} is not null)`,
    ),
  ],
);
```

If `utcTimestamp` lives elsewhere (e.g. imported from a different module), use the same import the existing `identity.ts` schema uses. Match the existing convention exactly.

Re-export from `packages/db/src/schema/index.ts`:

```ts
export * from "./group-invite-links";
```

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate` (or the workspace's migration script — check `packages/db/package.json`).
Expected: a new file appears under `packages/db/drizzle/` with the next ordered prefix, containing `CREATE TABLE group_invite_links ...` plus the partial unique index and checks.

Inspect the generated SQL. Verify the partial unique index uses `WHERE status = 'active'`. If Drizzle's generator emitted a non-partial index, edit the migration SQL by hand to make it partial — the schema definition above already requests partial; the migration must match.

Add a preflight block at the top of the `up` section of the migration (before any DDL that depends on it) — or, if the project convention is a separate `verify` step, add the verification in the migration runner. The preflight checks:
1. No group already has more than one row in `invitations` whose status would conflict. (Existing `invitations` table is single-use; no migration of those rows happens. The check is a no-op safety net.)
2. No orphan rows reference groups or users that do not exist.

If a preflight fails, the migration aborts with a clear count + identifiers, no private user data.

- [ ] **Step 5: Run provider-backed test to verify it passes**

Run: `npm test -- --provider neon packages/db/src/schema/group-invite-links.provider.integration.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/group-invite-links.ts \
        packages/db/src/schema/index.ts \
        packages/db/src/schema/group-invite-links.provider.integration.test.ts \
        packages/db/drizzle/
git commit -m "feat(db): add persistent group_invite_links table"
```

---

## Task 2: Domain types and validation policies

**Files:**
- Create: `packages/domain/src/groups/group-details.ts`
- Create: `packages/domain/src/groups/invite-link.ts`
- Modify: `packages/domain/src/groups/index.ts` (re-export)
- Test: `packages/domain/src/groups/group-details.test.ts`
- Test: `packages/domain/src/groups/invite-link.test.ts`

- [ ] **Step 1: Write failing tests for name validation and invite-link helpers**

`packages/domain/src/groups/group-details.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateGroupName, GROUP_NAME_MAX_LENGTH } from "./group-details";

describe("validateGroupName", () => {
  it("accepts a non-empty name within the length cap", () => {
    expect(validateGroupName("Friends")).toBe("Friends");
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateGroupName("  Friends  ")).toBe("Friends");
  });

  it("rejects empty input", () => {
    expect(() => validateGroupName("")).toThrow(/name/i);
    expect(() => validateGroupName("   ")).toThrow(/name/i);
  });

  it("rejects names longer than the cap", () => {
    const long = "a".repeat(GROUP_NAME_MAX_LENGTH + 1);
    expect(() => validateGroupName(long)).toThrow(/name/i);
  });
});
```

`packages/domain/src/groups/invite-link.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mintInviteLink } from "./invite-link";

describe("mintInviteLink", () => {
  it("produces a public value, a hash, and a prefix", () => {
    const link = mintInviteLink();
    expect(link.publicValue).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(link.tokenHash).toHaveLength(64);
    expect(link.tokenPrefix).toMatch(/^[A-Za-z0-9_-]{8}$/);
  });

  it("produces unique values on subsequent calls", () => {
    const a = mintInviteLink();
    const b = mintInviteLink();
    expect(a.publicValue).not.toBe(b.publicValue);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("prefix is a substring of the public value", () => {
    const link = mintInviteLink();
    expect(link.publicValue.startsWith(link.tokenPrefix)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/domain/src/groups/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`packages/domain/src/groups/group-details.ts`:

```ts
export const GROUP_NAME_MAX_LENGTH = 60;

/** Trims and validates a proposed group name; throws on empty or too-long input. */
export function validateGroupName(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error("Group name is required.");
  }
  if (trimmed.length > GROUP_NAME_MAX_LENGTH) {
    throw new Error(`Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters.`);
  }
  return trimmed;
}

export interface GroupMemberSummary {
  readonly userId: string;
  readonly displayName: string;
  readonly role: "group-owner" | "manager" | "member";
}

export interface GroupDetails {
  readonly groupId: string;
  readonly name: string;
  readonly viewerRole: "group-owner" | "manager" | "member";
  readonly owner: { readonly userId: string; readonly displayName: string };
  readonly members: readonly GroupMemberSummary[];
}
```

`packages/domain/src/groups/invite-link.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";

const PUBLIC_VALUE_BYTES = 32;
const PREFIX_LENGTH = 8;

export interface MintedInviteLink {
  readonly publicValue: string;
  readonly tokenHash: string;
  readonly tokenPrefix: string;
}

/** Mints a fresh deployment-bound invite link: public value, sha256 hash, and a short non-secret prefix. */
export function mintInviteLink(): MintedInviteLink {
  const bytes = randomBytes(PUBLIC_VALUE_BYTES);
  const publicValue = bytes.toString("base64url");
  return {
    publicValue,
    tokenHash: createHash("sha256").update(publicValue).digest("hex"),
    tokenPrefix: publicValue.slice(0, PREFIX_LENGTH),
  };
}

/** Recomputes the hash for a supplied public value, for lookup at acceptance time. */
export function hashPublicValue(publicValue: string): string {
  return createHash("sha256").update(publicValue).digest("hex");
}
```

Re-export from `packages/domain/src/groups/index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/domain/src/groups/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/groups/
git commit -m "feat(domain): add group name validation and invite-link helpers"
```

---

## Task 3: Contracts (request/response parsers)

**Files:**
- Create: `packages/contracts/src/groups/details.ts`
- Create: `packages/contracts/src/groups/rename.ts`
- Create: `packages/contracts/src/groups/create.ts`
- Create: `packages/contracts/src/groups/invite-link.ts`
- Modify: `packages/contracts/src/groups/index.ts`
- Test: 4 test files (one per module)

For each of the four parsers, write a parser test first (accepts valid, rejects malformed), then implement by following the existing strict-parser pattern in `packages/contracts/src/common/` and any existing `groups/` parser. Look at `packages/contracts/src/favorites/` or `packages/contracts/src/orders/` as the reference pattern.

- [ ] **Step 1: Write the four failing parser tests**

Each test file follows this shape (concrete for `details.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { parseGroupDetailsResponse } from "./details";

describe("parseGroupDetailsResponse", () => {
  it("accepts a complete payload", () => {
    const payload = {
      groupId: "g1",
      name: "Friends",
      viewerRole: "group-owner",
      owner: { userId: "u1", displayName: "Mia" },
      members: [{ userId: "u1", displayName: "Mia", role: "group-owner" }],
      inviteLink: { publicValue: "abc", tokenPrefix: "abc" },
    };
    expect(parseGroupDetailsResponse(payload)).toEqual(payload);
  });

  it("accepts a payload without inviteLink", () => {
    const payload = {
      groupId: "g1",
      name: "Friends",
      viewerRole: "member",
      owner: { userId: "u1", displayName: "Mia" },
      members: [{ userId: "u1", displayName: "Mia", role: "group-owner" }],
    };
    const parsed = parseGroupDetailsResponse(payload);
    expect(parsed.inviteLink).toBeUndefined();
  });

  it("rejects unknown role values", () => {
    const payload = {
      groupId: "g1",
      name: "Friends",
      viewerRole: "boss",
      owner: { userId: "u1", displayName: "Mia" },
      members: [],
    };
    expect(() => parseGroupDetailsResponse(payload)).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() => parseGroupDetailsResponse({ groupId: "g1" })).toThrow();
  });
});
```

The other three parsers (`rename.ts`, `create.ts`, `invite-link.ts`) follow the same TDD pattern. Required shapes:

- `parseRenameRequest({ name: string })` — non-empty string, length ≤ `GROUP_NAME_MAX_LENGTH`.
- `parseCreateGroupRequest({ name: string, ownerId: string })` — same name rules; `ownerId` is a non-empty string.
- `parseRotateInviteLinkResponse({ publicValue: string, tokenPrefix: string })`.
- `parseAcceptInviteLinkRequest({ publicValue: string })`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/contracts/src/groups/`
Expected: FAIL.

- [ ] **Step 3: Implement each parser**

Follow the existing strict-parser pattern. Reuse helpers from `packages/contracts/src/common/`. Each parser is a pure function that validates shape and returns a typedreadonly object, or throws a `PublicApiError("INVALID_INPUT", ...)`. Match the existing convention exactly; do not invent new error codes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/contracts/src/groups/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/groups/
git commit -m "feat(contracts): add group details, rename, create, and invite-link parsers"
```

---

## Task 4: Group authorization helper

**Files:**
- Modify: `apps/web/src/application/group-authorization.ts`
- Modify: `apps/web/src/application/group-authorization.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `group-authorization.test.ts`:

```ts
describe("requireGroupMembership", () => {
  it("returns the membership when one exists for the requested group", () => {
    const identity: AppIdentity = {
      authUserId: "a1",
      userId: "u1" as UserId,
      isPlatformAdmin: false,
      memberships: [{ groupId: "g1" as GroupId, role: "member" }],
    };
    const m = requireGroupMembership(identity, "g1" as GroupId);
    expect(m.role).toBe("member");
  });

  it("throws FORBIDDEN when no membership exists for the group", () => {
    const identity: AppIdentity = {
      authUserId: "a1",
      userId: "u1" as UserId,
      isPlatformAdmin: false,
      memberships: [{ groupId: "g2" as GroupId, role: "member" }],
    };
    expect(() => requireGroupMembership(identity, "g1" as GroupId)).toThrowErrorMatchingInlineSnapshot(
      `"PublicApiError(FORBIDDEN): You do not have access to this action."`,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/src/application/group-authorization.test.ts`
Expected: FAIL — `requireGroupMembership` is not exported.

- [ ] **Step 3: Implement**

Append to `group-authorization.ts`:

```ts
/** Returns the requested-group membership for any role, or throws FORBIDDEN if the viewer is not in the group. */
export function requireGroupMembership(
  identity: AppIdentity,
  groupId: GroupId,
): GroupMembershipIdentity {
  const membership = findGroupMembership(identity, groupId);
  if (membership === undefined) {
    throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
  }
  return membership;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- apps/web/src/application/group-authorization.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/application/group-authorization.ts apps/web/src/application/group-authorization.test.ts
git commit -m "feat(web): add requireGroupMembership authorization helper"
```

---

## Task 5: DB repositories for group details and invite links

**Files:**
- Create: `packages/db/src/repositories/group-details.ts`
- Create: `packages/db/src/repositories/group-invite-links.ts`
- Modify: `packages/db/src/repositories/index.ts`
- Test: `packages/db/src/repositories/group-details.test.ts`
- Test: `packages/db/src/repositories/group-invite-links.test.ts`

The repository pattern in this project is "persistence only — no business rules". Look at `packages/db/src/repositories/` for the existing pattern (likely something like `users.ts` or `memberships.ts`). Mirror it exactly: typed input, typed output, no permission checks, no validation beyond what the DB enforces.

- [ ] **Step 1: Write failing repository tests**

Use the existing in-memory or temporary-schema test pattern from `packages/db/src/repositories/`. Required behaviors:

`group-details.test.ts`:
- `loadGroupDetails(db, groupId)` returns `{ name, ownerUserId, members: [{ userId, role, joinedAt }] }` for a real group.
- Returns `undefined` for a non-existent group.
- Excludes removed memberships (`removedAt is null`).

`group-invite-links.test.ts`:
- `findActiveLinkByHash(db, hash)` returns the link row or `undefined`.
- `findActiveLinkForGroup(db, groupId)` returns the link row or `undefined`.
- `insertInviteLink(db, input)` inserts a row.
- `markLinkRotated(db, linkId, rotatedAt)` sets `status = 'rotated'` and `rotatedAt`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/db/src/repositories/group-details.test.ts packages/db/src/repositories/group-invite-links.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Repository functions are thin Drizzle wrappers. Example for `group-invite-links.ts`:

```ts
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "node-postgres";
import { groupInviteLinks } from "../schema/group-invite-links";

/** Loads the active invite link row for a group, or undefined. */
export async function findActiveLinkForGroup(db: NodePgDatabase, groupId: string) {
  const rows = await db
    .select()
    .from(groupInviteLinks)
    .where(eq(groupInviteLinks.groupId, groupId));
  // filter status === 'active' in app code OR add `.where(status = 'active')`
  return rows[0];
}
```

Adjust imports to match the project's repository signatures (look at how existing repositories receive the db handle). Use the same `*Repository` naming if that's the local convention.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/db/src/repositories/group-details.test.ts packages/db/src/repositories/group-invite-links.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/
git commit -m "feat(db): add group-details and group-invite-links repositories"
```

---

## Task 6: Use cases (load details, rename, rotate, create)

**Files:**
- Create: `apps/web/src/application/groups/load-group-details.ts`
- Create: `apps/web/src/application/groups/rename-group.ts`
- Create: `apps/web/src/application/groups/rotate-invite-link.ts`
- Create: `apps/web/src/application/groups/create-group.ts`
- 4 test files

Each use case is a pure-ish function: takes `(db, identity, input)`, calls repositories + domain helpers, returns a typed result. Authorization happens in the route handler that calls the use case (the helper is invoked there), not inside the use case — match the existing pattern.

- [ ] **Step 1: Write failing use-case tests**

For each use case, test:
- Happy path returns the expected typed result.
- Mutation use cases append an audit event in the same transaction.
- `rename-group` trims the name (delegates to `validateGroupName`).
- `rotate-invite-link` marks the prior link rotated and inserts a new active link in one transaction.
- `create-group` creates the group, the Owner membership, and one active invite link in one transaction.

Use the existing test fixtures and transaction test helpers from `apps/web/src/application/`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- apps/web/src/application/groups/`
Expected: FAIL.

- [ ] **Step 3: Implement**

Example for `rotate-invite-link.ts`:

```ts
import type { NodePgDatabase } from "node-postgres";
import { mintInviteLink } from "@ordah-please/domain";
import { findActiveLinkForGroup, markLinkRotated, insertInviteLink } from "@ordah-please/db";

export interface RotateInviteLinkInput {
  readonly groupId: string;
  readonly actingUserId: string;
}

export interface RotateInviteLinkResult {
  readonly publicValue: string;
  readonly tokenPrefix: string;
}

/** Marks the prior active link rotated and mints a fresh persistent link, in one transaction. */
export async function rotateInviteLink(
  db: NodePgDatabase,
  input: RotateInviteLinkInput,
): Promise<RotateInviteLinkResult> {
  return db.transaction(async (tx) => {
    const prior = await findActiveLinkForGroup(tx, input.groupId);
    if (prior !== undefined) {
      await markLinkRotated(tx, prior.id, new Date());
    }
    const minted = mintInviteLink();
    await insertInviteLink(tx, {
      groupId: input.groupId,
      tokenHash: minted.tokenHash,
      tokenPrefix: minted.tokenPrefix,
      createdByUserId: input.actingUserId,
      status: "active",
    });
    // append audit event — use the existing audit helper
    return { publicValue: minted.publicValue, tokenPrefix: minted.tokenPrefix };
  });
}
```

The other three follow the same structure. Audit-event appending uses the existing audit helper (look at how the multi-group work appended audit events).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- apps/web/src/application/groups/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/application/groups/
git commit -m "feat(web): add group details, rename, rotate-link, and create-group use cases"
```

---

## Task 7: API routes

**Files:**
- Create: `apps/web/app/api/groups/[groupId]/details/route.ts`
- Create: `apps/web/app/api/groups/[groupId]/rename/route.ts`
- Create: `apps/web/app/api/groups/[groupId]/invite-link/rotate/route.ts`
- Create: `apps/web/app/api/admin/groups/create/route.ts`

Each route follows the seven-step discipline: verify session → ensure identity → validate input → load roles → authorize → execute use case → return typed response.

Reference an existing route (e.g. `apps/web/app/api/access/...`) for the exact handler shape. Use `executeRoute` from `apps/web/src/application/execute-route.ts` if that's the established wrapper.

- [ ] **Step 1: Write failing route tests**

For each route, test:
- Happy path returns 200 with the typed body.
- Missing session returns `UNAUTHENTICATED`.
- Viewer without membership returns `FORBIDDEN`.
- For `rename` and `rotate`: Member and Manager roles return `FORBIDDEN`; Owner returns 200.
- For `create`: non-platform-admin returns `FORBIDDEN`; platform admin returns 200.

Use the existing in-memory or test-server pattern. Reference `apps/web/app/api/access/*.test.ts` for the established approach.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- apps/web/app/api/groups/ apps/web/app/api/admin/groups/`
Expected: FAIL.

- [ ] **Step 3: Implement**

Example for the details route:

```ts
import { requireGroupMembership } from "../../../../../src/application/group-authorization";
import { loadGroupDetails } from "../../../../../src/application/groups/load-group-details";
import { parseGroupDetailsResponse } from "@ordah-please/contracts";
// session + identity loader imports — match existing routes

export async function GET(request: Request, ctx: { params: { groupId: string } }) {
  // 1. verify session, ensure identity (existing helper)
  // 2. requireGroupMembership(identity, ctx.params.groupId)
  // 3. call loadGroupDetails(db, ctx.params.groupId, viewerRole)
  // 4. parse + return typed response
}
```

Match the exact path depth and helper imports of an existing route in the same area.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- apps/web/app/api/groups/ apps/web/app/api/admin/groups/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/groups/ apps/web/app/api/admin/groups/
git commit -m "feat(web): add group details, rename, rotate-link, and create-group API routes"
```

---

## Task 8: Update invitation acceptance to honor the new link format

**Files:**
- Modify: `apps/web/app/api/access/accept/route.ts` (or wherever the existing acceptance handler lives — grep for the existing single-use acceptance logic)
- Modify: the corresponding test file

- [ ] **Step 1: Write failing tests**

Add to the existing acceptance test:
- A valid persistent link creates or reactivates the membership in one transaction with an audit event.
- A second acceptance by the same already-active user returns `CONFLICT` without writing a duplicate audit event.
- An already-rotated link returns the safe `CONFLICT` (no detail leak).
- An old single-use token presented after this change also returns the safe `CONFLICT`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- apps/web/app/api/access/accept`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement**

Branch in the acceptance handler:
1. Hash the supplied value.
2. Look up `findActiveLinkByHash(db, hash)`.
3. If found and active: run the persistent-link acceptance path (no consumption, idempotent for the same user).
4. If not found: return the existing safe `CONFLICT`.

Do not look up the old `invitations` table at all in the new path. The old table is read-only from this point forward.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- apps/web/app/api/access/accept`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/access/accept/route.ts apps/web/app/api/access/accept/*.test.ts
git commit -m "feat(web): accept persistent invite links; retire single-use token path"
```

---

## Task 9: Web member UI — Groups list with real names + details page

**Files:**
- Modify: `apps/web/app/(member)/groups/page.tsx`
- Modify: `apps/web/app/components/groups-overview.tsx`
- Create: `apps/web/app/(member)/groups/[groupId]/page.tsx`
- Create: `apps/web/app/components/group-details-view.tsx`

- [ ] **Step 1: Write a Playwright test**

`tests/e2e/member/groups-details.spec.ts`:
- Sign in as a Group Owner.
- Visit `/groups`. See the real group name.
- Tap the group. Land on `/groups/{groupId}`. See name, role badge, owner, member list, and the invite-link section.
- As a Member-role viewer, visit the same URL. See name + roster; do not see the invite-link section.

Use the existing Playwright fixtures and sign-in helpers. Mark as `*.provider.spec.ts` if it requires dev Neon; otherwise it can run in CI.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/member/groups-details.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Modify the Groups list**

`groups-overview.tsx` — render each row as a Next.js `<Link href={\`/groups/${membership.groupId}\`}>` showing the group name and a role badge. Replace any existing mock content.

`(member)/groups/page.tsx` — already loads identity server-side. Extend to also load the group names for the viewer's memberships (a small repository read; or include the name in the identity summary if the existing shape supports it without breaking other callers).

If the existing identity summary does not include group names, the simplest path is a new server-side call `loadGroupNamesForUser(db, userId)` invoked once at the top of the page. Do not change the global `AppIdentity` shape — that is broader scope than this bundle.

- [ ] **Step 4: Build the details page**

`(member)/groups/[groupId]/page.tsx`:
- Server component. Load identity, require membership, call `loadGroupDetails`, render `<GroupDetailsView>`.
- Pass `canManage` (true only when `viewerRole === 'group-owner'`) to the view.

`group-details-view.tsx`:
- Server-rendered shell: name, role badge, owner line, member list.
- Client island for: rename (inline edit + Save/Cancel), copy-link button, rotate-link button. The island only renders when `canManage` is true.
- Loading / error / empty states use the existing visual tokens.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test tests/e2e/member/groups-details.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(member\)/groups/ apps/web/app/components/groups-overview.tsx apps/web/app/components/group-details-view.tsx tests/e2e/member/groups-details.spec.ts
git commit -m "feat(web): real group names + group details page with rename and rotate-link"
```

---

## Task 10: Web admin UI — Create group flow

**Files:**
- Modify: `apps/web/app/admin/groups/page.tsx`
- Create: `apps/web/app/components/create-group-dialog.tsx`
- Test: `tests/e2e/admin/admin-create-group.spec.ts`

- [ ] **Step 1: Write a Playwright test**

`tests/e2e/admin/admin-create-group.spec.ts`:
- Sign in as Platform Admin.
- Visit `/admin/groups`. See real groups (not mock).
- Click "Create group". Enter a name and pick an Owner from the dropdown. Submit.
- New group appears in the list with the chosen owner.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/admin/admin-create-group.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`admin/groups/page.tsx`:
- Server component. Load all groups (name + owner summary) via a small repository read authorized by Platform Admin role.
- Render the existing table layout but with real rows.
- Render the existing "Create group" button, now wired to open the dialog.

`create-group-dialog.tsx` (client component):
- Modal form: name text input, owner `<select>` populated from a server-loaded list of active product users, submit button.
- On submit: POST `/api/admin/groups/create`. Handle loading / validation-error / success / retry states.
- On success: refresh the page (or use `router.refresh()`).

Loading the user list for the Owner picker: do this server-side in the page and pass as a prop. Do not fetch from the client.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test tests/e2e/admin/admin-create-group.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/groups/page.tsx apps/web/app/components/create-group-dialog.tsx tests/e2e/admin/admin-create-group.spec.ts
git commit -m "feat(web): admin create-group flow with name + owner picker"
```

---

## Task 11: Android UI — Groups list with real names + details screen

**Files:**
- Modify: `apps/mobile/app/(member)/groups.tsx`
- Create: `apps/mobile/app/(member)/groups/[groupId].tsx`
- Create: `apps/mobile/src/features/groups/group-details-screen.tsx`
- Test: `apps/mobile/__tests__/group-details-screen.test.tsx`

- [ ] **Step 1: Write the failing component test**

`apps/mobile/__tests__/group-details-screen.test.tsx`:
- Renders name, role badge, owner, member list for an Owner viewer.
- Renders name + roster only for a Member viewer (no rename button, no invite-link section).
- Rename button invokes the callback.
- Rotate-link button invokes the callback.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/mobile/__tests__/group-details-screen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`groups.tsx`:
- Render rows from the existing identity summary. Replace mock content with real group name + role.
- Tap navigates to `/groups/{groupId}` via Expo Router.

`groups/[groupId].tsx`:
- Load details via authenticated fetch to `/api/groups/{groupId}/details`.
- Render `<GroupDetailsScreen>` with the parsed response.

`group-details-screen.tsx`:
- Pure presentational component. Role-gated sections: rename button, invite-link section with Copy and Rotate buttons.
- Loading / error / retry states use the existing React Native Paper tokens from `apps/mobile/src/theme/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apps/mobile/__tests__/group-details-screen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(member\)/groups.tsx apps/mobile/app/\(member\)/groups/ apps/mobile/src/features/groups/ apps/mobile/__tests__/group-details-screen.test.tsx
git commit -m "feat(mobile): real group names + group details screen with rename and rotate-link"
```

---

## Task 12: Documentation updates

**Files:**
- Modify: `context/progress-tracker.md`
- Modify: `context/architecture.md`
- Modify: `context/project-structure.md`

- [ ] **Step 1: Update the tracker**

In `context/progress-tracker.md`:
- Add a "Completed" line for this bundle: `Group details, creation, and persistent invites — visible Group membership journey with rename + rotate-link; admin create-group; persistent multi-use invite links replace single-use tokens for new acceptances`.
- Add a "Foundation" or new "Visible group journey" subsection noting that **Effective permissions** is still pending and will refactor the simple role checks introduced here.
- Add a note in "Open Decisions" if any decision is unresolved (e.g., exact URL shape, custom domain).

- [ ] **Step 2: Update architecture.md**

Replace any sentence that describes invitations as "expiring single-use tokens" with the new persistent, multi-use, deployment-bound model. Specifically the lines under "Auth and Access Model" about invitation tokens. Add a paragraph noting that the original `invitations` table is preserved read-only for audit history.

- [ ] **Step 3: Update project-structure.md**

Add the new files and routes to the tree. Add a sentence to the description paragraph: "Groups now renders real names and links to a Group details screen; Platform Admins can create a group from the web admin portal."

- [ ] **Step 4: Commit**

```bash
git add context/progress-tracker.md context/architecture.md context/project-structure.md
git commit -m "docs: update tracker, architecture, and structure for group details and persistent invites"
```

---

## Task 13: Final verification and squash merge

- [ ] **Step 1: Run the full provider-free suite**

Run: `npm test`
Expected: PASS — all unit, lint, typecheck.

- [ ] **Step 2: Run the full provider-backed suite sequentially**

Run: `npm run test:provider` (or the existing script)
Expected: PASS.

- [ ] **Step 3: Run the production builds**

Run: `npm run build`
Expected: web build and Android export both succeed.

- [ ] **Step 4: Manual browser and emulator checks**

Cover: cookie-free member view, no-membership member view, Member-role details view, Manager-role details view, Owner-role details view (rename + rotate), Platform Admin create-group flow, persistent-link acceptance happy path, repeat-acceptance conflict, rotated-link conflict.

- [ ] **Step 5: Move completion evidence to history**

Create `context/history/v1-07.md` (or matching the project's history naming convention) with the completion evidence: test summaries, browser/emulator check notes, migration preflight results, any rollback notes.

- [ ] **Step 6: Squash merge to main**

Per `AGENTS.md`:

```bash
git checkout main
git pull
git merge --squash task/V1-07-group-details-creation-and-invites
git commit -m "V1-07 Group details, creation, and persistent invites"
```

(Adjust the V1-07 number to whatever the next tracker number is — confirm in the tracker before committing.)

- [ ] **Step 7: Verify main is clean**

Run: `npm test && npm run build`
Expected: PASS.

---

## Self-Review

**Spec coverage:**
- Persistent multi-use link per group — Task 1 (schema) + Task 8 (acceptance).
- Group details screen with role-gated sections — Tasks 6, 7, 9, 11.
- Rename (Owner-only) — Tasks 2, 3, 6, 7, 9, 11.
- Rotate-link (Owner-only) — Tasks 2, 3, 6, 7, 9, 11.
- Admin create group (web only) — Tasks 6, 7, 10.
- Old single-use tokens rejected — Task 8.
- Authorization helpers replaceable by Effective permissions later — Task 4.
- Documentation — Task 12.

**Placeholder scan:** none.

**Type consistency:**
- `viewerRole` is consistently `"group-owner" | "manager" | "member"`.
- `MintedInviteLink` has `publicValue`, `tokenHash`, `tokenPrefix` everywhere.
- `requireGroupMembership` and `requireGroupRole` signatures match the existing helpers in `group-authorization.ts`.

**Risks called out:**
- The exact repository signatures in Task 5 depend on the existing project convention; the plan tells the implementer to mirror an existing repository rather than invent a new pattern.
- The exact route handler shape in Task 7 depends on the existing `executeRoute` wrapper; same guidance.
- The migration preflight in Task 1 must match how the project runs migrations — `packages/db/drizzle.config.ts` and the existing migration files show how.
