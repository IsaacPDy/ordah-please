# History Order Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace anonymous PWA History counts with an expandable, role-scoped person-by-person order log and a read-only exact-item view.

**Architecture:** Keep the existing terminal `orders`, `order_participants`, and `order_lines` rows as the history source of truth. Extend the orders repository with role-aware visibility and one batched line query, let the service build and permission-filter the History read model, then render it with native `<details>` disclosure cards and reuse the existing order detail route for exact captured items.

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19 server components, Drizzle ORM, Neon PostgreSQL, Vitest, Testing Library, existing ordah please design tokens.

---

## File structure

- Modify `packages/db/src/repositories/orders.ts` — role-aware visible-order query and batched terminal-line read.
- Modify `packages/db/src/repositories/repositories.provider.integration.test.ts` — real-Postgres evidence for Manager visibility and batched line reads.
- Modify `apps/web/src/features/orders/orders-service.ts` — construct and permission-filter History participant summaries and exact detail rows.
- Modify `apps/web/src/features/orders/orders-service.test.ts` — service-level role, status, subtotal, batching, and detail-filter tests.
- Modify `apps/web/src/features/orders/orders-runtime.ts` — pass the complete viewer identity into History reads.
- Modify `apps/web/src/features/orders/order-format.ts` and `order-format.test.ts` — format completion dates in Manila time.
- Modify `apps/web/app/(member)/orders/page.tsx` — safe load state and accessible expandable History cards.
- Create `apps/web/app/(member)/orders/order-history.test.tsx` — focused server-rendered History UI and failure tests.
- Modify `apps/web/app/(member)/orders/[orderId]/page.tsx` and `order-detail.test.tsx` — terminal read-only person/item log.
- Modify `apps/web/app/shell-navigation.test.tsx` — keep the shared Orders mock compatible with the richer summary type.
- Modify `apps/web/app/globals.css` — disclosure, participant-row, subtotal, and responsive styles.
- Modify `context/architecture.md`, `context/design-structure.md`, `context/ui-context.md`, and `context/project-overview.md` — record the changed History visibility and interaction contract.
- Modify `context/progress-tracker.md` and create `context/history/history-order-log.md` — completion status and verification evidence.

No schema or migration file changes are needed. The required immutable fields already exist.

### Task 1: Make repository History reads role-aware and batched

**Files:**
- Modify: `packages/db/src/repositories/orders.ts`
- Test: `packages/db/src/repositories/repositories.provider.integration.test.ts`

- [ ] **Step 1: Write the failing Manager-visibility provider test**

Extend the existing `lists orders for participants and owners only` fixture with a second active membership whose role is `manager`, without adding that user to `order_participants`:

```ts
it("lists terminal group orders for current Managers without exposing active orders", async () => {
  const repositories = createRepositories(database);
  const fixture = await seedOrdersFixture();
  const now = new Date("2026-09-11T04:00:00.000Z");
  const created = await repositories.orders.createOrder({
    choiceMode: "global_catalog",
    deliveryAddressSnapshot: addressSnapshot,
    foodDeadline: new Date("2026-09-11T06:00:00.000Z"),
    groupId: fixture.group.id,
    initialBranchId: fixture.branch.id,
    initialRestaurantId: fixture.restaurant.id,
    managerUserId: fixture.manager.id,
    now,
    participants: [
      {
        displayName: fixture.manager.displayName,
        restaurantResponse: "responded",
        role: "manager",
        userId: fixture.manager.id,
      },
      {
        displayName: fixture.member.displayName,
        restaurantResponse: "pending",
        role: "member",
        userId: fixture.member.id,
      },
    ],
    restaurantDeadline: new Date("2026-09-11T05:00:00.000Z"),
    selected: null,
    shortlistRestaurantIds: [],
    state: "restaurant_voting",
  });
  const [viewer] = await database
    .insert(users)
    .values({ displayName: "History Manager" })
    .returning();
  if (viewer === undefined) {
    throw new Error("Expected the History Manager fixture.");
  }
  await database.insert(memberships).values({
    groupId: fixture.group.id,
    role: "manager",
    userId: viewer.id,
  });

  const activeVisible = await repositories.orders.listVisibleForUser(viewer.id);
  expect(activeVisible.map((order) => order.orderId)).not.toContain(created.id);

  await repositories.orders.setState(created.id, {
    completedAt: new Date("2026-09-11T05:00:00.000Z"),
    state: "ordered",
    updatedAt: new Date("2026-09-11T05:00:00.000Z"),
  });
  const historyVisible = await repositories.orders.listVisibleForUser(viewer.id);
  expect(historyVisible.map((order) => order.orderId)).toContain(created.id);

  await database
    .update(memberships)
    .set({ removedAt: new Date("2026-09-11T05:30:00.000Z") })
    .where(
      and(
        eq(memberships.groupId, fixture.group.id),
        eq(memberships.userId, fixture.member.id),
      ),
    );
  const removedParticipantVisible =
    await repositories.orders.listVisibleForUser(fixture.member.id);
  expect(removedParticipantVisible.map((order) => order.orderId)).not.toContain(
    created.id,
  );
});
```

Reuse the existing imported `and`, `eq`, `memberships`, and fixture builders;
do not add a competing repository-test abstraction.

- [ ] **Step 2: Run the provider test and verify RED**

Run:

```bash
RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts -t "terminal group orders for current Managers"
```

Expected: FAIL because `listVisibleForUser` does not return terminal orders to a non-participant Manager.

- [ ] **Step 3: Add a batched-line provider test**

Create two terminal orders with saved lines in the existing order fixture, then assert one repository call returns rows labeled by both order IDs:

```ts
const rows = await repositories.orders.listOrderLinesForOrders([
  firstOrderId,
  secondOrderId,
]);

expect(new Set(rows.map((row) => row.orderId))).toEqual(
  new Set([firstOrderId, secondOrderId]),
);
```

The test must also assert `listOrderLinesForOrders([])` returns `[]`, preventing Drizzle from receiving an empty `inArray`.

- [ ] **Step 4: Run the batched test and verify RED**

Run:

```bash
RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts -t "lists saved lines for multiple orders"
```

Expected: FAIL because `listOrderLinesForOrders` does not exist.

- [ ] **Step 5: Implement the minimal repository changes**

Add an order-labeled row and repository method:

```ts
export interface OrderLineForOrderRow extends OrderLineRow {
  readonly orderId: string;
}

export interface OrdersRepository {
  findById(id: string): Promise<typeof orders.$inferSelect | undefined>;
  setState(id: string, next: PersistedOrderState): Promise<typeof orders.$inferSelect>;
  createOrder(input: CreateOrderRow): Promise<{ readonly id: string }>;
  listVisibleForUser(userId: string): Promise<readonly OrderListItemRow[]>;
  findOrderDetail(orderId: string): Promise<OrderDetailRow | undefined>;
  upsertFoodResponse(input: UpsertFoodResponseInput): Promise<void>;
  clearFoodResponse(orderId: string, userId: string): Promise<void>;
  listOrderLines(orderId: string): Promise<readonly OrderLineRow[]>;
  listOrderLinesForOrders(
    orderIds: readonly string[],
  ): Promise<readonly OrderLineForOrderRow[]>;
}
```

Replace the visibility predicate inside `listVisibleForUser` with three
explicit paths: an active participant; an active Owner for any order state; or
an active Manager for terminal states only. The terminal state check must wrap
only the Manager path:

```ts
or(
  and(
    exists(
      database
        .select({ one: sql`1` })
        .from(orderParticipants)
        .where(
          and(
            eq(orderParticipants.orderId, orders.id),
            eq(orderParticipants.userId, userId),
          ),
        ),
    ),
    exists(
      database
        .select({ one: sql`1` })
        .from(memberships)
        .where(
          and(
            eq(memberships.groupId, orders.groupId),
            eq(memberships.userId, userId),
            isNull(memberships.removedAt),
          ),
        ),
    ),
  ),
  exists(
    database
      .select({ one: sql`1` })
      .from(memberships)
      .where(
        and(
          eq(memberships.groupId, orders.groupId),
          eq(memberships.userId, userId),
          eq(memberships.role, "owner"),
          isNull(memberships.removedAt),
        ),
      ),
  ),
  and(
    inArray(orders.state, ["ordered", "cancelled"]),
    exists(
      database
        .select({ one: sql`1` })
        .from(memberships)
        .where(
          and(
            eq(memberships.groupId, orders.groupId),
            eq(memberships.userId, userId),
            eq(memberships.role, "manager"),
            isNull(memberships.removedAt),
          ),
        ),
    ),
  ),
),
```

Do not grant Managers blanket visibility to active orders.

Add the batch method next to `listOrderLines`:

```ts
/** Loads immutable food lines for several orders in one database query. */
listOrderLinesForOrders: async (orderIds) =>
  orderIds.length === 0
    ? []
    : database
        .select({
          itemNameSnapshot: orderLines.itemNameSnapshot,
          lineSubtotalCentavos: orderLines.lineSubtotalCentavos,
          noteSnapshot: orderLines.noteSnapshot,
          orderId: orderLines.orderId,
          quantity: orderLines.quantity,
          sortOrder: orderLines.sortOrder,
          sourceMenuItemId: orderLines.sourceMenuItemId,
          unitPriceCentavos: orderLines.unitPriceCentavos,
          userId: orderLines.userId,
        })
        .from(orderLines)
        .where(inArray(orderLines.orderId, [...orderIds]))
        .orderBy(
          asc(orderLines.orderId),
          asc(orderLines.userId),
          asc(orderLines.sortOrder),
        ),
```

- [ ] **Step 6: Run both focused provider tests and verify GREEN**

Run:

```bash
RUN_PROVIDER_TESTS=1 npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts -t "current Managers|multiple orders"
```

Expected: both focused provider tests PASS.

- [ ] **Step 7: Commit the repository slice**

Update the tracker entry to say `Repository visibility and batch reads
complete; service and UI pending.`

```bash
git add packages/db/src/repositories/orders.ts packages/db/src/repositories/repositories.provider.integration.test.ts context/progress-tracker.md
git commit -m "feat(db): load role-visible history lines in batches"
```

### Task 2: Build the permission-filtered History read model

**Files:**
- Modify: `apps/web/src/features/orders/orders-service.ts`
- Test: `apps/web/src/features/orders/orders-service.test.ts`

- [ ] **Step 1: Extend the service mock boundary**

Add `listOrderLinesForOrders: vi.fn(() => Promise.resolve([]))` to the default mocked orders repository in `createRepositories`. This is test plumbing only; do not change production behavior yet.

- [ ] **Step 2: Write failing service tests for the complete log**

Add terminal rows with confirmed, declined, and pending participants plus multiple saved lines. Assert an Owner and a non-participant Manager receive every row:

```ts
const result = await listOrderSummaries(
  { identity: identityFor(ownerId, "group-owner") },
  repositories,
);

expect(result.history[0]?.participants).toEqual([
  {
    displayName: "Order Manager",
    foodResponse: "confirmed",
    itemCount: 2,
    subtotalCentavos: 42000,
    userId: managerId,
  },
  {
    displayName: "Order Member",
    foodResponse: "declined",
    itemCount: 0,
    subtotalCentavos: 0,
    userId: memberId,
  },
]);
```

Add a separate Manager assertion whose identity has `role: "manager"` but whose user ID is absent from the order participants.

- [ ] **Step 3: Write failing service tests for Member filtering and batching**

```ts
const result = await listOrderSummaries(
  { identity: identityFor(memberId, "member") },
  repositories,
);

expect(result.history[0]?.participants.map((person) => person.userId)).toEqual([
  memberId,
]);
expect(repositories.orders.listOrderLinesForOrders).toHaveBeenCalledTimes(1);
expect(repositories.orders.listOrderLinesForOrders).toHaveBeenCalledWith([
  orderedOrderId,
  cancelledOrderId,
]);
```

Also assert active-only results do not call `listOrderLinesForOrders` and carry
no History participant payload. Add a defense-in-depth test where the
repository returns a row for a group absent from `identity.memberships`; the
service must omit that row rather than exposing former membership History.

- [ ] **Step 4: Run the service tests and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-service.test.ts -t "History read model"
```

Expected: FAIL because the command still accepts only `userId`, line batching is absent, and `OrderSummary` has no participant breakdown.

- [ ] **Step 5: Implement the minimal History summary types and builder**

Add the explicit read model:

```ts
import type { Centavos } from "@ordah-please/domain";

export interface HistoryParticipantSummary {
  readonly displayName: string;
  readonly foodResponse: "pending" | "confirmed" | "declined" | "resolved";
  readonly itemCount: number;
  readonly subtotalCentavos: Centavos;
  readonly userId: string;
}

export interface OrderSummary {
  readonly orderId: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly state: OrderState;
  readonly restaurantName: string | null;
  readonly deadline: Date | null;
  readonly participantsVoted: number;
  readonly participantsTotal: number;
  readonly completedAt: Date | null;
  readonly participants: readonly HistoryParticipantSummary[];
}

/** Returns whether the viewer may inspect every person's terminal-order log. */
function canViewGroupHistory(identity: AppIdentity, groupId: string): boolean {
  const role = identity.memberships.find(
    (membership) => membership.groupId === groupId,
  )?.role;
  return role === "group-owner" || role === "manager";
}
```

Change `listOrderSummaries` to accept `identity: AppIdentity`, call
`listVisibleForUser(identity.userId)`, discard rows whose group is absent from
`identity.memberships`, collect only terminal IDs, and invoke
`listOrderLinesForOrders` once. Group lines by `orderId` and `userId`; compute
`itemCount` as the sum of line quantities and validate every subtotal through
`parseCentavos`:

```ts
const subtotalCentavos = parseCentavos(
  lines.reduce((sum, line) => sum + line.lineSubtotalCentavos, 0),
);
const visibleParticipants = canViewGroupHistory(command.identity, row.groupId)
  ? row.participants
  : row.participants.filter(
      (participant) => participant.userId === command.identity.userId,
    );
```

For active summaries, set `participants: []`. Preserve existing ordering,
deadline, response-count, and participant-count behavior exactly.

- [ ] **Step 6: Run focused and full service tests and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-service.test.ts
```

Expected: all order-service tests PASS, including overflow rejection through `parseCentavos`.

- [ ] **Step 7: Commit the service slice**

Update the tracker entry to say `Repository and History read model complete;
PWA cards and exact detail pending.`

```bash
git add apps/web/src/features/orders/orders-service.ts apps/web/src/features/orders/orders-service.test.ts context/progress-tracker.md
git commit -m "feat(orders): build role-scoped history summaries"
```

### Task 3: Pass identity through runtime and render expandable History cards

**Files:**
- Modify: `apps/web/src/features/orders/orders-runtime.ts`
- Modify: `apps/web/src/features/orders/order-format.ts`
- Test: `apps/web/src/features/orders/order-format.test.ts`
- Modify: `apps/web/app/(member)/orders/page.tsx`
- Create: `apps/web/app/(member)/orders/order-history.test.tsx`
- Modify: `apps/web/app/shell-navigation.test.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Write the failing Manila completion-date test**

```ts
it("formats History completion dates in Manila time", () => {
  expect(formatHistoryDate(new Date("2026-09-10T16:30:00.000Z"))).toBe(
    "Sep 11, 2026",
  );
});
```

Run:

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/orders/order-format.test.ts
```

Expected: FAIL because `formatHistoryDate` is missing.

- [ ] **Step 2: Implement the date formatter and verify GREEN**

```ts
/** Formats a completed-order calendar date in Philippine time. */
export function formatHistoryDate(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Manila",
    year: "numeric",
  }).format(date);
}
```

Re-run the focused format test; expected PASS.

- [ ] **Step 3: Write failing History page tests**

In the new focused test file, mock an authenticated Owner identity and a
History summary containing confirmed, declined, and pending participants.
Render `OrdersPage` to static markup and assert:

```ts
expect(html).toContain("Show order log for KFC");
expect(html).toContain("Fiona Santos");
expect(html).toContain("2 items");
expect(html).toContain("₱420.00");
expect(html).toContain("Not eating");
expect(html).toContain("No food selected");
expect(html).toContain('href="/orders/order-1"');
expect(html).toContain("View exact items");
expect(html).toContain("Sep 11, 2026");
```

Add a separate rejected-runtime test and assert the safe copy
`Couldn't load orders. Refresh this page to try again.` appears without the
thrown database message.

- [ ] **Step 4: Run the History page tests and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts apps/web/app/\(member\)/orders/order-history.test.tsx
```

Expected: FAIL because the current card renders only a participant count and lets load errors escape.

- [ ] **Step 5: Wire the complete identity through the runtime**

```ts
/** Lists active orders and permission-filtered History for one viewer. */
listOrderSummaries: (identity: Parameters<typeof listOrderSummaries>[0]["identity"]) =>
  listOrderSummaries(
    { identity },
    { orders: createRepositories(getRuntimeDatabase()).orders },
  ),
```

Change the page call from `identity.userId` to `identity`. Update the shared
shell test mock so active summaries include `participants: []`.

- [ ] **Step 6: Render native disclosure cards and safe load failure**

Load summaries in `try/catch` and render the safe retry copy on failure. Add a
small same-file `HistoryOrderCard` function with a purpose comment:

```tsx
/** Shows a compact terminal order that expands into the permitted person log. */
function HistoryOrderCard({ order }: { readonly order: OrderSummary }) {
  const restaurant = order.restaurantName ?? "Restaurant pending";
  return (
    <details className="history-card">
      <summary aria-label={`Show order log for ${restaurant}`}>
        <span>
          <span className={order.state === "ordered"
            ? "status-pill status-pill--complete"
            : "status-pill status-pill--muted"}>
            {formatStateLabel(order.state)}
          </span>
          <strong>{restaurant}</strong>
          <small>
            {order.groupName} · {order.completedAt === null
              ? "Completion date unavailable"
              : formatHistoryDate(order.completedAt)} · {order.participantsTotal} people
          </small>
        </span>
      </summary>
      <ul className="history-log">
        {order.participants.map((participant) => (
          <li key={participant.userId}>
            <span>
              <strong>{participant.displayName}</strong>
              <small>{participant.foodResponse === "declined"
                ? "Not eating"
                : participant.itemCount === 0
                  ? "No food selected"
                  : `${participant.itemCount} ${participant.itemCount === 1 ? "item" : "items"}`}</small>
            </span>
            {participant.foodResponse === "pending" && participant.itemCount === 0
              ? null
              : <strong>{formatCentavos(participant.subtotalCentavos)}</strong>}
          </li>
        ))}
      </ul>
      <Link className="history-card__detail" href={`/orders/${order.orderId}`}>
        View exact items
      </Link>
    </details>
  );
}
```

Use a plain `<details>/<summary>` pair so keyboard operation and independent
per-card state come from the browser instead of a new client state component.

- [ ] **Step 7: Add focused disclosure styles**

Replace the old `.history-card > div` rule with `.history-card summary`,
`.history-log`, `.history-log li`, and `.history-card__detail`. Use existing
CSS variables, hide only the default disclosure marker, add a visible
`summary:focus-visible` outline, and keep `.pick-line__price`/History totals
`font-variant-numeric: tabular-nums`.

```css
.history-card {
  display: block;
  overflow: hidden;
  padding: 0;
}

.history-card summary {
  cursor: pointer;
  list-style: none;
  padding: var(--space-4);
}

.history-card summary::-webkit-details-marker {
  display: none;
}

.history-card summary:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: -3px;
}

.history-log {
  border-top: 1px solid var(--color-border);
  display: grid;
  list-style: none;
  margin: 0;
  padding: 0 var(--space-4);
}

.history-log li {
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  gap: var(--space-3);
  justify-content: space-between;
  padding: var(--space-3) 0;
}

.history-log small,
.history-card summary small {
  color: var(--color-text-secondary);
  display: block;
}

.history-log > li > strong,
.history-card__detail {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.history-card__detail {
  color: var(--color-primary-strong);
  display: block;
  font-weight: 700;
  padding: var(--space-3) var(--space-4);
  text-align: center;
}
```

- [ ] **Step 8: Run page, format, and shell tests and verify GREEN**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/orders/order-format.test.ts apps/web/app/\(member\)/orders/order-history.test.tsx apps/web/app/shell-navigation.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 9: Commit the PWA History UI slice**

Update the tracker entry to say `Expandable PWA History cards complete; exact
terminal detail pending.`

```bash
git add apps/web/src/features/orders/orders-runtime.ts apps/web/src/features/orders/order-format.ts apps/web/src/features/orders/order-format.test.ts 'apps/web/app/(member)/orders/page.tsx' 'apps/web/app/(member)/orders/order-history.test.tsx' apps/web/app/shell-navigation.test.tsx apps/web/app/globals.css context/progress-tracker.md
git commit -m "feat(web): add expandable history order logs"
```

### Task 4: Apply the same role boundary to exact terminal details

**Files:**
- Modify: `apps/web/src/features/orders/orders-service.ts`
- Test: `apps/web/src/features/orders/orders-service.test.ts`

- [ ] **Step 1: Write failing detail-authorization tests**

Add three service tests:

```ts
it("serves a terminal order to a current non-participant Manager", async () => {
  const view = await loadOrderDetail(
    { identity: identityFor(ownerId, "manager"), now, orderId },
    repositoriesWithTerminalDetail(),
  );
  expect(view.participants).toHaveLength(2);
  expect(view.viewer.canManage).toBe(true);
});

it("keeps a non-participant Manager out of active orders", async () => {
  await expect(loadOrderDetail(
    { identity: identityFor(ownerId, "manager"), now, orderId },
    repositoriesWithActiveDetail(),
  )).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("returns only a Member's own terminal row and lines", async () => {
  const view = await loadOrderDetail(
    { identity: identityFor(memberId, "member"), now, orderId },
    repositoriesWithTerminalDetail(),
  );
  expect(view.participants.map((person) => person.userId)).toEqual([memberId]);
  expect(view.lines.map((line) => line.userId)).toEqual([memberId]);
});
```

- [ ] **Step 2: Run focused detail tests and verify RED**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-service.test.ts -t "terminal order|own terminal"
```

Expected: the Manager is forbidden and the Member receives other people's rows.

- [ ] **Step 3: Implement terminal-only group-leader access and filtering**

Rename the internal viewer kind to avoid calling a Manager an Owner:

```ts
export type OrderViewerRole = Readonly<{
  readonly kind: "participant" | "group-leader";
  readonly canManage: boolean;
}>;
```

In `loadOrderDetail`, calculate:

```ts
const isTerminal = row.state === "ordered" || row.state === "cancelled";
const isGroupLeader =
  membership?.role === "group-owner" || membership?.role === "manager";
const canViewTerminalGroupLog = isTerminal && isGroupLeader;

if (isTerminal && membership === undefined) {
  throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
}
if (!isParticipant && !canViewTerminalGroupLog && membership?.role !== "group-owner") {
  throw new PublicApiError("FORBIDDEN", FORBIDDEN_MESSAGE);
}

const visibleParticipants =
  isTerminal && !isGroupLeader
    ? row.participants.filter((person) => person.userId === command.identity.userId)
    : row.participants;
const visibleLines =
  isTerminal && !isGroupLeader
    ? lines.filter((line) => line.userId === command.identity.userId)
    : lines;
```

Preserve the existing Group Owner access to active orders and all existing
active-order mutation authorization. Return `canManage: isTerminal ?
isGroupLeader : row.managerUserId === userId || membership?.role ===
"group-owner"` and set `kind` from actual participation.

- [ ] **Step 4: Run the complete service suite and verify GREEN**

```bash
npx vitest run --config vitest.config.ts apps/web/src/features/orders/orders-service.test.ts
```

Expected: all existing active-order and new terminal-detail tests PASS.

- [ ] **Step 5: Commit the detail authorization slice**

Update the tracker entry to say `History list and terminal authorization
complete; exact terminal detail UI pending.`

```bash
git add apps/web/src/features/orders/orders-service.ts apps/web/src/features/orders/orders-service.test.ts context/progress-tracker.md
git commit -m "feat(orders): authorize exact terminal history details"
```

### Task 5: Make terminal detail pages permanent read-only logs

**Files:**
- Modify: `apps/web/app/(member)/orders/[orderId]/page.tsx`
- Test: `apps/web/app/(member)/orders/[orderId]/order-detail.test.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Write failing terminal detail page tests**

Create an ordered fixture with two captured lines and an ordinary-Member
fixture already filtered to one person. Assert:

```ts
expect(managerHtml).toContain("Order log");
expect(managerHtml).toContain("Alex Rivera");
expect(managerHtml).toContain("Zinger Combo");
expect(managerHtml).toContain("Extra gravy");
expect(managerHtml).toContain("₱225.00");
expect(managerHtml).not.toContain("Your favorite picks");
expect(managerHtml).not.toContain("Finish order now");
expect(managerHtml).not.toContain("Cancel order");

expect(memberHtml).toContain("Mia Tan");
expect(memberHtml).not.toContain("Alex Rivera");
```

Add a cancelled pending participant assertion for `No food selected` and a
declined participant assertion for `Not eating`.

- [ ] **Step 2: Run the page tests and verify RED**

```bash
npx vitest run --config vitest.config.ts 'apps/web/app/(member)/orders/[orderId]/order-detail.test.tsx' -t "terminal|read-only"
```

Expected: FAIL because terminal participants still flow through active food-picking presentation.

- [ ] **Step 3: Render a dedicated terminal log**

Add `isTerminal` and ensure `FoodPickerSection` renders only during
`food_confirmation`. Add a purpose-described same-file renderer:

```tsx
/** Shows exact immutable food lines for the participants visible to this viewer. */
function TerminalOrderLog({ view }: { readonly view: OrderView }) {
  const linesByUser = new Map<string, OrderView["lines"][number][]>();
  for (const line of view.lines) {
    const lines = linesByUser.get(line.userId) ?? [];
    lines.push(line);
    linesByUser.set(line.userId, lines);
  }

  return (
    <section aria-labelledby="order-log-heading" className="content-section">
      <div className="section-heading-row">
        <h2 id="order-log-heading">Order log</h2>
        <span className="count-badge">{view.participants.length}</span>
      </div>
      <ul className="group-list">
        {view.participants.map((participant) => {
          const lines = linesByUser.get(participant.userId) ?? [];
          const itemCount = lines.reduce(
            (sum, line) => sum + line.quantity,
            0,
          );
          const status =
            participant.foodResponse === "declined"
              ? "Not eating"
              : itemCount === 0
                ? "No food selected"
                : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
          return (
            <li className="participant-card" key={participant.userId}>
              <div className="participant-card__head">
                <div className="participant-card__id">
                  <span aria-hidden="true" className="member-avatar">
                    {participant.displayName.charAt(0)}
                  </span>
                  <div>
                    <p className="participant-card__name">
                      {participant.displayName}
                    </p>
                    <p className="participant-card__meta">{status}</p>
                  </div>
                </div>
              </div>
              {lines.length === 0 ? null : (
                <ul className="participant-card__lines">
                  {lines.map((line, index) => (
                    <li
                      className="pick-line"
                      key={`${participant.userId}-${index}`}
                    >
                      <div>
                        <p className="pick-line__name">{line.itemName}</p>
                        {line.note.length === 0 ? null : (
                          <p className="pick-line__meta">{line.note}</p>
                        )}
                        <p className="pick-line__meta">× {line.quantity}</p>
                      </div>
                      <p className="pick-line__price">
                        {formatCentavos(
                          parseCentavos(line.lineSubtotalCentavos),
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

The implementation must use the service-filtered `view.participants` and
`view.lines` exactly as returned; it must not reconstruct hidden users in the
page. For a pending participant with no lines, render `No food selected`. For
a declined participant, render `Not eating`. For saved lines, render item
name, note when present, quantity, and line subtotal.

- [ ] **Step 4: Keep terminal actions absent by state**

Retain explicit state checks around `FinishOrderButton` and
`CancelOrderButton`. Do not rely only on `viewer.canManage`; ordered and
cancelled states must make both controls impossible to render.

- [ ] **Step 5: Run the detail page tests and verify GREEN**

```bash
npx vitest run --config vitest.config.ts 'apps/web/app/(member)/orders/[orderId]/order-detail.test.tsx'
```

Expected: all detail tests PASS, including the existing active food-picking behavior.

- [ ] **Step 6: Commit the read-only detail UI slice**

Update the tracker entry to say `Implementation complete; verification and
completion evidence pending.`

```bash
git add 'apps/web/app/(member)/orders/[orderId]/page.tsx' 'apps/web/app/(member)/orders/[orderId]/order-detail.test.tsx' apps/web/app/globals.css context/progress-tracker.md
git commit -m "feat(web): show exact read-only history details"
```

### Task 6: Update context, verify the feature, and prepare completion evidence

**Files:**
- Modify: `context/architecture.md`
- Modify: `context/design-structure.md`
- Modify: `context/ui-context.md`
- Modify: `context/project-overview.md`
- Modify: `context/progress-tracker.md`
- Create: `context/history/history-order-log.md`

- [ ] **Step 1: Update the product and architecture contracts**

Make these exact semantic changes:

- `context/architecture.md`: replace the blanket “Order data is visible only
  to its Manager and selected participants” rule with terminal-order rules:
  current Owners/Managers see all group History; Members see only joined
  orders and their own participant details; active-order visibility remains
  unchanged.
- `context/design-structure.md`: define History Viewer as expandable summary
  plus exact read-only detail, with role-scoped person logs.
- `context/ui-context.md`: add the expandable-card interaction, literal
  `Not eating`/`No food selected` statuses, and completion-date requirement.
- `context/project-overview.md`: state the permanent History visibility rule.

Do not update `context/project-structure.md`: this plan adds no production
module or directory and changes no ownership boundary.

- [ ] **Step 2: Run focused automated verification**

```bash
npx vitest run --config vitest.config.ts packages/db/src/repositories/repositories.provider.integration.test.ts apps/web/src/features/orders/orders-service.test.ts apps/web/src/features/orders/order-format.test.ts apps/web/app/\(member\)/orders/order-history.test.tsx 'apps/web/app/(member)/orders/[orderId]/order-detail.test.tsx' apps/web/app/shell-navigation.test.tsx
npm run typecheck
npm run lint
npm run build:web
git diff --check
```

Expected: focused tests, typecheck, lint, web production build, and whitespace check all PASS. If provider tests require live configuration, record that result separately rather than claiming it from provider-free execution.

- [ ] **Step 3: Perform the signed-in PWA acceptance walkthrough**

Using real test accounts, verify:

1. A Group Owner sees all terminal group orders and all participant rows.
2. A non-participant current Manager sees the same full History.
3. A Member sees only joined orders and only their own row/items.
4. Ordered and cancelled cards expand independently with keyboard and touch.
5. Exact-item detail is read-only and contains captured names, quantities,
   notes, and prices.
6. Cancelled incomplete participants read `No food selected`.

If these accounts or records are unavailable, mark browser acceptance pending;
do not substitute mocked UI evidence.

- [ ] **Step 4: Record completion evidence**

Create `context/history/history-order-log.md` with this simple structure:

The file must have `Delivered`, `Verification`, and `Decisions` sections.
Under `Verification`, copy each exact command from Step 2 and record its real
pass/fail count, then record the real signed-in role walkthrough outcome from
Step 3. Do not write expected results or leave template markers in completion
history. Change the tracker entry to `[x]` only if all required work is
complete; otherwise keep it `[ ]` and name the remaining acceptance gate.

- [ ] **Step 5: Commit documentation and evidence**

```bash
git add context/architecture.md context/design-structure.md context/ui-context.md context/project-overview.md context/progress-tracker.md context/history/history-order-log.md
git commit -m "docs: record history order log completion"
```

- [ ] **Step 6: Verify the branch before squash integration**

```bash
git status --short
git log --oneline main..HEAD
git diff --stat main...HEAD
```

Expected: clean worktree, only History-order-log commits after `main`, and no Android, migration, payment, or Grab automation changes.

- [ ] **Step 7: Complete the repository workflow only after verification**

From the primary checkout, squash-merge the task branch with the exact tracker title:

```bash
git switch main
git merge --squash task/history-order-log
git commit -m "History order log"
git branch -d task/history-order-log
```

Push only as part of an explicitly authorized implementation/release workflow.
