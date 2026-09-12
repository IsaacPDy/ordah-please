# Web Performance Streaming and Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show useful protected loading feedback immediately and reuse only safe shared catalog data across requests.

**Architecture:** Put authentication-dependent shell content behind focused Suspense boundaries and add route loading fallbacks for dynamic pages. Cache published catalog functions with explicit tags and invalidate those tags only after successful catalog mutations; private data remains uncached.

**Tech Stack:** React 19 Suspense, Next.js 16 Cache Components, Next.js cache tags, TypeScript, Vitest, Testing Library, Playwright browser verification

---

## File structure

- Modify `apps/web/next.config.ts`: enable Cache Components.
- Create `apps/web/src/features/catalog/catalog-cache.ts`: cache published catalog reads only.
- Modify catalog read callers and mutation handlers to use/invalidate tags.
- Create `apps/web/app/components/page-loading.tsx`: shared accessible skeleton primitives.
- Create `apps/web/app/(member)/loading.tsx` and `apps/web/app/admin/loading.tsx`: route feedback.
- Modify member/admin layouts to isolate uncached identity work behind Suspense.
- Update shell, route, catalog handler, and loading tests.
- Update architecture/design/project documentation and completion evidence.

### Task 1: Add accessible route loading states

**Files:**

- Create: `apps/web/app/components/page-loading.tsx`
- Create: `apps/web/app/(member)/loading.tsx`
- Create: `apps/web/app/admin/loading.tsx`
- Modify: `apps/web/app/globals.css`
- Test: `apps/web/app/components/page-loading.test.tsx`

- [x] **Step 1: Write the failing loading-state test**

```ts
it("announces loading and renders stable card placeholders", () => {
  render(<MemberPageLoading />);
  expect(screen.getByRole("status").textContent).toContain("Loading page");
  expect(screen.getAllByTestId("loading-card")).toHaveLength(3);
});
```

Also assert the admin loading component renders its table-shaped fallback with one status announcement.

- [x] **Step 2: Run and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/app/components/page-loading.test.tsx`

Expected: FAIL because loading components do not exist.

- [x] **Step 3: Implement loading primitives and route files**

Create small server components with simple purpose comments:

```tsx
/** Shows stable card shapes while a member route finishes protected reads. */
export function MemberPageLoading() {
  return (
    <div className="member-page page-loading" role="status">
      <span className="sr-only">Loading page…</span>
      <div className="loading-line loading-line--title" />
      {[0, 1, 2].map((index) => (
        <div className="loading-card" data-testid="loading-card" key={index} />
      ))}
    </div>
  );
}
```

Use existing canvas/surface/border tokens, a restrained opacity pulse, and `prefers-reduced-motion: reduce` to disable animation. Route `loading.tsx` files return the appropriate component.

- [x] **Step 4: Run and verify GREEN**

Run: `npx vitest run --config vitest.config.ts apps/web/app/components/page-loading.test.tsx`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/app/components/page-loading.tsx apps/web/app/components/page-loading.test.tsx apps/web/app/'(member)'/loading.tsx apps/web/app/admin/loading.tsx apps/web/app/globals.css
git commit -m "Add accessible route loading states"
```

### Task 2: Stream identity-dependent shell content safely

**Files:**

- Modify: `apps/web/app/(member)/layout.tsx`
- Modify: `apps/web/app/admin/layout.tsx`
- Modify: `apps/web/app/components/member-access-state.tsx`
- Test: `apps/web/app/components/member-access-state.test.tsx`
- Test: `apps/web/app/shell-navigation.test.tsx`

- [x] **Step 1: Write failing shell-fallback tests**

Use a deferred identity promise and render the layout through a Suspense-capable test. Assert the brand/frame fallback is emitted before identity resolves and protected child text is absent. After resolving authenticated identity, assert profile/navigation/child content appears.

```ts
expect(initialHtml).toContain("ordah please");
expect(initialHtml).toContain("Checking your access");
expect(initialHtml).not.toContain("protected child");
```

- [x] **Step 2: Run and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/app/components/member-access-state.test.tsx apps/web/app/shell-navigation.test.tsx`

Expected: FAIL because the whole layout awaits identity before returning a shell.

- [x] **Step 3: Extract async authenticated shell bodies**

Keep the exported layouts synchronous. They render stable outer markup and a `<Suspense fallback={<ShellAccessLoading />}>`. Move `getCurrentServerPageIdentity()` and `MemberPageAccessView`/`AdminPageAccessView` into async child components inside that boundary.

The fallback contains brand, inert header placeholders, and `role="status"` text. It never renders `children`. The authenticated child preserves the existing access result behavior and is the only component that receives protected children.

- [x] **Step 4: Run tests and commit**

Run: `npx vitest run --config vitest.config.ts apps/web/app/components/member-access-state.test.tsx apps/web/app/shell-navigation.test.tsx`

Expected: PASS with protected content absent from fallbacks.

```bash
git add apps/web/app/'(member)'/layout.tsx apps/web/app/admin/layout.tsx apps/web/app/components/member-access-state.tsx apps/web/app/components/member-access-state.test.tsx apps/web/app/shell-navigation.test.tsx
git commit -m "Stream protected web shells safely"
```

### Task 3: Cache and invalidate only shared catalog data

**Files:**

- Modify: `apps/web/next.config.ts`
- Create: `apps/web/src/features/catalog/catalog-cache.ts`
- Create: `apps/web/src/features/catalog/catalog-cache.test.ts`
- Modify: `apps/web/app/(member)/page.tsx`
- Modify: `apps/web/app/(member)/restaurants/[restaurantId]/page.tsx`
- Modify: `apps/web/app/(member)/orders/new/page.tsx`
- Modify: `apps/web/app/admin/catalog/page.tsx`
- Modify: `apps/web/src/features/catalog/csv-upload-handler.ts`
- Modify: `apps/web/src/features/catalog/csv-upload-handler.test.ts`
- Modify: `apps/web/src/features/catalog/restaurant-route-handlers.ts`
- Modify: `apps/web/src/features/catalog/restaurant-route-handlers.test.ts`

- [x] **Step 1: Write failing cache-boundary tests**

Mock Next cache functions and assert catalog tags are applied while identity/order modules are never imported by the cache module:

```ts
await listCachedRestaurantPreviews(6);
expect(cacheTag).toHaveBeenCalledWith("published-catalog");
expect(cacheLife).toHaveBeenCalledWith("hours");
expect(listRestaurantPreviews).toHaveBeenCalledWith({ limit: 6 });
```

Add handler tests with an injected `invalidateCatalog` spy. Assert invalidation is absent on failed writes and called after successful writes:

```ts
expect(invalidateCatalog).toHaveBeenCalledWith(restaurantId);
```

- [x] **Step 2: Run and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/catalog/catalog-cache.test.ts apps/web/src/features/catalog/restaurant-route-handlers.test.ts`

Expected: FAIL because the cache module and invalidation calls are missing.

- [x] **Step 3: Enable Cache Components and implement cached functions**

Set:

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,
};
```

Create cached functions that import only `catalogRuntime`, plus one invalidation helper used only by runtime mutation wiring:

```ts
export async function listCachedRestaurantPreviews(limit: number) {
  "use cache";
  cacheLife("hours");
  cacheTag("published-catalog");
  return catalogRuntime.catalog.listRestaurantPreviews({ limit });
}

export async function getCachedRestaurantDetail(restaurantId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("published-catalog", `restaurant-${restaurantId}`);
  return catalogRuntime.catalog.getRestaurantDetail(restaurantId);
}

/** Expires shared catalog reads after a committed import or edit. */
export function invalidatePublishedCatalog(restaurantId?: string): void {
  revalidateTag("published-catalog", { expire: 0 });
  if (restaurantId !== undefined) {
    revalidateTag(`restaurant-${restaurantId}`, { expire: 0 });
  }
}
```

Replace page catalog reads with these functions. Do not move identity, permissions, group, favorite, or order reads into this module.

- [x] **Step 4: Invalidate tags after committed mutations**

Add an `invalidateCatalog` dependency to the CSV import, restaurant patch, and menu-item patch handler factories. Call it after the repository promise resolves successfully and before returning the success response. Runtime handler wiring passes `invalidatePublishedCatalog`; unit tests pass a spy.

Use these calls:

```ts
revalidateTag("published-catalog", { expire: 0 });
if (restaurantId !== undefined) {
  revalidateTag(`restaurant-${restaurantId}`, { expire: 0 });
}
```

The CSV import passes no restaurant ID because it may affect several restaurants. The restaurant patch passes its restaurant ID. The item patch passes no ID because the current repository result does not expose the parent restaurant. Failed validation, authorization, or repository writes must not invalidate.

- [x] **Step 5: Run focused tests and production build**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/catalog apps/web/app/api/admin/catalog`

Expected: PASS.

Run: `npm run build:web`

Expected: PASS with Cache Components enabled and no uncached/private-data build error.

- [ ] **Step 6: Commit**

```bash
git add apps/web/next.config.ts apps/web/src/features/catalog/catalog-cache.ts apps/web/src/features/catalog/catalog-cache.test.ts apps/web/app/'(member)'/page.tsx apps/web/app/'(member)'/restaurants/'[restaurantId]'/page.tsx apps/web/app/'(member)'/orders/new/page.tsx apps/web/app/admin/catalog/page.tsx apps/web/src/features/catalog/csv-upload-handler.ts apps/web/src/features/catalog/csv-upload-handler.test.ts apps/web/src/features/catalog/restaurant-route-handlers.ts apps/web/src/features/catalog/restaurant-route-handlers.test.ts
git commit -m "Cache shared published catalog reads"
```

### Task 4: Full verification, timings, and documentation

**Files:**

- Modify: `context/design-structure.md`
- Modify: `context/architecture.md`
- Modify: `context/project-structure.md`
- Modify: `context/progress-tracker.md`
- Create: `context/history/v1-08.md`

- [x] **Step 1: Run all repository gates**

Run: `npm run test:unit`

Expected: all provider-free Vitest tests pass.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS with no new warnings.

Run: `npm run build:web`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [x] **Step 2: Run provider-backed verification**

Run: `RUN_PROVIDER_TESTS=1 npm run test:providers`

Expected: new catalog, group, user, and order repository tests pass in an isolated development-Neon schema. Attribute any unrelated pre-existing failure with a matching `main` result.

- [x] **Step 3: Perform local browser acceptance**

Run: `npm run dev:web`

Verify Home, Orders initial history, history expansion/retry/load-more, Favorites, Groups, restaurant detail, New Order, Admin Users, Admin Groups, and Admin Catalog. Confirm the shell/loading state appears before delayed protected content and no browser console errors are introduced.

- [x] **Step 4: Deploy the reviewed branch and compare production**

Deploy through the existing Vercel workflow. With the same signed-in account and browser used for the baseline, measure three warm navigations per target route and one cold reload. Record medians for Home, Orders, Favorites, Groups, restaurant detail, New Order, Admin Users, Admin Groups, and Admin Catalog.

Acceptance requires at least 50% lower median on Home/Orders/Favorites/Groups or explicit provider evidence explaining a missed absolute target, plus visible feedback within 300 ms.

- [ ] **Step 5: Verify authorization with real roles**

Use Owner, Manager, Member, and Platform Admin accounts. Confirm history detail visibility, removed-member denial, admin denial, catalog freshness after a successful edit, and no protected data in loading fallbacks.

- [x] **Step 6: Update context and completion evidence**

Document progressive lists/loading in `design-structure.md`, cache/invalidation in `architecture.md`, new modules/routes in `project-structure.md`, exact test/timing evidence in `history/v1-08.md`, and task status in `progress-tracker.md`.

- [x] **Step 7: Commit final documentation**

```bash
git add context/design-structure.md context/architecture.md context/project-structure.md context/progress-tracker.md context/history/v1-08.md
git commit -m "Document V1-08 performance verification"
```

- [ ] **Step 8: Squash-merge only after acceptance**

Follow the repository workflow: create recovery evidence, squash-merge to `main` with exact title `V1-08 Progressive web performance`, verify the tree matches the reviewed branch, push without force, and delete the task branch only after remote verification.
