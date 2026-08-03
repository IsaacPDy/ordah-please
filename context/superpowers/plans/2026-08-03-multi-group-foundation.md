# Multi-Group Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-group access boundary with explicit group-scoped memberships, complete the Organizer-to-Manager cutover, and protect member/admin pages with real Better Auth identity checks.

**Architecture:** Make the vocabulary and schema cutover first, then expose all memberships through `AppIdentity`. Every group-scoped API carries an explicit `groupId` and authorizes against the matching membership; Platform Admin remains account-wide. Web and Android consume one minimal identity response and render honest no-membership states without pretending catalog or order mock data is connected.

**Tech Stack:** TypeScript, Drizzle ORM, Neon PostgreSQL, Better Auth, Next.js App Router, Expo React Native, Vitest, Jest, Playwright.

---

## Working Rules

- Work on `task/multi-group-foundation` in the primary checkout.
- Follow RED → verify failure → GREEN → verify pass for every behavior change.
- Do not edit `packages/db/drizzle/0000_initial_schema.sql`, `0001_yielding_stepford_cuckoos.sql`, or `0002_adorable_lily_hollister.sql`.
- Do not print `.env.local` or any credential value.
- Do not apply a migration to persistent development or production Neon during Tasks 1–9.
- Only Group Owners and Platform Admins may issue invitations in this bundle.
- Update `context/progress-tracker.md` after every meaningful implementation commit.

## File Map

### Canonical roles and order vocabulary

- Modify `packages/domain/src/types/roles.ts` and tests: canonical application/order role literals.
- Modify `packages/domain/src/orders/order.ts`, `food-deadline-policy.ts`, `voting-policy.ts`, and tests: Manager identifiers and resolution vocabulary.
- Modify `packages/contracts/src/orders/order-history.ts`, `order-requests.ts`, and tests: strict Manager request/history shapes.
- Modify `packages/db/src/schema/enums.ts` and `ordering.ts`: persisted Manager enum values and column identifiers.

### Multi-group persistence and identity

- Modify `packages/db/src/schema/identity.ts`: remove the one-group index and add the active-owner index.
- Create `packages/db/src/schema/multi-group.test.ts`: provider-free Drizzle metadata proof for the new index, enums, and order column.
- Create one new file under `packages/db/drizzle/`: ordered migration generated from the changed schema and reviewed for data-preserving enum/column renames.
- Modify `packages/db/src/schema/schema.provider.integration.test.ts`: migration invariants and preservation proof.
- Modify `packages/db/src/repositories/identity-access.ts`: deterministic active-membership list.
- Modify `apps/web/src/auth/load-app-identity.ts` and tests: `isPlatformAdmin` plus all group memberships.
- Create `apps/web/src/application/group-authorization.ts` and test: small group-membership lookup and role guards.

### Group-scoped access APIs

- Modify `packages/contracts/src/access/access-requests.ts`, its tests, and `packages/contracts/src/index.ts`: explicit `groupId` in group-scoped requests.
- Modify `apps/web/src/features/access/access-service.ts` and tests: multi-group invitation acceptance and Manager vocabulary.
- Modify `apps/web/src/features/access/access-route-handlers.ts` and tests: requested-group authorization.
- Modify `apps/web/src/features/access/access-runtime.ts`: wire changed types without creating a default group.
- Modify existing route files under `apps/web/app/api/access/`: preserve URLs while consuming the new bodies.

### Protected pages and client identity

- Create `apps/web/src/auth/load-server-page-identity.ts` and test: convert Next request headers into the existing Better Auth/session/identity boundary and expose one request-cached loader for layouts/pages.
- Modify `apps/web/app/(member)/layout.tsx`: authenticated member page gate.
- Modify `apps/web/app/admin/layout.tsx`: Platform Admin page gate before rendering navigation.
- Create `packages/contracts/src/access/identity-summary.ts` and test: strict shared identity-response parser.
- Modify `apps/web/app/api/identity/me/route.ts` and handler tests: return account role plus all memberships.
- Create focused web no-membership components/tests and use them in Home, Orders, and Groups.
- Create `apps/mobile/src/features/access/use-app-identity.ts` and test: load the same identity through cookie-only authenticated requests.
- Modify native Home, Orders, Groups, and tests: no-membership and multi-membership states.

### Documentation and verification

- Modify `context/architecture.md`, `context/project-structure.md`, `context/design-structure.md`, `context/ui-context.md`, and `context/progress-tracker.md` only where the implemented boundary changes them.
- Create `context/history/multi-group-foundation.md` only at completed squash time.

---

### Task 1: Replace active Organizer vocabulary with Manager

**Files:**

- Modify: `packages/domain/src/types/roles.test.ts`
- Modify: `packages/domain/src/index.test.ts`
- Modify: `packages/domain/src/orders/order.test.ts`
- Modify: `packages/domain/src/orders/voting-policy.test.ts`
- Modify: `packages/domain/src/orders/food-deadline-policy.test.ts`
- Modify: `packages/contracts/src/orders/order-history.test.ts`
- Modify: `packages/contracts/src/orders/order-requests.test.ts`
- Modify after RED: matching production files beside those tests

- [ ] **Step 1: Change role tests to demand Manager vocabulary**

```ts
expect(APPLICATION_ROLES).toEqual([
  "member",
  "manager",
  "group-owner",
  "platform-admin",
]);
expect(ORDER_ROLES).toEqual(["participant", "manager"]);
```

Rename order fixtures and assertions from `organizerId`, `organizerInitialVote`, `OrganizerResolution`, and `organizer_resolution` to `managerId`, `managerInitialVote`, `ManagerResolution`, and `manager_resolution`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts \
  packages/domain/src/types/roles.test.ts \
  packages/domain/src/index.test.ts \
  packages/domain/src/orders/order.test.ts \
  packages/domain/src/orders/voting-policy.test.ts \
  packages/domain/src/orders/food-deadline-policy.test.ts \
  packages/contracts/src/orders/order-history.test.ts \
  packages/contracts/src/orders/order-requests.test.ts
```

Expected: FAIL because the exports and parsers still expose Organizer names and literals.

- [ ] **Step 3: Make the canonical domain and contract rename**

Use these canonical declarations:

```ts
export const APPLICATION_ROLES = [
  "member",
  "manager",
  "group-owner",
  "platform-admin",
] as const;

export const ORDER_ROLES = ["participant", "manager"] as const;

export type ManagerResolutionRequest = Readonly<{
  participantUserId: UserId;
  selection: FoodSelectionInput;
}>;
```

Rename exported functions and fields consistently, including `parseManagerResolutionRequest`, `managerId`, `managerInitialVote`, and `managerResolutions`. Keep one-sentence descriptions above every renamed exported or non-obvious function.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command.

Expected: PASS with no remaining active source export using Organizer vocabulary.

- [ ] **Step 5: Run the active-source vocabulary scan**

```bash
rg -n "organizer|Organizer" packages/domain packages/contracts \
  --glob '!**/dist/**'
```

Expected: no matches.

- [ ] **Step 6: Update the tracker and commit**

Add a short current-work note under the multi-group bundle in `context/progress-tracker.md`, then:

```bash
git add packages/domain packages/contracts context/progress-tracker.md
git commit -m "refactor(domain): rename Organizer roles to Manager"
```

---

### Task 2: Change the Drizzle schema and generate the migration

**Files:**

- Modify: `packages/db/src/schema/enums.ts`
- Modify: `packages/db/src/schema/identity.ts`
- Modify: `packages/db/src/schema/ordering.ts`
- Create: `packages/db/src/schema/multi-group.test.ts`
- Modify: `packages/db/src/schema/schema.provider.integration.test.ts`
- Create: `packages/db/drizzle/0003_<generated-name>.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`
- Create: `packages/db/drizzle/meta/0003_snapshot.json`

- [ ] **Step 1: Write a provider-free schema metadata test**

```ts
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  foodSelectionSourceEnum,
  memberships,
  membershipRoleEnum,
  orders,
  orderParticipantRoleEnum,
} from "./index.js";

describe("multi-group schema", () => {
  it("uses Manager vocabulary and one active owner per group", () => {
    expect(membershipRoleEnum.enumValues).toEqual([
      "owner",
      "manager",
      "member",
    ]);
    expect(orderParticipantRoleEnum.enumValues).toEqual(["manager", "member"]);
    expect(foodSelectionSourceEnum.enumValues).toContain("manager_resolution");

    const membershipIndexes = getTableConfig(memberships).indexes.map(
      (index) => index.config.name,
    );
    expect(membershipIndexes).toContain("memberships_one_active_owner_per_group");
    expect(membershipIndexes).not.toContain(
      "memberships_one_active_group_per_user",
    );

    const orderColumns = getTableConfig(orders).columns.map(
      (column) => column.name,
    );
    expect(orderColumns).toContain("manager_user_id");
    expect(orderColumns).not.toContain("organizer_user_id");
  });
});
```

- [ ] **Step 2: Update provider integration tests for the target schema**

Replace the old one-group rejection with successful membership in two groups, and add a second-owner rejection:

```ts
await client.query(
  "INSERT INTO memberships (group_id, user_id, role) VALUES ($1, $2, 'member')",
  [groupTwo, userOne],
);

await expectConstraintFailure(
  client,
  "INSERT INTO memberships (group_id, user_id, role) VALUES ($1, $2, 'owner')",
  [groupOne, userTwo],
  "memberships_one_active_owner_per_group",
);
```

Update all schema SQL fixtures to `manager_user_id`, role `manager`, and source `manager_resolution`. Add information-schema assertions that the old index and old order column are absent and the new index/column exist.

- [ ] **Step 3: Run the metadata test and verify RED without contacting Neon**

```bash
npx vitest run --config vitest.config.ts packages/db/src/schema/multi-group.test.ts
```

Expected: FAIL because the schema still exposes Organizer enum values, the old one-group index, and `organizer_user_id`. Do not set `RUN_PROVIDER_TESTS` at this step.

- [ ] **Step 4: Change the Drizzle schema**

Use these enum values:

```ts
export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "manager",
  "member",
]);
export const orderParticipantRoleEnum = pgEnum("order_participant_role", [
  "manager",
  "member",
]);
export const foodSelectionSourceEnum = pgEnum("food_selection_source", [
  "saved_favorite",
  "inline",
  "manager_resolution",
  "declined",
]);
```

In `memberships`, remove `memberships_one_active_group_per_user` and add:

```ts
uniqueIndex("memberships_one_active_owner_per_group")
  .on(table.groupId)
  .where(sql`${table.role} = 'owner' and ${table.removedAt} is null`)
```

Rename the order schema property and column to `managerUserId: uuid("manager_user_id")`; rename food-selection check expressions to `manager_resolution`.

- [ ] **Step 5: Run the metadata test and verify GREEN**

```bash
npx vitest run --config vitest.config.ts packages/db/src/schema/multi-group.test.ts
```

Expected: PASS.

- [ ] **Step 6: Generate the ordered Drizzle migration**

```bash
npm run db:generate --workspace @ordah-please/db -- --name multi_group_foundation
```

When Drizzle asks whether renamed fields are new or renamed, select rename for `organizer_user_id → manager_user_id`. Inspect the generated SQL before running it anywhere.

- [ ] **Step 7: Make the new migration explicitly data preserving**

The new migration must contain the equivalent of:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM groups g
    LEFT JOIN memberships m
      ON m.group_id = g.id
     AND m.role = 'owner'
     AND m.removed_at IS NULL
    WHERE g.archived_at IS NULL
    GROUP BY g.id
    HAVING count(m.user_id) <> 1
  ) THEN
    RAISE EXCEPTION 'Each active group must have exactly one active owner';
  END IF;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."membership_role" RENAME VALUE 'organizer' TO 'manager';
--> statement-breakpoint
ALTER TYPE "public"."order_participant_role" RENAME VALUE 'organizer' TO 'manager';
--> statement-breakpoint
ALTER TYPE "public"."food_selection_source" RENAME VALUE 'organizer_resolution' TO 'manager_resolution';
--> statement-breakpoint
DROP INDEX "public"."memberships_one_active_group_per_user";
--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_one_active_owner_per_group"
  ON "memberships" USING btree ("group_id")
  WHERE "memberships"."role" = 'owner'
    AND "memberships"."removed_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "organizer_user_id" TO "manager_user_id";
```

Retain Drizzle-generated foreign-key/constraint rename operations as needed. Do not drop and recreate any table or enum when a rename preserves the data.

- [ ] **Step 8: Validate generated history locally**

```bash
npm run db:check --workspace @ordah-please/db
npm run typecheck --workspace @ordah-please/db
git diff --check
```

Expected: all commands exit 0; the migration journal has four ordered entries.

- [ ] **Step 9: Update the tracker and commit**

```bash
git add packages/db context/progress-tracker.md
git commit -m "feat(db): add multi-group Manager migration"
```

---

### Task 3: Return every group membership in application identity

**Files:**

- Modify: `packages/db/src/repositories/identity-access.ts`
- Modify: `packages/db/src/repositories/repositories.provider.integration.test.ts`
- Modify: `apps/web/src/auth/load-app-identity.test.ts`
- Modify: `apps/web/src/auth/load-app-identity.ts`
- Create: `apps/web/src/application/group-authorization.test.ts`
- Create: `apps/web/src/application/group-authorization.ts`

- [ ] **Step 1: Write failing identity tests**

Demand an identity containing no default group and all memberships:

```ts
await expect(loadAppIdentity(authIdentity, repository)).resolves.toEqual({
  authUserId: AUTH_USER_ID,
  isPlatformAdmin: true,
  memberships: [
    { groupId: "group-1", role: "manager" },
    { groupId: "group-2", role: "member" },
  ],
  userId: "internal-user-1",
});
```

Also test a groupless user returns `memberships: []` and an archived user still throws `UNAVAILABLE`.

- [ ] **Step 2: Write failing group-authorization tests**

```ts
expect(requireGroupRole(identity, "group-1", ["manager"]))
  .toEqual({ groupId: "group-1", role: "manager" });

expect(() => requireGroupRole(identity, "group-2", ["manager"]))
  .toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
```

Include a test proving Platform Admin does not silently become a group Manager.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
npx vitest run --config vitest.config.ts \
  apps/web/src/auth/load-app-identity.test.ts \
  apps/web/src/application/group-authorization.test.ts
```

Expected: FAIL because `memberships`, `isPlatformAdmin`, and `requireGroupRole` do not exist.

- [ ] **Step 4: Implement deterministic membership loading**

Order repository results by `groupId`, then use:

```ts
export interface GroupMembershipIdentity {
  readonly groupId: GroupId;
  readonly role: "group-owner" | "manager" | "member";
}

export interface AppIdentity {
  readonly authUserId: string;
  readonly isPlatformAdmin: boolean;
  readonly memberships: readonly GroupMembershipIdentity[];
  readonly userId: UserId;
}
```

Map persisted roles with:

```ts
const MEMBERSHIP_ROLE_MAP = {
  member: "member",
  manager: "manager",
  owner: "group-owner",
} as const;
```

Implement `findGroupMembership(identity, groupId)` and `requireGroupRole(identity, groupId, allowedRoles)` in the new focused authorization module. Every exported function gets a one-sentence purpose description.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 3 command, then:

```bash
npm run typecheck --workspace @ordah-please/web
npm run lint --workspace @ordah-please/web
```

Expected: all commands exit 0.

- [ ] **Step 6: Update the tracker and commit**

```bash
git add packages/db/src/repositories apps/web/src/auth \
  apps/web/src/application/group-authorization.ts \
  apps/web/src/application/group-authorization.test.ts \
  context/progress-tracker.md
git commit -m "feat(auth): load group-scoped memberships"
```

---

### Task 4: Add explicit group IDs to access contracts

**Files:**

- Modify: `packages/contracts/src/access/access-requests.test.ts`
- Modify: `packages/contracts/src/access/access-requests.ts`
- Create: `packages/contracts/src/access/identity-summary.test.ts`
- Create: `packages/contracts/src/access/identity-summary.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write failing strict-parser tests**

Use these request shapes:

```ts
parseIssueInvitationRequest({
  expiresAt: "2026-08-10T00:00:00.000Z",
  groupId: "group-1",
});
parseMemberActionRequest({ groupId: "group-1", userId: "user-2" });
parseCreateAdminAccessRequest({ groupId: "group-1" });
```

Test missing `groupId`, blank `groupId`, and unknown fields as failures.

- [ ] **Step 2: Run contract tests and verify RED**

```bash
npm test --workspace @ordah-please/contracts
```

Expected: FAIL because existing parsers reject `groupId` as unknown.

- [ ] **Step 3: Implement the exact request types**

```ts
export type IssueInvitationRequest = Readonly<{
  expiresAt: UtcTimestamp;
  groupId: GroupId;
}>;
export type MemberActionRequest = Readonly<{
  groupId: GroupId;
  userId: UserId;
}>;
export type CreateAdminAccessRequest = Readonly<{
  groupId: GroupId;
}>;
```

Use `parseRecordId<GroupId>` in each strict parser and re-export changed types through `packages/contracts/src/index.ts`.

- [ ] **Step 4: Add the shared identity-summary parser test and implementation**

The parser must strictly validate this response and reject duplicate `groupId` entries:

```ts
export type AppIdentitySummary = Readonly<{
  isPlatformAdmin: boolean;
  memberships: readonly Readonly<{
    groupId: GroupId;
    role: "group-owner" | "manager" | "member";
  }>[];
  pendingAdminRequestCount: number;
}>;
```

Export `parseAppIdentitySummary` and `AppIdentitySummary` from `packages/contracts/src/index.ts`. Use the existing strict-object, record-id, and array helpers; validate `pendingAdminRequestCount` as a non-negative integer.

- [ ] **Step 5: Run contract tests and verify GREEN**

```bash
npm test --workspace @ordah-please/contracts
npm run typecheck --workspace @ordah-please/contracts
```

Expected: both commands exit 0.

- [ ] **Step 6: Update the tracker and commit**

```bash
git add packages/contracts context/progress-tracker.md
git commit -m "feat(contracts): scope access actions to a group"
```

---

### Task 5: Make invitation and membership services multi-group safe

**Files:**

- Modify: `apps/web/src/features/access/access-service.test.ts`
- Modify: `apps/web/src/features/access/access-service.provider.integration.test.ts`
- Modify: `apps/web/src/features/access/access-service.ts`
- Modify: `packages/db/src/repositories/group-access.ts`
- Modify: `packages/db/src/repositories/repositories.provider.integration.test.ts`

- [ ] **Step 1: Write failing invitation tests**

Test that a user with Group A membership can accept Group B:

```ts
listActiveMemberships: () =>
  Promise.resolve([{ groupId: "group-a", role: "member" }]),
```

Expected result:

```ts
{ groupId: "group-b", role: "member" }
```

Add a test where `listActiveMemberships` contains `group-b`; expect `CONFLICT`, no membership write, and no audit write.

- [ ] **Step 2: Write failing owner-protection and Manager tests**

Demand `manageGroupMember` return `"manager"` after promotion and reject any target whose role is `owner`. Verify rejected actions do not append an audit row.

- [ ] **Step 3: Run focused service tests and verify RED**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/access/access-service.test.ts
```

Expected: FAIL because acceptance still rejects any existing membership and services still return Organizer.

- [ ] **Step 4: Implement group-specific invitation acceptance**

Replace the length check with:

```ts
const alreadyJoined = (
  await repositories.access.listActiveMemberships(command.userId)
).some((membership) => membership.groupId === invitation.groupId);

if (alreadyJoined) {
  throw new PublicApiError(
    "CONFLICT",
    "Your account already belongs to this group.",
  );
}
```

Change membership service roles from `organizer` to `manager`. Keep invitation acceptance, membership upsert, and audit append inside one transaction.

- [ ] **Step 5: Run focused service tests and verify GREEN**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/access/access-service.test.ts
npm run typecheck --workspace @ordah-please/web
```

Expected: both commands exit 0.

- [ ] **Step 6: Update repository fixtures and provider tests**

Change repository expectations to Manager vocabulary, verify one user can have Group A and Group B memberships, and verify the active-owner partial index rejects a second owner.

- [ ] **Step 7: Update the tracker and commit**

```bash
git add apps/web/src/features/access/access-service.ts \
  apps/web/src/features/access/access-service.test.ts \
  apps/web/src/features/access/access-service.provider.integration.test.ts \
  packages/db/src/repositories context/progress-tracker.md
git commit -m "feat(access): accept memberships across groups"
```

---

### Task 6: Authorize access routes against the requested group

**Files:**

- Modify: `apps/web/src/features/access/access-route-handlers.test.ts`
- Modify: `apps/web/src/features/access/access-route-handlers.ts`
- Modify: `apps/web/src/features/access/access-runtime.ts`
- Verify: route files under `apps/web/app/api/access/`

- [ ] **Step 1: Replace default-group route fixtures with multi-membership identities**

Use:

```ts
const ownerIdentity: AppIdentity = {
  authUserId: "auth-user-1",
  isPlatformAdmin: false,
  memberships: [
    { groupId: "group-a", role: "group-owner" },
    { groupId: "group-b", role: "member" },
  ],
  userId: "user-1",
};
```

Add tests proving an owner action for Group A succeeds and the same action for Group B returns 403 without calling the service.

- [ ] **Step 2: Test Platform Admin and groupless behavior**

Update pending/decide/identity tests to use `isPlatformAdmin`. Add a groupless identity response test with `memberships: []`.

- [ ] **Step 3: Run handler tests and verify RED**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/access/access-route-handlers.test.ts
```

Expected: FAIL because handlers still read `identity.groupId` and aggregated `identity.roles`.

- [ ] **Step 4: Implement requested-group authorization**

Delete `requireOwnerGroupId`. Import the focused helper from `group-authorization.ts` and authorize using the parsed request:

```ts
authorize: ({ identity, input }) =>
  findGroupMembership(identity, input.groupId)?.role === "group-owner",
execute: ({ identity, input }) =>
  dependencies.issueInvitation({
    actorUserId: identity.userId,
    deploymentId: dependencies.deploymentId,
    expiresAt: new Date(input.expiresAt),
    groupId: input.groupId,
    now: dependencies.now(),
  }),
```

Use `identity.isPlatformAdmin` for account-wide admin handlers. Return Manager role values from member handlers. Preserve the existing cross-site mutation check.

- [ ] **Step 5: Run handler tests and verify GREEN**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/access/access-route-handlers.test.ts
npm run typecheck --workspace @ordah-please/web
npm run lint --workspace @ordah-please/web
npm run build --workspace @ordah-please/web
```

Expected: all commands exit 0 and all existing route files compile unchanged at their public URLs.

- [ ] **Step 6: Update the tracker and commit**

```bash
git add apps/web/src/features/access apps/web/app/api/access \
  context/progress-tracker.md
git commit -m "feat(access): authorize requested group memberships"
```

---

### Task 7: Protect web page layouts and expose the identity summary

**Files:**

- Create: `apps/web/src/auth/load-server-page-identity.test.ts`
- Create: `apps/web/src/auth/load-server-page-identity.ts`
- Modify: `apps/web/app/(member)/layout.tsx`
- Modify: `apps/web/app/admin/layout.tsx`
- Modify: `apps/web/src/features/access/sign-in-prompt-view.tsx`
- Modify: `apps/web/src/features/access/sign-in-prompt-view.test.tsx`
- Modify: `apps/web/src/features/access/access-route-handlers.test.ts`
- Modify: `apps/web/src/features/access/access-route-handlers.ts`
- Modify: `apps/web/app/api/identity/me/route.ts`

- [ ] **Step 1: Write failing server-page identity tests**

Test these three outcomes with injected dependencies:

```ts
await expect(loadServerPageIdentity(headers, dependencies))
  .resolves.toEqual(identity);
await expect(loadServerPageIdentity(headers, missingSessionDependencies))
  .resolves.toEqual({ status: "unauthenticated" });
await expect(loadServerPageIdentity(headers, unavailableDependencies))
  .resolves.toEqual({ status: "unavailable" });
```

The helper must translate only public auth errors; unexpected errors must still throw.

- [ ] **Step 2: Write failing layout rendering tests**

Extract pure view components if needed so tests prove:

- unauthenticated member pages show Google sign-in;
- authenticated member pages render navigation even with `memberships: []`;
- non-admin `/admin` renders “Only platform admins can open the admin workspace” and no admin navigation;
- Platform Admin renders the admin shell.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
npx vitest run --config vitest.config.ts \
  apps/web/src/auth/load-server-page-identity.test.ts \
  apps/web/src/features/access/sign-in-prompt-view.test.tsx \
  apps/web/src/features/access/access-route-handlers.test.ts
```

Expected: FAIL because the page loader and page-level gates do not exist.

- [ ] **Step 4: Implement the server page boundary**

Use Next's `headers()` only in the page/layout composition layer. Build a `Request` with those headers, call the existing `verifySession`, then `loadRuntimeIdentity`. Keep the helper dependency-injected for provider-free tests.

Return a discriminated result:

```ts
type ServerPageIdentityResult =
  | Readonly<{ status: "authenticated"; identity: AppIdentity }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "unavailable" }>;
```

Export a `getCurrentServerPageIdentity` function wrapped in React `cache()` so the member layout and child page share one session/identity read during a request. Render `SignInPrompt` for unauthenticated member access. In `AdminLayout`, render no admin navigation unless `result.status === "authenticated" && result.identity.isPlatformAdmin`.

- [ ] **Step 5: Expand `GET /api/identity/me`**

Return:

```ts
{
  isPlatformAdmin: identity.isPlatformAdmin,
  memberships: identity.memberships,
  pendingAdminRequestCount: identity.isPlatformAdmin
    ? (await dependencies.countPendingAdminRequests()).length
    : 0,
}
```

Do not expose the Better Auth user ID or product user ID to the native navigation response.

- [ ] **Step 6: Run focused and build verification**

```bash
npx vitest run --config vitest.config.ts \
  apps/web/src/auth/load-server-page-identity.test.ts \
  apps/web/src/features/access/sign-in-prompt-view.test.tsx \
  apps/web/src/features/access/access-route-handlers.test.ts
npm run typecheck --workspace @ordah-please/web
npm run lint --workspace @ordah-please/web
npm run build --workspace @ordah-please/web
```

Expected: all commands exit 0.

- [ ] **Step 7: Update the tracker and commit**

```bash
git add apps/web/src/auth apps/web/app apps/web/src/features/access \
  context/progress-tracker.md
git commit -m "feat(web): protect member and admin page shells"
```

---

### Task 8: Render honest web no-membership states

**Files:**

- Create: `apps/web/app/components/member-access-state.test.tsx`
- Create: `apps/web/app/components/member-access-state.tsx`
- Modify: `apps/web/app/(member)/page.tsx`
- Modify: `apps/web/app/(member)/orders/page.tsx`
- Modify: `apps/web/app/(member)/groups/page.tsx`
- Modify: `apps/web/app/(member)/favorites/page.tsx`

- [ ] **Step 1: Write failing view tests**

Test exact behavior:

```ts
expect(renderNoMembershipOrders()).toContain("No group orders yet");
expect(renderNoMembershipGroups()).toContain("You have not joined a group yet");
expect(renderNoMembershipHome()).toContain("Restaurants");
expect(renderNoMembershipFavorites()).toContain("Favorites");
```

Also assert the no-membership Home does not render the fake “Friday lunch” active order.

- [ ] **Step 2: Run the component test and verify RED**

```bash
npx vitest run --config vitest.config.ts apps/web/app/components/member-access-state.test.tsx
```

Expected: FAIL because the new access-state component does not exist.

- [ ] **Step 3: Implement one small access-state component**

```ts
export interface MemberAccessStateProps {
  readonly hasMemberships: boolean;
  readonly surface: "home" | "orders" | "favorites" | "groups";
}
```

Use approved tokens and English copy. Home and Favorites keep their discovery surfaces; Orders and Groups show their honest empty states. Do not connect catalog/order mock data in this bundle.

Each page calls the request-cached `getCurrentServerPageIdentity`; it does not query Neon directly and does not create a second uncached identity loader. Pass `identity.memberships.length > 0` into the pure access-state component.

- [ ] **Step 4: Run focused and web checks**

```bash
npx vitest run --config vitest.config.ts apps/web/app/components/member-access-state.test.tsx
npm run typecheck --workspace @ordah-please/web
npm run lint --workspace @ordah-please/web
npm run build --workspace @ordah-please/web
```

Expected: all commands exit 0.

- [ ] **Step 5: Update UI context, tracker, and commit**

Record the shared no-membership rule in `context/design-structure.md` and `context/ui-context.md`, then:

```bash
git add apps/web/app context/design-structure.md context/ui-context.md \
  context/progress-tracker.md
git commit -m "feat(web): add no-membership member states"
```

---

### Task 9: Connect Android identity and no-membership states

**Files:**

- Create: `apps/mobile/src/features/access/use-app-identity.test.tsx`
- Create: `apps/mobile/src/features/access/use-app-identity.ts`
- Create: `apps/mobile/src/features/access/mobile-member-gate.tsx`
- Create: `apps/mobile/src/features/access/member-access-state.tsx`
- Create: `apps/mobile/__tests__/member-access-state.test.tsx`
- Modify: `apps/mobile/app/(member)/index.tsx`
- Modify: `apps/mobile/app/(member)/orders.tsx`
- Modify: `apps/mobile/app/(member)/groups.tsx`
- Modify: `apps/mobile/app/(member)/favorites.tsx`
- Modify: `apps/mobile/app/(member)/_layout.tsx`
- Modify: `apps/mobile/__tests__/home-screen.test.tsx`
- Modify: `apps/mobile/__tests__/member-navigation.test.tsx`

- [ ] **Step 1: Write failing identity-hook tests**

Mock `authenticatedRequest` and require parsing of:

```ts
{
  isPlatformAdmin: false,
  memberships: [
    { groupId: "group-a", role: "group-owner" },
    { groupId: "group-b", role: "manager" },
  ],
  pendingAdminRequestCount: 0,
}
```

Test loading, authenticated-with-no-groups, multi-group, unauthenticated, and retryable-error states.

- [ ] **Step 2: Write failing native view tests**

Require:

- Home still shows restaurant discovery when memberships are empty;
- fake active-order content is absent when memberships are empty;
- Orders shows “No group orders yet”;
- Groups shows “You have not joined a group yet”;
- multi-membership cards label Group Owner, Manager, and Member exactly.

- [ ] **Step 3: Run native tests and verify RED**

```bash
npm run test --workspace @ordah-please/mobile -- \
  --runInBand use-app-identity.test.tsx member-access-state.test.tsx \
  home-screen.test.tsx member-navigation.test.tsx
```

Expected: FAIL because the hook and access-state component do not exist.

- [ ] **Step 4: Implement the cookie-only identity hook**

Call `/api/identity/me` through the existing `authenticated-request` helper. Do not add bearer tokens or new `EXPO_PUBLIC_*` secrets. Parse the response with `parseAppIdentitySummary` from `@ordah-please/contracts` before exposing it.

```ts
type AppIdentitySummary = Readonly<{
  isPlatformAdmin: boolean;
  memberships: readonly Readonly<{
    groupId: string;
    role: "group-owner" | "manager" | "member";
  }>[];
  pendingAdminRequestCount: number;
}>;
```

The hook owns loading/error/retry state; screens only render the state they receive.

- [ ] **Step 5: Gate the native member tabs with the identity state**

`MobileMemberGate` renders loading, Google sign-in, unavailable, retry, or authenticated children. Mount it in `apps/mobile/app/(member)/_layout.tsx` around the existing `Tabs`; an authenticated identity with `memberships: []` is valid and must render the tabs.

- [ ] **Step 6: Implement native no-membership views**

Use React Native Paper and existing shared tokens. Keep Home restaurant cards and Favorites entry available. Replace mock active orders and group cards when the identity has no memberships.

- [ ] **Step 7: Run native verification and Android export**

```bash
npm run test --workspace @ordah-please/mobile
npm run typecheck --workspace @ordah-please/mobile
npm run lint --workspace @ordah-please/mobile
```

Then, from `apps/mobile/`:

```bash
npx expo export --platform android
```

Expected: all tests/checks pass and Expo writes a successful Android export without exposing secrets.

- [ ] **Step 8: Update the tracker and commit**

```bash
git add apps/mobile context/progress-tracker.md
git commit -m "feat(mobile): connect multi-group identity states"
```

---

### Task 10: Remove remaining active Organizer vocabulary

**Files:**

- Modify all active files returned by the scan below.
- Do not modify completed history, old applied migrations, or superseded historical specs.

- [ ] **Step 1: Scan active code and current product documents**

```bash
rg -n "organizer|Organizer" packages apps context \
  --glob '!packages/db/drizzle/000[0-2]_*.sql' \
  --glob '!packages/db/drizzle/meta/000[0-2]_snapshot.json' \
  --glob '!context/history/**' \
  --glob '!context/specs/00-v1-product-design.md' \
  --glob '!context/specs/02-better-auth-migration-design.md' \
  --glob '!context/specs/03-v1-06-platform-admin-approval-design.md' \
  --glob '!context/superpowers/handoffs/2026-07-31-v1-06-remaining-tasks.md' \
  --glob '!context/superpowers/plans/2026-07-30-v1-06-platform-admin-approval.md'
```

Expected before cleanup: only current UI copy, current service documentation, current architecture text, generated 0003 migration/snapshot historical old-value references, or missed active source identifiers.

- [ ] **Step 2: Update active copy and current documentation**

Use “Manager” for the application role and “Manager or Group Owner” for manual Grab handoff and missed-deadline resolution. Preserve explicit historical descriptions of completed V1-05 Organizer behavior in `context/history/`.

- [ ] **Step 3: Re-run the active scan**

Expected: no active application source or current product document uses Organizer. The new migration may mention the old string only as the value being renamed.

- [ ] **Step 4: Run domain, contract, web, and mobile tests**

```bash
npm run test:unit
npm run test:mobile
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Update the tracker and commit**

```bash
git add packages apps context
git commit -m "docs: complete Manager terminology cutover"
```

---

### Task 11: Run provider-backed migration and transaction verification

**External gate:** This task contacts the existing development Neon branch. It must not target production and must not print credential values.

- [ ] **Step 1: Report the external test action**

Tell the user: provider tests will connect to the configured development Neon migration URL, create isolated temporary schemas or rollback-only transactions, and leave no persistent product rows.

- [ ] **Step 2: Confirm variable names exist without printing values**

Use a shell check that reports only present/missing for `DATABASE_MIGRATION_URL` and `DATABASE_URL` after loading the ignored `apps/web/.env.local`.

- [ ] **Step 3: Run schema migration tests sequentially**

```bash
RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts \
  packages/db/src/schema/schema.provider.integration.test.ts
```

Expected: PASS; the test creates an isolated schema, applies all four migrations, checks multi-group/owner/Manager invariants, and rolls back/drops isolated state.

- [ ] **Step 4: Run remaining provider tests sequentially**

```bash
npm run test:providers
```

Expected: PASS with no persistent product-data changes.

- [ ] **Step 5: Record exact provider evidence without secrets**

Update `context/progress-tracker.md` with test file counts, test counts, migration journal count, and the development target label only. Never record URLs, passwords, tokens, or connection strings.

- [ ] **Step 6: Commit provider-test corrections and evidence**

```bash
git add packages apps context/progress-tracker.md
git commit -m "test: verify multi-group migration against Neon"
```

---

### Task 12: Full verification, documentation synchronization, and persistent-migration handoff

**Files:**

- Modify: `context/architecture.md`
- Modify: `context/project-structure.md`
- Modify: `context/progress-tracker.md`
- Create only after full completion: `context/history/multi-group-foundation.md`

- [ ] **Step 1: Synchronize architecture and structure**

Document that `AppIdentity` contains all group-scoped memberships and an account-wide Platform Admin flag; routes authorize the explicit requested group. Record new page-identity and group-authorization modules in `project-structure.md`.

- [ ] **Step 2: Run the full provider-free matrix**

```bash
npm ci
npm run build --workspaces --if-present
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:mobile
npm run build --workspace @ordah-please/web
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Run Android export**

From `apps/mobile/`:

```bash
npx expo export --platform android
```

Expected: export succeeds. This proves bundling, not physical-device acceptance.

- [ ] **Step 4: Run browser verification**

Verify these states against the local production build:

1. Cookie-free member route shows sign-in and no protected content.
2. Authenticated groupless user sees restaurant/Favorites access and honest Orders/Groups empty states.
3. Multi-group user sees all memberships with exact roles.
4. Manager in Group A cannot mutate Group B.
5. Cookie-free `/admin` and authenticated non-admin `/admin` render no admin shell.
6. Platform Admin still reaches Access Requests.

- [ ] **Step 5: Run Android emulator verification**

Verify Google-session restoration, groupless Home, empty Orders/Groups, multi-membership rendering, and invitation acceptance into a second group. Record that emulator verification is not a distributed-APK test.

- [ ] **Step 6: Prepare the persistent Neon handoff without applying it**

Report:

- exact persistent target label (development or production);
- new migration filename;
- preflight owner query result;
- current Drizzle journal version;
- backup/recovery boundary;
- expected brief maintenance window;
- deploy order for matching web code;
- confirmation that no private Android release requires backward compatibility.

Stop and request explicit user direction before applying the migration to persistent Neon.

- [ ] **Step 7: Commit final code and documentation state**

```bash
git add apps packages context
git commit -m "chore: verify multi-group foundation"
```

- [ ] **Step 8: Squash only after persistent acceptance**

After the persistent migration, live web acceptance, Android emulator acceptance, and user review all pass, squash the task branch to `main` with:

```text
Multi-group foundation
```

Create `context/history/multi-group-foundation.md`, mark the tracker bundle complete, verify the squash on `main`, then push. Keep the task branch as a recovery reference until the pushed squash is verified.

---

## Plan Self-Review Checklist

- Spec coverage: Tasks 1–10 cover vocabulary, schema, identity, group-scoped APIs, page authorization, and clients; Tasks 11–12 cover provider and acceptance evidence.
- Data safety: no applied migration is edited; persistent Neon is an explicit stop gate.
- Authorization safety: every group mutation carries `groupId` and checks the matching membership.
- Scope: effective overrides, suspension, group lifecycle, catalog persistence, orders, files, jobs, and notifications remain deferred.
- Type consistency: the canonical group roles are `group-owner`, `manager`, and `member`; persisted ownership remains `owner`; Platform Admin is `isPlatformAdmin`.
- Completion honesty: builds/exports do not count as production or physical-device acceptance.
