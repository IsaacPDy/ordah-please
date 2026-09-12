# Progressive Order History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render active orders and ten compact terminal summaries first, then fetch authorized history details and later pages only when requested.

**Architecture:** Split order list persistence into bounded active/terminal reads and a one-order history-detail read. Server-render the first summary page, then use a small client controller for expansion and cursor pagination through authenticated route handlers.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Drizzle ORM, Neon PostgreSQL, Vitest, Testing Library

---

## File structure

- Modify `packages/db/src/repositories/orders.ts`: add bounded summary and terminal-detail reads.
- Modify `apps/web/src/features/orders/orders-service.ts`: define summary-page/cursor/detail behavior and authorization.
- Modify `apps/web/src/features/orders/orders-runtime.ts`: expose the new reads.
- Modify `apps/web/src/features/orders/orders-route-handlers.ts`: add authenticated GET handlers.
- Create `apps/web/app/api/orders/history/route.ts`: load another summary page.
- Create `apps/web/app/api/orders/[orderId]/history/route.ts`: load one authorized terminal detail.
- Modify `apps/web/app/(member)/orders/page.tsx`: render the initial compact page.
- Modify `apps/web/app/(member)/home-data.ts`: switch Home to the active-only summary contract.
- Create `apps/web/app/(member)/orders/order-history-list.tsx`: expand and paginate on demand.
- Update focused service, route, repository, and component tests.

### Task 1: Define stable history cursors and compact service contracts

**Files:**

- Modify: `apps/web/src/features/orders/orders-service.ts`
- Test: `apps/web/src/features/orders/orders-service.test.ts`

- [x] **Step 1: Write failing cursor tests**

Add tests for a round trip and malformed input:

```ts
it("round-trips a stable terminal history cursor", () => {
  const encoded = encodeOrderHistoryCursor({
    sortTime: new Date("2026-09-10T16:30:00.000Z"),
    orderId: "11111111-1111-4111-8111-111111111111",
  });
  expect(parseOrderHistoryCursor(encoded)).toEqual({
    sortTime: new Date("2026-09-10T16:30:00.000Z"),
    orderId: "11111111-1111-4111-8111-111111111111",
  });
});

it("rejects a malformed terminal history cursor", () => {
  expect(() => parseOrderHistoryCursor("not-a-cursor")).toThrowError(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
});
```

- [x] **Step 2: Run and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-service.test.ts`

Expected: FAIL because cursor functions are missing.

- [x] **Step 3: Implement the cursor and view types**

Add exported types:

```ts
export interface OrderHistoryCursor {
  readonly sortTime: Date;
  readonly orderId: string;
}

export interface CompactOrderSummary extends Omit<OrderSummary, "participants"> {
  readonly participants: readonly [];
}

export interface OrderSummaryPage {
  readonly active: readonly CompactOrderSummary[];
  readonly history: readonly CompactOrderSummary[];
  readonly nextCursor: string | null;
}

export interface OrderHistoryDetail {
  readonly orderId: string;
  readonly participants: readonly HistoryParticipantSummary[];
}
```

Encode UTF-8 JSON with URL-safe base64 and validate both fields. Throw `PublicApiError("INVALID_INPUT", "History cursor is invalid.")` for decoding, date, or ID failures.

- [x] **Step 4: Run and verify GREEN**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-service.test.ts`

Expected: PASS for cursor tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/orders/orders-service.ts apps/web/src/features/orders/orders-service.test.ts
git commit -m "Define progressive order history contracts"
```

### Task 2: Add bounded order repository reads

**Files:**

- Modify: `packages/db/src/repositories/orders.ts`
- Test: `packages/db/src/repositories/repositories.provider.integration.test.ts`

- [x] **Step 1: Write failing provider tests**

Create more than ten terminal orders, then assert:

```ts
const first = await repositories.orders.listTerminalVisibleForUser(userId, {
  cursor: null,
  limit: 10,
});
expect(first.rows).toHaveLength(10);
expect(first.nextCursorRow).toBeDefined();
expect(first.rows.every((row) => !("participants" in row))).toBe(true);
```

Also verify `listActiveVisibleForUser` returns active rows with participants and excludes terminal rows.

- [x] **Step 2: Run and verify RED**

Run: `RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts`

Expected: FAIL because the repository methods are missing.

- [x] **Step 3: Add repository types and methods**

Add:

```ts
export type TerminalOrderSummaryRow = Omit<OrderListItemRow, "participants"> & {
  readonly participantCount: number;
};

listActiveVisibleForUser(userId: string): Promise<readonly OrderListItemRow[]>;
listTerminalVisibleForUser(
  userId: string,
  options: Readonly<{
    cursor: Readonly<{ sortTime: Date; orderId: string }> | null;
    limit: number;
  }>,
): Promise<Readonly<{
  rows: readonly TerminalOrderSummaryRow[];
  nextCursorRow: TerminalOrderSummaryRow | null;
}>>;
```

Extract the existing visibility predicate into a local `visibleOrderPredicate(userId)` helper. The terminal query selects scalar order/group fields plus a participant-count correlated subquery, filters to `ordered`/`cancelled`, applies tuple-like cursor ordering on `coalesce(completed_at, created_at)` and `orders.id`, orders descending, and reads `limit + 1`. Return the first `limit` rows. When the extra row exists, return the last included row as `nextCursorRow`; never use the extra row as the cursor because that would skip it on the next page.

The active query reuses the visibility predicate, filters out terminal states, and performs one second batched participant query for only the returned active order IDs.

- [x] **Step 4: Run focused provider tests and type check**

Run: `RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts`

Expected: PASS.

Run: `npm run typecheck --workspace @ordah-please/db`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/orders.ts packages/db/src/repositories/repositories.provider.integration.test.ts
git commit -m "Add bounded order summary reads"
```

### Task 3: Implement summary-page and authorized detail services

**Files:**

- Modify: `apps/web/src/features/orders/orders-service.ts`
- Modify: `apps/web/src/features/orders/orders-runtime.ts`
- Test: `apps/web/src/features/orders/orders-service.test.ts`

- [x] **Step 1: Write failing service tests**

Test the initial page requests ten history rows, emits a cursor, and does not request order lines:

```ts
const result = await listOrderSummaryPage(
  { cursor: null, identity, limit: 10 },
  { orders },
);
expect(orders.listActiveVisibleForUser).toHaveBeenCalledWith(identity.userId);
expect(orders.listTerminalVisibleForUser).toHaveBeenCalledWith(identity.userId, {
  cursor: null,
  limit: 10,
});
expect(orders.listOrderLinesForOrders).not.toHaveBeenCalled();
expect(result.nextCursor).toEqual(expect.any(String));
```

Test history detail for Owner, Manager, Member, removed Member, non-terminal order, and missing order. Assert Members receive only their own participant row.

- [x] **Step 2: Run and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-service.test.ts`

Expected: FAIL because the service functions are missing.

- [x] **Step 3: Implement the service functions**

Add:

```ts
export async function listOrderSummaryPage(
  command: Readonly<{
    cursor: string | null;
    identity: AppIdentity;
    limit: number;
  }>,
  repositories: Pick<OrdersServiceRepositories, "orders">,
): Promise<OrderSummaryPage>;

export async function loadOrderHistoryDetail(
  command: Readonly<{ identity: AppIdentity; orderId: string }>,
  repositories: Pick<OrdersServiceRepositories, "orders">,
): Promise<OrderHistoryDetail>;

export async function listActiveOrderSummaries(
  command: Readonly<{ identity: AppIdentity }>,
  repositories: Pick<OrdersServiceRepositories, "orders">,
): Promise<readonly CompactOrderSummary[]>;
```

Validate `limit` as an integer from 1 through 25. Map active participants only to response counts; map terminal summaries with `participants: []`. For detail, call `findOrderDetail`, require `ordered` or `cancelled`, reuse `canViewGroupHistory`, and then call `listOrderLines(orderId)`. Filter participants before joining lines so unauthorized rows never enter the response object.

Expose all three functions from `ordersRuntime` using the existing pooled repository.

Update `apps/web/app/(member)/home-data.ts` to call `listActiveOrderSummaries`. This prevents Home from issuing any terminal-history query after the query-efficiency plan.

- [x] **Step 4: Run and verify GREEN**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-service.test.ts apps/web/src/features/orders/orders-runtime.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/orders/orders-service.ts apps/web/src/features/orders/orders-service.test.ts apps/web/src/features/orders/orders-runtime.ts apps/web/app/'(member)'/home-data.ts apps/web/app/'(member)'/home-data.test.ts
git commit -m "Load compact order pages and authorized history details"
```

### Task 4: Add authenticated history GET routes

**Files:**

- Modify: `apps/web/src/features/orders/orders-route-handlers.ts`
- Test: `apps/web/src/features/orders/orders-route-handlers.test.ts`
- Create: `apps/web/app/api/orders/history/route.ts`
- Create: `apps/web/app/api/orders/[orderId]/history/route.ts`

- [x] **Step 1: Write failing route tests**

Cover success, malformed cursor/order ID, unauthenticated access, forbidden detail, and safe unavailable errors. The success assertion is:

```ts
expect(await response.json()).toEqual({
  data: {
    active: [],
    history: [expect.objectContaining({ orderId })],
    nextCursor: null,
  },
});
expect(listOrderSummaryPage).toHaveBeenCalledWith({
  cursor: null,
  identity,
  limit: 10,
});
```

- [x] **Step 2: Run and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-route-handlers.test.ts`

Expected: FAIL because the GET handler factories are missing.

- [x] **Step 3: Implement GET handler factories and route adapters**

Add `createOrderHistoryPageHandler` and `createOrderHistoryDetailHandler`. Both use `executeRoute`, verify the session, load current identity, and validate query/path input before calling the service. GET requests do not call the mutation-origin guard.

The page route parses `cursor` as nullable and fixes `limit` at 10. The detail route validates `orderId` through `parseOrderIdParam`. Route files contain only dependency wiring to `ordersRuntime`.

- [x] **Step 4: Run route tests and commit**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-route-handlers.test.ts apps/web/app/api/orders`

Expected: PASS.

```bash
git add apps/web/src/features/orders/orders-route-handlers.ts apps/web/src/features/orders/orders-route-handlers.test.ts apps/web/app/api/orders/history/route.ts apps/web/app/api/orders/'[orderId]'/history/route.ts
git commit -m "Expose protected progressive order history routes"
```

### Task 5: Render compact history and load details on demand

**Files:**

- Modify: `apps/web/app/(member)/orders/page.tsx`
- Create: `apps/web/app/(member)/orders/order-history-list.tsx`
- Modify: `apps/web/app/(member)/orders/order-history.test.tsx`

- [x] **Step 1: Replace the current test with failing progressive behavior tests**

Use jsdom and mock `fetch`. Assert participant data is absent initially, opening a row requests detail once, reopening uses mounted state, failures show Retry, and Load more appends rather than replaces.

```ts
fireEvent.click(screen.getByRole("button", { name: /Show order log/ }));
await waitFor(() => {
  expect(fetch).toHaveBeenCalledWith(
    `/api/orders/${orderId}/history`,
    { method: "GET" },
  );
});
expect(await screen.findByText("Fiona Santos")).toBeTruthy();
```

- [x] **Step 2: Run and verify RED**

Run: `npx vitest run --config vitest.config.ts apps/web/app/'(member)'/orders/order-history.test.tsx`

Expected: FAIL because the page currently embeds all participants and has no progressive controller.

- [x] **Step 3: Implement the client controller**

`OrderHistoryList` accepts `initialHistory` and `initialNextCursor`. Keep `history`, `nextCursor`, `detailByOrderId`, `loadingDetailId`, `detailErrorId`, `loadingMore`, and `loadMoreError` state. Fetch detail only when opening a row without cached mounted detail. Fetch the next page from `/api/orders/history?cursor=${encodeURIComponent(nextCursor)}` and append unique order IDs.

Keep the existing card summary and exact-items link. While detail loads, show `Loading order log…`; on failure show `Couldn’t load this order log.` plus Retry. Disable duplicate requests.

Change the server page to call `ordersRuntime.listOrderSummaryPage({ cursor: null, identity, limit: 10 })` and pass terminal summaries to the controller.

- [x] **Step 4: Run and verify GREEN**

Run: `npx vitest run --config vitest.config.ts apps/web/app/'(member)'/orders/order-history.test.tsx apps/web/src/features/orders/orders-service.test.ts apps/web/src/features/orders/orders-route-handlers.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/'(member)'/orders/page.tsx apps/web/app/'(member)'/orders/order-history-list.tsx apps/web/app/'(member)'/orders/order-history.test.tsx
git commit -m "Load order history details on demand"
```

### Task 6: Verify progressive order history

**Files:**

- Modify: `context/progress-tracker.md`

- [x] **Step 1: Run focused tests and provider checks**

Run: `npx vitest run --config vitest.config.ts apps/web/src/features/orders apps/web/app/'(member)'/orders apps/web/app/api/orders`

Expected: PASS.

Run: `RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts`

Expected: PASS with bounded history and role-visibility cases.

- [x] **Step 2: Run static gates**

Run: `npm run typecheck && npm run lint`

Expected: PASS with no new warnings.

- [ ] **Step 3: Update the tracker and commit**

Record query bounds, authorization coverage, and exact commands in `context/progress-tracker.md`.

```bash
git add context/progress-tracker.md
git commit -m "Record progressive history verification"
```
