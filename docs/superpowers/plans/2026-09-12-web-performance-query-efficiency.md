# Web Performance Query Efficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unbounded catalog reads, repeated per-row group/admin queries, and avoidable sequential page reads.

**Architecture:** Keep authorization and rendering behavior unchanged while adding bounded and batched repository reads. Runtime adapters compose those reads into the existing view models, and page loaders start independent work concurrently.

**Tech Stack:** TypeScript, React 19 Server Components, Next.js 16 App Router, Drizzle ORM, Neon PostgreSQL, Vitest

---

## File structure

- Modify `packages/db/src/repositories/catalog.ts`: add bounded restaurant previews selected in one query.
- Modify `packages/db/src/repositories/group-access.ts`: add batched group/member reads.
- Modify `packages/db/src/repositories/repositories.provider.integration.test.ts`: prove bounded and batched reads against Neon.
- Modify `apps/web/src/features/groups/group-runtime.ts`: replace per-membership and per-group loops with batched reads.
- Modify `apps/web/src/features/users/users-runtime.ts`: resolve group names from one batched read.
- Create `apps/web/src/features/groups/group-runtime.test.ts`: prove group runtime query counts.
- Create `apps/web/src/features/users/users-runtime.test.ts`: prove user runtime query counts.
- Modify `apps/web/app/(member)/page.tsx`: request six previews and overlap independent work.
- Modify `apps/web/app/(member)/restaurants/[restaurantId]/page.tsx`: overlap identity/detail reads and fetch branch-only favorites.
- Modify `apps/web/app/(member)/orders/new/page.tsx`: include group summary in the existing parallel read.
- Modify `apps/web/app/admin/catalog/page.tsx`: request a bounded first page.
- Modify focused page/runtime tests and project context files named below.

### Task 1: Bounded one-query restaurant previews

**Files:**

- Modify: `packages/db/src/repositories/catalog.ts`
- Test: `packages/db/src/repositories/repositories.provider.integration.test.ts`

- [x] **Step 1: Write the failing provider test**

Add a test that creates three published restaurants with ordered menu images, then verifies the new read returns only two restaurants and the first non-null image per menu:

```ts
it("lists a bounded restaurant preview without returning menu rows", async () => {
  const rows = await repositories.catalog.listRestaurantPreviews({ limit: 2 });

  expect(rows).toHaveLength(2);
  expect(rows[0]).toEqual(
    expect.objectContaining({
      restaurantId: expect.any(String),
      heroImageUrl: expect.anything(),
    }),
  );
  expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
    "branchId",
    "branchName",
    "cuisines",
    "heroImageUrl",
    "restaurantId",
    "restaurantName",
  ]);
});
```

- [x] **Step 2: Run the test and verify RED**

Run: `RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts`

Expected: FAIL because `listRestaurantPreviews` does not exist.

- [x] **Step 3: Add the repository contract and single-query implementation**

Add this contract:

```ts
listRestaurantPreviews(options: Readonly<{ limit: number; offset?: number }>): Promise<
  readonly RestaurantSummaryRow[]
>;
```

Implement it with a correlated scalar subquery so PostgreSQL returns one hero URL instead of sending every item to Node:

```ts
listRestaurantPreviews: ({ limit, offset = 0 }) => {
  if (!Number.isInteger(limit) || limit < 1 || limit > 101) {
    throw new Error("Restaurant preview limit must be between 1 and 101.");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("Restaurant preview offset must be a non-negative integer.");
  }
  const heroImageUrl = sql<string | null>`(
    select ${menuItems.imageUrl}
    from ${menuItems}
    inner join ${menuCategories}
      on ${menuCategories.id} = ${menuItems.categoryId}
    where ${menuCategories.menuVersionId} = ${menuVersions.id}
      and ${menuItems.imageUrl} is not null
    order by ${menuCategories.sortOrder}, ${menuItems.sortOrder}
    limit 1
  )`;
  return database
    .select({
      restaurantId: restaurants.id,
      restaurantName: restaurants.name,
      cuisines: restaurants.cuisines,
      branchId: branches.id,
      branchName: branches.name,
      heroImageUrl,
    })
    .from(restaurants)
    .innerJoin(branches, eq(branches.restaurantId, restaurants.id))
    .innerJoin(
      menuVersions,
      and(
        eq(menuVersions.branchId, branches.id),
        eq(menuVersions.status, "published"),
      ),
    )
    .where(isNull(restaurants.archivedAt))
    .orderBy(asc(restaurants.name), asc(branches.name))
    .limit(limit)
    .offset(offset);
},
```

Import `sql` from `drizzle-orm`. Keep `listRestaurants` temporarily for unaffected callers; later tasks remove its web-page use.

- [x] **Step 4: Run the focused provider test and type check**

Run: `RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts`

Expected: PASS for the bounded preview test.

Run: `npm run typecheck --workspace @ordah-please/db`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/db/src/repositories/catalog.ts packages/db/src/repositories/repositories.provider.integration.test.ts
git commit -m "Optimize restaurant preview reads"
```

### Task 2: Batch group summaries and members

**Files:**

- Modify: `packages/db/src/repositories/group-access.ts`
- Modify: `apps/web/src/features/groups/group-runtime.ts`
- Modify: `apps/web/src/features/users/users-runtime.ts`
- Test: `packages/db/src/repositories/repositories.provider.integration.test.ts`
- Create: `apps/web/src/features/groups/group-runtime.test.ts`
- Create: `apps/web/src/features/users/users-runtime.test.ts`

- [x] **Step 1: Write failing tests for the batched contracts**

Add repository expectations for empty input and multiple groups:

```ts
await expect(
  repositories.groupAccess.listGroupSummaries([]),
).resolves.toEqual([]);
await expect(
  repositories.groupAccess.listActiveMembersForGroups([firstGroupId, secondGroupId]),
).resolves.toEqual(
  expect.arrayContaining([
    expect.objectContaining({ groupId: firstGroupId }),
    expect.objectContaining({ groupId: secondGroupId }),
  ]),
);
```

Export `listViewerGroupSummariesWith(groupAccess, memberships)` and `listUsersForAdminWith(repositories)` as dependency-injected functions. Runtime tests call those functions with spies and assert each batched method is called once and `findGroupSummary`/`listActiveMembers` are not called. The public runtime objects delegate to these functions with pooled repositories.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/groups/group-runtime.test.ts apps/web/src/features/users/users-runtime.test.ts`

Expected: FAIL because the batched methods do not exist.

- [x] **Step 3: Implement batched repository reads**

Add these types and methods to `GroupAccessRepository`:

```ts
export interface GroupMemberBatchRow {
  readonly groupId: string;
  readonly displayName: string;
  readonly role: typeof memberships.$inferSelect.role;
  readonly userId: string;
}

listGroupSummaries(groupIds: readonly string[]): Promise<readonly GroupSummaryRow[]>;
listActiveMembersForGroups(
  groupIds: readonly string[],
): Promise<readonly GroupMemberBatchRow[]>;
```

Implement empty-input guards and set-based reads:

```ts
listGroupSummaries: (groupIds) =>
  groupIds.length === 0
    ? Promise.resolve([])
    : database
        .select({
          archivedAt: groups.archivedAt,
          id: groups.id,
          name: groups.name,
          ownerUserId: groups.ownerUserId,
        })
        .from(groups)
        .where(inArray(groups.id, [...groupIds]))
        .orderBy(asc(groups.name)),

listActiveMembersForGroups: (groupIds) =>
  groupIds.length === 0
    ? Promise.resolve([])
    : database
        .select({
          groupId: memberships.groupId,
          displayName: users.displayName,
          role: memberships.role,
          userId: users.id,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(
            inArray(memberships.groupId, [...groupIds]),
            isNull(memberships.removedAt),
          ),
        )
        .orderBy(asc(memberships.groupId), asc(users.displayName)),
```

Import `inArray` from `drizzle-orm`.

- [x] **Step 4: Replace runtime N+1 loops**

In `listViewerGroupSummaries`, load summaries and members once with `Promise.all`, map both collections by group ID, and preserve membership order:

```ts
const groupIds = memberships.map((membership) => membership.groupId);
const [groups, members] = await Promise.all([
  groupAccess.listGroupSummaries(groupIds),
  groupAccess.listActiveMembersForGroups(groupIds),
]);
const groupById = new Map(groups.map((group) => [group.id, group]));
const membersByGroup = new Map<string, typeof members>();
for (const member of members) {
  membersByGroup.set(member.groupId, [
    ...(membersByGroup.get(member.groupId) ?? []),
    member,
  ]);
}
return memberships.map((membership) => {
  const groupMembers = membersByGroup.get(membership.groupId) ?? [];
  return {
    groupId: membership.groupId,
    name: groupById.get(membership.groupId)?.name ?? "Group",
    role: membership.role,
    memberCount: groupMembers.length,
    memberPreviews: groupMembers.slice(0, 3).map(({ displayName }) => ({
      displayName,
    })),
  };
});
```

In `listUsersForAdmin`, collect unique membership group IDs, call `listGroupSummaries` once, then resolve names from a `Map` without per-membership queries.

- [x] **Step 5: Run focused tests and commit**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/groups/group-runtime.test.ts apps/web/src/features/users/users-runtime.test.ts`

Expected: PASS.

```bash
git add packages/db/src/repositories/group-access.ts packages/db/src/repositories/repositories.provider.integration.test.ts apps/web/src/features/groups/group-runtime.ts apps/web/src/features/groups/group-runtime.test.ts apps/web/src/features/users/users-runtime.ts apps/web/src/features/users/users-runtime.test.ts
git commit -m "Batch group and admin membership reads"
```

### Task 3: Replace per-group Admin Groups reads

**Files:**

- Modify: `apps/web/src/features/groups/group-runtime.ts`
- Test: `apps/web/app/admin/groups/page.test.tsx`

- [x] **Step 1: Write the failing runtime/page test**

Expose the runtime repository composition through a small exported loader and test that one group summary call and one member batch call supply every row:

```ts
expect(groupAccess.listGroupSummaries).toHaveBeenCalledTimes(1);
expect(groupAccess.listActiveMembersForGroups).toHaveBeenCalledTimes(1);
expect(groupAccess.listActiveMembers).not.toHaveBeenCalled();
expect(result).toEqual([
  expect.objectContaining({
    groupId: "group-1",
    ownerDisplayName: "Alice",
    memberCount: 3,
  }),
]);
```

- [x] **Step 2: Run and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/app/admin/groups/page.test.tsx`

Expected: FAIL because `listAllGroupsForAdmin` still calls `listActiveMembers` per group.

- [x] **Step 3: Implement the batched composition**

After `listAllGroupRows`, call `listActiveMembersForGroups(allGroups.map(({ id }) => id))` once, group the rows by `groupId`, and map owner/count fields. Preserve alphabetical group order and zero-member groups.

```ts
const allGroups = await listAllGroupRows(getRuntimeDatabase());
const members = await groupAccess.listActiveMembersForGroups(
  allGroups.map((group) => group.id),
);
const membersByGroup = new Map<string, typeof members>();
for (const member of members) {
  membersByGroup.set(member.groupId, [
    ...(membersByGroup.get(member.groupId) ?? []),
    member,
  ]);
}
return allGroups.map((group) => {
  const groupMembers = membersByGroup.get(group.id) ?? [];
  return {
    groupId: group.id,
    name: group.name,
    ownerDisplayName:
      groupMembers.find((member) => member.role === "owner")?.displayName ?? null,
    memberCount: groupMembers.length,
  };
});
```

- [x] **Step 4: Run and commit**

Run: `npx vitest run --config vitest.config.ts apps/web/app/admin/groups/page.test.tsx`

Expected: PASS.

```bash
git add apps/web/src/features/groups/group-runtime.ts apps/web/app/admin/groups/page.test.tsx
git commit -m "Batch admin group membership reads"
```

### Task 4: Start independent page reads together

**Files:**

- Modify: `apps/web/app/(member)/page.tsx`
- Modify: `apps/web/app/(member)/restaurants/[restaurantId]/page.tsx`
- Modify: `apps/web/app/(member)/orders/new/page.tsx`
- Modify: `apps/web/app/admin/catalog/page.tsx`
- Test: `apps/web/app/(member)/home-data.test.ts`
- Test: `apps/web/app/(member)/restaurants/[restaurantId]/restaurant-detail.test.tsx`
- Test: `apps/web/app/(member)/orders/new/new-order-wizard.test.tsx`
- Test: `apps/web/app/admin/catalog/catalog-grid.test.tsx`

- [x] **Step 1: Add a failing Home loader test**

Extract `loadMemberHomeData(identity, dependencies)` into `apps/web/app/(member)/home-data.ts`. Use deferred promises and assert both dependencies are called before either resolves:

```ts
const catalog = deferred<readonly RestaurantSummaryRow[]>();
const orders = deferred<Awaited<ReturnType<typeof listOrderSummaries>>>();
const dependencies = {
  listOrderSummaries: vi.fn(() => orders.promise),
  listRestaurantPreviews: vi.fn(() => catalog.promise),
};
const resultPromise = loadMemberHomeData(identity, {
  listOrderSummaries: dependencies.listOrderSummaries,
  listRestaurantPreviews: dependencies.listRestaurantPreviews,
});
expect(dependencies.listRestaurantPreviews).toHaveBeenCalledWith({ limit: 6 });
expect(dependencies.listOrderSummaries).toHaveBeenCalledWith(identity);
catalog.resolve([]);
orders.resolve({ active: [], history: [] });
await expect(resultPromise).resolves.toMatchObject({ restaurants: [] });
```

- [x] **Step 2: Run and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/app/'(member)'/home-data.test.ts`

Expected: FAIL because `home-data.ts` does not exist.

- [x] **Step 3: Implement minimal concurrent loaders and bounded calls**

Implement Home with `Promise.all`, pass `{ limit: 6 }`, and call the current order-summary service. Progressive Order History Task 3 will replace this with the active-only summary contract.

For restaurant detail, start these promises together:

```ts
const identityPromise = getCurrentServerPageIdentity();
const detailPromise = catalogRuntime.catalog.getRestaurantDetail(restaurantId);
const [identityResult, detail] = await Promise.all([
  identityPromise,
  detailPromise,
]);
```

After `detail` exists, call `favorites.listForUserAndBranch(identity.userId, detail.branchId)` rather than reading favorites from unrelated branches.

For New Order, include `findGroupSummary(groupId)` in the existing `Promise.all`.

For Admin Catalog, accept `searchParams.page`, validate it as a positive integer, request 51 rows at offset `(page - 1) * 50`, render the first 50, and show Previous/Next links when applicable. This keeps every restaurant reachable without an unlimited query.

- [x] **Step 4: Run focused tests**

Run: `npx vitest run --config vitest.config.ts apps/web/app/'(member)'/home-data.test.ts apps/web/app/'(member)'/restaurants/'[restaurantId]'/restaurant-detail.test.tsx apps/web/app/'(member)'/orders/new/new-order-wizard.test.tsx apps/web/app/admin/catalog/catalog-grid.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/'(member)'/page.tsx apps/web/app/'(member)'/home-data.ts apps/web/app/'(member)'/home-data.test.ts apps/web/app/'(member)'/restaurants/'[restaurantId]'/page.tsx apps/web/app/'(member)'/restaurants/'[restaurantId]'/restaurant-detail.test.tsx apps/web/app/'(member)'/orders/new/page.tsx apps/web/app/'(member)'/orders/new/new-order-wizard.test.tsx apps/web/app/admin/catalog/page.tsx apps/web/app/admin/catalog/catalog-grid.test.tsx
git commit -m "Parallelize bounded web page reads"
```

### Task 5: Verify the query-efficiency slice

**Files:**

- Modify: `context/progress-tracker.md`

- [x] **Step 1: Run focused and provider checks**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/groups apps/web/src/features/users apps/web/app/'(member)' apps/web/app/admin/groups apps/web/app/admin/catalog`

Expected: PASS.

Run: `RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts`

Expected: PASS.

- [x] **Step 2: Run static gates**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS with no new warnings.

- [ ] **Step 3: Update the tracker and commit**

Record completed query-efficiency work and exact commands in `context/progress-tracker.md`.

```bash
git add context/progress-tracker.md
git commit -m "Record query performance verification"
```
