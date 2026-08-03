# V1-06 Platform-Admin Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an existing platform admin approve or reject another group owner's pending platform-admin request, on both web and mobile, with an immutable audit trail and no schema changes.

**Architecture:** Reuse the V1-05 access-service / runtime / route-handler stack. Add a `decideAdminAccessRequest` service that runs in one transaction: update the request row, flip `users.is_platform_admin` on approve, write one idempotent audit event. Gate two new API routes (decide + list-pending) on the existing `platform-admin` role already attached to `AppIdentity.roles`. Web gets a real decision screen at `/admin/access-requests`; mobile gets a new route `apps/mobile/app/admin/access-requests.tsx` reached from a Home card visible only to platform admins.

**Tech Stack:** TypeScript, Next.js App Router, Better Auth, Drizzle ORM, Neon PostgreSQL, Vitest (web + shared), Jest (mobile), React Testing Library, Expo Router.

**Branch model:** One task branch `task/V1-06-platform-admin-approval` off reviewed `main`. Tasks below may run as parallel subtask branches or sequentially on the task branch; either way each task commits its own focused work, the integration owner merges reviewed subtasks one at a time, runs affected checks after each merge, and squash-merges the completed task branch into `main` as a single commit titled exactly `V1-06 Implement platform-admin approval and limited mobile-admin permissions`.

---

## File Structure

**Create:**
- `apps/web/app/api/access/admin-requests/decide/route.ts` — POST endpoint, platform-admin gated.
- `apps/web/app/api/access/admin-requests/pending/route.ts` — GET endpoint, platform-admin gated.
- `apps/web/src/features/access/admin-decision-panel.tsx` — client component for the web decision UI.
- `apps/mobile/app/admin/access-requests.tsx` — new route outside `(member)`.
- `apps/mobile/src/features/access/admin-decision-panel.tsx` — mobile decision UI component.

**Modify:**
- `packages/contracts/src/access/access-requests.ts` — add decide request/response types and parsers.
- `packages/contracts/src/access/access-requests.test.ts` — parser tests.
- `packages/db/src/repositories/group-access.ts` — add `findAdminAccessRequestById`, `listPendingAdminAccessRequests`, `decideAdminAccessRequest`, `promoteToPlatformAdmin`.
- `packages/db/src/repositories/repositories.provider.integration.test.ts` — repository tests against rollback-only temporary schemas.
- `apps/web/src/features/access/access-service.ts` — add `decideAdminAccessRequest`, `listPendingAdminAccessRequests`.
- `apps/web/src/features/access/access-service.test.ts` — service unit tests.
- `apps/web/src/features/access/access-route-handlers.ts` — add `createDecideAdminRequestHandler`, `createListPendingAdminRequestsHandler`.
- `apps/web/src/features/access/access-route-handlers.test.ts` — handler tests.
- `apps/web/src/features/access/access-runtime.ts` — wire `decideAdminRequest`, `listPendingAdminRequests`.
- `apps/web/app/admin/access-requests/page.tsx` — replace stub with real decision screen.
- `apps/web/app/admin/layout.tsx` — server-side platform-admin gate.
- `apps/mobile/app/(member)/index.tsx` — add Home card for platform admins.
- `apps/mobile/__tests__/admin-decision-panel.test.tsx` — mobile panel test.
- `apps/mobile/__tests__/home-admin-card.test.tsx` — Home card test.
- `context/progress-tracker.md` — mark V1-06 done; add V1-06B as next.

**No database migration.** The V1-03 schema already supports every operation in this plan.

---

## Task 1: Contracts — decide request/response shapes

**Files:**
- Modify: `packages/contracts/src/access/access-requests.ts`
- Test: `packages/contracts/src/access/access-requests.test.ts`

- [ ] **Step 1: Write the failing parser tests**

Append to `packages/contracts/src/access/access-requests.test.ts` (file already imports `describe`, `expect`, `it`):

```ts
describe("parseDecideAdminAccessRequestRequest", () => {
  it("accepts a valid approve decision without a reason", () => {
    const parsed = parseDecideAdminAccessRequestRequest({
      requestId: "req_abc123",
      decision: "approved",
    });
    expect(parsed).toEqual({ requestId: "req_abc123", decision: "approved" });
  });

  it("accepts a valid reject decision with a reason", () => {
    const parsed = parseDecideAdminAccessRequestRequest({
      requestId: "req_abc123",
      decision: "rejected",
      reason: "  Wait until next quarter.  ",
    });
    expect(parsed).toEqual({
      requestId: "req_abc123",
      decision: "rejected",
      reason: "Wait until next quarter.",
    });
  });

  it("rejects an unknown decision value", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({
        requestId: "req_abc123",
        decision: "maybe",
      }),
    ).toThrow();
  });

  it("rejects a missing requestId", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({ decision: "approved" }),
    ).toThrow();
  });

  it("rejects a reason longer than 500 characters", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({
        requestId: "req_abc123",
        decision: "approved",
        reason: "x".repeat(501),
      }),
    ).toThrow();
  });

  it("rejects an empty reason string", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({
        requestId: "req_abc123",
        decision: "approved",
        reason: "   ",
      }),
    ).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseDecideAdminAccessRequestRequest({
        requestId: "req_abc123",
        decision: "approved",
        evil: true,
      }),
    ).toThrow();
  });
});

describe("parseListPendingAdminAccessRequestsResponse", () => {
  it("accepts a response with zero requests", () => {
    expect(parseListPendingAdminAccessRequestsResponse({ requests: [] })).toEqual({
      requests: [],
    });
  });

  it("accepts a response with one pending request", () => {
    const parsed = parseListPendingAdminAccessRequestsResponse({
      requests: [
        {
          id: "req_abc123",
          requesterUserId: "usr_1",
          requesterDisplayName: "Owner One",
          groupId: "grp_1",
          groupName: "Group One",
          status: "pending",
          createdAt: "2026-07-29T10:00:00.000Z",
        },
      ],
    });
    expect(parsed.requests).toHaveLength(1);
    expect(parsed.requests[0].id).toBe("req_abc123");
  });

  it("rejects a request row missing displayName", () => {
    expect(() =>
      parseListPendingAdminAccessRequestsResponse({
        requests: [
          {
            id: "req_1",
            requesterUserId: "usr_1",
            groupId: "grp_1",
            groupName: "G",
            status: "pending",
            createdAt: "2026-07-29T10:00:00.000Z",
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects a non-pending status in the list", () => {
    expect(() =>
      parseListPendingAdminAccessRequestsResponse({
        requests: [
          {
            id: "req_1",
            requesterUserId: "usr_1",
            requesterDisplayName: "X",
            groupId: "grp_1",
            groupName: "G",
            status: "approved",
            createdAt: "2026-07-29T10:00:00.000Z",
          },
        ],
      }),
    ).toThrow();
  });
});
```

Update the file's existing import block at the top of the test to include the new parsers under test:

```ts
import {
  parseAcceptInvitationRequest,
  parseCreateAdminAccessRequest,
  parseDecideAdminAccessRequestRequest,
  parseIssueInvitationRequest,
  parseListPendingAdminAccessRequestsResponse,
  parseMemberActionRequest,
} from "./access-requests";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace @ordah-please/contracts -- parseDecideAdminAccessRequestRequest parseListPendingAdminAccessRequestsResponse`
Expected: FAIL — the parsers are not exported yet (import error).

- [ ] **Step 3: Add the types and parsers**

Append to `packages/contracts/src/access/access-requests.ts`:

```ts
export type AdminAccessDecision = "approved" | "rejected";

export type DecideAdminAccessRequestRequest = Readonly<{
  requestId: AdminAccessRequestId;
  decision: AdminAccessDecision;
  reason?: string;
}>;

export type AdminAccessRequestSummary = Readonly<{
  id: AdminAccessRequestId;
  requesterUserId: UserId;
  requesterDisplayName: string;
  groupId: GroupId;
  groupName: string;
  status: "pending";
  createdAt: UtcTimestamp;
}>;

export type ListPendingAdminAccessRequestsResponse = Readonly<{
  requests: readonly AdminAccessRequestSummary[];
}>;
```

You also need `AdminAccessRequestId` and `GroupId` types. `UserId` and `UtcTimestamp` are already imported. Add to the existing import from `@ordah-please/domain`:

```ts
import type {
  AdminAccessRequestId,
  GroupId,
  UserId,
  UtcTimestamp,
} from "@ordah-please/domain";
```

If `AdminAccessRequestId` does not exist in `@ordah-please/domain`, add it in `packages/domain/src/types/ids.ts` as a branded type alongside the existing `UserId` pattern, and re-export it from `packages/domain/src/index.ts`. (Run `grep -n "AdminAccessRequestId" packages/domain/src/types/ids.ts` first to confirm.)

Then add the parsers at the bottom of the file:

```ts
/** Validates the body of a platform-admin's decide action on a pending request. */
export function parseDecideAdminAccessRequestRequest(
  value: unknown,
): DecideAdminAccessRequestRequest {
  const object = parseStrictObject(value, "Admin access decision request");
  rejectUnknownFields(
    object,
    ["requestId", "decision", "reason"],
    "Admin access decision request",
  );
  const requestId = parseRecordId<AdminAccessRequestId>(
    object.requestId,
    "Admin access request id",
  );
  if (object.decision !== "approved" && object.decision !== "rejected") {
    throw new Error("Admin access decision must be approved or rejected.");
  }
  const decision: AdminAccessDecision = object.decision;
  const result: DecideAdminAccessRequestRequest = { requestId, decision };
  if (object.reason !== undefined) {
    if (typeof object.reason !== "string") {
      throw new Error("Admin access decision reason must be a string.");
    }
    const trimmed = object.reason.trim();
    if (trimmed === "") {
      throw new Error("Admin access decision reason must not be empty.");
    }
    if (trimmed.length > 500) {
      throw new Error("Admin access decision reason must be at most 500 characters.");
    }
    result.reason = trimmed;
  }
  return result;
}

/** Validates the typed list returned to a platform-admin deciding pending requests. */
export function parseListPendingAdminAccessRequestsResponse(
  value: unknown,
): ListPendingAdminAccessRequestsResponse {
  const object = parseStrictObject(value, "List pending admin access requests response");
  rejectUnknownFields(object, ["requests"], "List pending admin access requests response");
  if (!Array.isArray(object.requests)) {
    throw new Error("Pending admin access requests must be an array.");
  }
  const requests = object.requests.map((entry) => {
    const row = parseStrictObject(entry, "Pending admin access request summary");
    rejectUnknownFields(
      row,
      ["id", "requesterUserId", "requesterDisplayName", "groupId", "groupName", "status", "createdAt"],
      "Pending admin access request summary",
    );
    if (row.status !== "pending") {
      throw new Error("Pending admin access request status must be pending.");
    }
    return {
      id: parseRecordId<AdminAccessRequestId>(row.id, "Admin access request id"),
      requesterUserId: parseRecordId<UserId>(row.requesterUserId, "Requester user id"),
      requesterDisplayName: parseString(row.requesterDisplayName, "Requester display name"),
      groupId: parseRecordId<GroupId>(row.groupId, "Group id"),
      groupName: parseString(row.groupName, "Group name"),
      status: "pending" as const,
      createdAt: parseUtcString(row.createdAt, "Request created at"),
    };
  });
  return { requests };
}
```

Also re-export the new types from `packages/contracts/src/index.ts`:

```ts
export {
  parseDecideAdminAccessRequestRequest,
  parseListPendingAdminAccessRequestsResponse,
  type AdminAccessDecision,
  type AdminAccessRequestSummary,
  type DecideAdminAccessRequestRequest,
  type ListPendingAdminAccessRequestsResponse,
} from "./access/access-requests.js";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace @ordah-please/contracts`
Expected: PASS — all existing parser tests and the new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/access/access-requests.ts \
        packages/contracts/src/access/access-requests.test.ts \
        packages/contracts/src/index.ts \
        packages/domain/src/types/ids.ts \
        packages/domain/src/index.ts
git commit -m "feat(contracts): add V1-06 admin-access decide and pending-list contracts"
```

---

## Task 2: Repositories — decide, list-pending, promote

**Files:**
- Modify: `packages/db/src/repositories/group-access.ts`
- Test: `packages/db/src/repositories/repositories.provider.integration.test.ts`

- [ ] **Step 1: Add the failing provider integration tests**

Append to `packages/db/src/repositories/repositories.provider.integration.test.ts`. The file already has the rollback-only temporary-schema harness used by V1-03/V1-05; mirror an existing test's setup for inserting a user, group, membership (owner), and a pending admin-access request, then exercise the new methods.

```ts
describe("group access V1-06 decide flow", () => {
  it("lists pending requests with requester and group names", async () => {
    const repositories = await buildRolledBackRepositories();
    const requester = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId: "auth-requester",
      displayName: "Owner Riley",
    });
    const decidingAdmin = await repositories.identityAccess.ensureUserForAuthIdentity({
      authUserId: "auth-decider",
      displayName: "Admin Quinn",
    });
    const group = await repositories.groupAccess.createInvitation({
      /* insert a group via the existing helper used elsewhere in this file */
    });
    // … insert membership (requester as owner of group), then:
    const request = await repositories.groupAccess.createAdminAccessRequest({
      groupId: group.id,
      requesterUserId: requester.id,
    });

    const pending = await repositories.groupAccess.listPendingAdminAccessRequests();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual(
      expect.objectContaining({
        id: request.id,
        requesterUserId: requester.id,
        requesterDisplayName: "Owner Riley",
        groupId: group.id,
        status: "pending",
      }),
    );

    // silence unused-warning while the helper wires the second user
    void decidingAdmin;
  });

  it("approves a pending request and flips the requester's platform-admin flag", async () => {
    const repositories = await buildRolledBackRepositories();
    const { requesterId, groupId, requestId, decidingAdminId } =
      await seedPendingRequestFixture(repositories);

    const updated = await repositories.groupAccess.decideAdminAccessRequest({
      requestId,
      decision: "approved",
      decidedByUserId: decidingAdminId,
      decidedAt: new Date("2026-07-30T10:00:00.000Z"),
    });
    expect(updated.status).toBe("approved");
    expect(updated.decidedByUserId).toBe(decidingAdminId);

    await repositories.groupAccess.promoteToPlatformAdmin(requesterId);
    const after = await repositories.groupAccess.findAdminAccessRequestById(requestId);
    expect(after?.status).toBe("approved");
  });

  it("returns zero-row decide when the request is no longer pending (concurrent)", async () => {
    const repositories = await buildRolledBackRepositories();
    const { requestId, decidingAdminId } = await seedPendingRequestFixture(repositories);

    await repositories.groupAccess.decideAdminAccessRequest({
      requestId,
      decision: "rejected",
      decidedByUserId: decidingAdminId,
      decidedAt: new Date("2026-07-30T10:00:00.000Z"),
    });
    await expect(
      repositories.groupAccess.decideAdminAccessRequest({
        requestId,
        decision: "approved",
        decidedByUserId: decidingAdminId,
        decidedAt: new Date("2026-07-30T10:00:01.000Z"),
      }),
    ).rejects.toThrow();
  });
});
```

`seedPendingRequestFixture` is a small helper local to the test file that creates a requester user (non-platform-admin), a deciding-admin user (`isPlatformAdmin = true` set directly via the existing test helper pattern), a group, an owner membership for the requester, and a pending admin-access request, then returns the four ids. Add this helper in the same file using the same `ensureUserForAuthIdentity`, `createGroup`-equivalent, `addMembership`, and `createAdminAccessRequest` patterns the existing tests already use. Do not duplicate the build helper — reuse `buildRolledBackRepositories()`.

Note: `isPlatformAdmin` must be flippable in tests. If the existing `ensureUserForAuthIdentity` doesn't accept that flag, add a `setPlatformAdminFlag(userId, value)` method in Task 2 as well, used only by tests. (Run `grep -n "isPlatformAdmin" packages/db/src/repositories/identity-access.ts` first to see what already exists.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace @ordah-please/db -- group-access V1-06` (or set `NEON_PROVIDER=1` and the test-file pattern that the existing provider integration tests use — match the workspace command documented at the top of `repositories.provider.integration.test.ts`).
Expected: FAIL — `findAdminAccessRequestById`, `listPendingAdminAccessRequests`, `decideAdminAccessRequest`, `promoteToPlatformAdmin` do not exist on the repository.

- [ ] **Step 3: Add the four methods to the repository**

In `packages/db/src/repositories/group-access.ts`, extend the `GroupAccessRepository` interface (alphabetical, matching existing order):

```ts
decideAdminAccessRequest(input: {
  readonly requestId: string;
  readonly decision: "approved" | "rejected";
  readonly decidedByUserId: string;
  readonly decidedAt: Date;
  readonly reason?: string;
}): Promise<typeof adminAccessRequests.$inferSelect>;
findAdminAccessRequestById(
  requestId: string,
): Promise<typeof adminAccessRequests.$inferSelect | undefined>;
listPendingAdminAccessRequests(): Promise<
  readonly {
    readonly id: string;
    readonly requesterUserId: string;
    readonly requesterDisplayName: string;
    readonly groupId: string;
    readonly groupName: string;
    readonly status: "pending";
    readonly createdAt: Date;
  }[]
>;
promoteToPlatformAdmin(userId: string): Promise<boolean>;
```

Add the implementations inside `createGroupAccessRepository`'s returned object, in the same alphabetical position:

```ts
decideAdminAccessRequest: async (input) => {
  const [updated] = await database
    .update(adminAccessRequests)
    .set({
      status: input.decision,
      decidedAt: input.decidedAt,
      decidedByUserId: input.decidedByUserId,
      decisionReason: input.reason ?? null,
    })
    .where(
      and(
        eq(adminAccessRequests.id, input.requestId),
        eq(adminAccessRequests.status, "pending"),
      ),
    )
    .returning();
  if (updated === undefined) {
    throw new Error("Admin access request is no longer pending.");
  }
  return updated;
},
findAdminAccessRequestById: async (requestId) => {
  const [row] = await database
    .select()
    .from(adminAccessRequests)
    .where(eq(adminAccessRequests.id, requestId))
    .limit(1);
  return row;
},
listPendingAdminAccessRequests: () =>
  database
    .select({
      createdAt: adminAccessRequests.createdAt,
      groupId: adminAccessRequests.groupId,
      groupName: groups.name,
      id: adminAccessRequests.id,
      requesterDisplayName: users.displayName,
      requesterUserId: adminAccessRequests.requesterUserId,
      status: adminAccessRequests.status,
    })
    .from(adminAccessRequests)
    .innerJoin(users, eq(users.id, adminAccessRequests.requesterUserId))
    .innerJoin(groups, eq(groups.id, adminAccessRequests.groupId))
    .where(eq(adminAccessRequests.status, "pending"))
    .orderBy(asc(adminAccessRequests.createdAt)),
promoteToPlatformAdmin: async (userId) => {
  const [updated] = await database
    .update(users)
    .set({ isPlatformAdmin: true })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  return updated !== undefined;
},
```

`groups` is already imported at the top of the file. Confirm with `grep -n "^import" packages/db/src/repositories/group-access.ts`.

If the test fixture needs to flip `isPlatformAdmin` on the deciding admin, add to `identity-access.ts` a `setPlatformAdminFlag` method:

```ts
setPlatformAdminFlag: async (userId, value) => {
  const [updated] = await database
    .update(users)
    .set({ isPlatformAdmin: value })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  return updated !== undefined;
},
```

Only do this if `grep` shows no existing equivalent.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace @ordah-please/db` (provider integration suites included).
Expected: PASS — new repository tests pass and existing repository tests remain green.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/group-access.ts \
        packages/db/src/repositories/identity-access.ts \
        packages/db/src/repositories/repositories.provider.integration.test.ts
git commit -m "feat(db): add V1-06 admin-access decide, list-pending, promote repositories"
```

---

## Task 3: Service — decideAdminAccessRequest and listPendingAdminAccessRequests

**Files:**
- Modify: `apps/web/src/features/access/access-service.ts`
- Test: `apps/web/src/features/access/access-service.test.ts`

- [ ] **Step 1: Write the failing service tests**

Append to `apps/web/src/features/access/access-service.test.ts`, matching the file's existing mock-transaction-runner style. Add `decideAdminAccessRequest` and `listPendingAdminAccessRequests` to the import from `./access-service` at the top of the file.

```ts
describe("decideAdminAccessRequest", () => {
  const baseRequest = {
    id: "req-1",
    requesterUserId: "owner-1",
    groupId: "group-1",
    status: "pending" as const,
    decidedAt: null,
    decidedByUserId: null,
    decisionReason: null,
    createdAt: new Date("2026-07-28T08:00:00.000Z"),
  };

  it("approves a pending request, promotes the requester, and writes one idempotent audit row", async () => {
    const findAdminAccessRequestById = vi.fn(async () => baseRequest);
    const decideAdminAccessRequest = vi.fn(async () => ({
      ...baseRequest,
      status: "approved" as const,
      decidedByUserId: "admin-1",
      decidedAt: new Date("2026-07-30T08:00:00.000Z"),
    }));
    const promoteToPlatformAdmin = vi.fn(async () => true);
    const appendOnce = vi.fn(async () => ({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(operation: (repositories: any) => Promise<Result>) =>
        operation({
          access: {
            findAdminAccessRequestById,
            decideAdminAccessRequest,
            promoteToPlatformAdmin,
          },
          auditEvents: { appendOnce },
        }),
    };

    const result = await decideAdminAccessRequestService(
      {
        actorUserId: "admin-1",
        requestId: "req-1",
        decision: "approved",
        now: new Date("2026-07-30T08:00:00.000Z"),
      },
      transactionRunner,
    );

    expect(result.status).toBe("approved");
    expect(promoteToPlatformAdmin).toHaveBeenCalledWith("owner-1");
    expect(appendOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform_admin.approved",
        actorUserId: "admin-1",
        resourceId: "req-1",
        idempotencyKey: "platform_admin:decide:req-1:approved",
      }),
    );
  });

  it("rejects a pending request without promoting and writes the rejected audit row", async () => {
    const findAdminAccessRequestById = vi.fn(async () => baseRequest);
    const decideAdminAccessRequest = vi.fn(async () => ({
      ...baseRequest,
      status: "rejected" as const,
      decidedByUserId: "admin-1",
      decidedAt: new Date("2026-07-30T08:00:00.000Z"),
      decisionReason: "Not yet.",
    }));
    const promoteToPlatformAdmin = vi.fn(async () => true);
    const appendOnce = vi.fn(async () => ({ id: "audit-2" }));
    const transactionRunner = {
      run: <Result>(operation: (repositories: any) => Promise<Result>) =>
        operation({
          access: {
            findAdminAccessRequestById,
            decideAdminAccessRequest,
            promoteToPlatformAdmin,
          },
          auditEvents: { appendOnce },
        }),
    };

    const result = await decideAdminAccessRequestService(
      {
        actorUserId: "admin-1",
        requestId: "req-1",
        decision: "rejected",
        reason: "Not yet.",
        now: new Date("2026-07-30T08:00:00.000Z"),
      },
      transactionRunner,
    );

    expect(result.status).toBe("rejected");
    expect(promoteToPlatformAdmin).not.toHaveBeenCalled();
    expect(appendOnce).toHaveBeenCalledWith(
      expect.objectContaining({ action: "platform_admin.rejected" }),
    );
  });

  it("fails with not_found when the request does not exist", async () => {
    const findAdminAccessRequestById = vi.fn(async () => undefined);
    const transactionRunner = {
      run: <Result>(operation: (repositories: any) => Promise<Result>) =>
        operation({ access: { findAdminAccessRequestById }, auditEvents: { appendOnce: vi.fn() } }),
    };

    await expect(
      decideAdminAccessRequestService(
        { actorUserId: "admin-1", requestId: "missing", decision: "approved", now: new Date() },
        transactionRunner,
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("fails with already_decided when the request is no longer pending", async () => {
    const findAdminAccessRequestById = vi.fn(async () => ({
      ...baseRequest,
      status: "approved" as const,
    }));
    const transactionRunner = {
      run: <Result>(operation: (repositories: any) => Promise<Result>) =>
        operation({ access: { findAdminAccessRequestById }, auditEvents: { appendOnce: vi.fn() } }),
    };

    await expect(
      decideAdminAccessRequestService(
        { actorUserId: "admin-1", requestId: "req-1", decision: "approved", now: new Date() },
        transactionRunner,
      ),
    ).rejects.toThrow(/already been decided/i);
  });

  it("fails with cannot_decide_own_request when the admin is the requester", async () => {
    const findAdminAccessRequestById = vi.fn(async () => ({
      ...baseRequest,
      requesterUserId: "admin-1",
    }));
    const transactionRunner = {
      run: <Result>(operation: (repositories: any) => Promise<Result>) =>
        operation({ access: { findAdminAccessRequestById }, auditEvents: { appendOnce: vi.fn() } }),
    };

    await expect(
      decideAdminAccessRequestService(
        { actorUserId: "admin-1", requestId: "req-1", decision: "approved", now: new Date() },
        transactionRunner,
      ),
    ).rejects.toThrow(/own request/i);
  });
});
```

Note: name the imported function `decideAdminAccessRequest` in real code. In the test snippet above it's aliased `decideAdminAccessRequestService` only to avoid shadowing the mock repository method of the same name — pick one consistent alias and use it across the test file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace @ordah-please/web -- decideAdminAccessRequest`
Expected: FAIL — `decideAdminAccessRequest` is not exported from `./access-service`.

- [ ] **Step 3: Add the service functions**

In `apps/web/src/features/access/access-service.ts`, add a new repositories interface and command type near the existing `AdminRequestRepositories` block:

```ts
interface AdminDecisionRepositories {
  readonly access: {
    findAdminAccessRequestById(requestId: string): Promise<
      | {
          readonly id: string;
          readonly requesterUserId: string;
          readonly groupId: string;
          readonly status: "pending" | "approved" | "rejected";
        }
      | undefined
    >;
    decideAdminAccessRequest(input: {
      readonly requestId: string;
      readonly decision: "approved" | "rejected";
      readonly decidedByUserId: string;
      readonly decidedAt: Date;
      readonly reason?: string;
    }): Promise<{
      readonly id: string;
      readonly requesterUserId: string;
      readonly status: "approved" | "rejected";
      readonly decidedAt: Date;
      readonly decidedByUserId: string;
      readonly decisionReason: string | null;
    }>;
    promoteToPlatformAdmin(userId: string): Promise<boolean>;
  };
  readonly auditEvents: {
    appendOnce(input: {
      readonly action: string;
      readonly actorUserId: string;
      readonly details: Readonly<Record<string, unknown>>;
      readonly resourceId: string;
      readonly resourceType: string;
      readonly idempotencyKey: string;
    }): Promise<{ readonly id: string } | undefined>;
  };
}

interface AdminDecisionTransactionRunner {
  run<Result>(
    operation: (repositories: AdminDecisionRepositories) => Promise<Result>,
  ): Promise<Result>;
}

export interface DecideAdminAccessRequestCommand {
  readonly actorUserId: string;
  readonly requestId: string;
  readonly decision: "approved" | "rejected";
  readonly reason?: string;
  readonly now: Date;
}
```

Add the function at the bottom of the file:

```ts
/** Applies one platform-admin's approve or reject decision with an idempotent audit row. */
export function decideAdminAccessRequest(
  command: DecideAdminAccessRequestCommand,
  transactionRunner: AdminDecisionTransactionRunner,
): Promise<{
  readonly requestId: string;
  readonly status: "approved" | "rejected";
}> {
  return transactionRunner.run(async (repositories) => {
    const request = await repositories.access.findAdminAccessRequestById(
      command.requestId,
    );
    if (request === undefined) {
      throw new PublicApiError("NOT_FOUND", "Admin access request was not found.");
    }
    if (request.status !== "pending") {
      throw new PublicApiError(
        "CONFLICT",
        "This admin access request has already been decided.",
      );
    }
    if (request.requesterUserId === command.actorUserId) {
      throw new PublicApiError(
        "FORBIDDEN",
        "You cannot decide your own platform-admin request.",
      );
    }

    const updated = await repositories.access.decideAdminAccessRequest({
      requestId: command.requestId,
      decision: command.decision,
      decidedByUserId: command.actorUserId,
      decidedAt: command.now,
      reason: command.reason,
    });

    if (command.decision === "approved") {
      await repositories.access.promoteToPlatformAdmin(request.requesterUserId);
    }

    await repositories.auditEvents.appendOnce({
      action:
        command.decision === "approved"
          ? "platform_admin.approved"
          : "platform_admin.rejected",
      actorUserId: command.actorUserId,
      details: {
        decision: command.decision,
        reason: command.reason ?? null,
        requesterUserId: request.requesterUserId,
      },
      resourceId: command.requestId,
      resourceType: "admin_access_request",
      idempotencyKey: `platform_admin:decide:${command.requestId}:${command.decision}`,
    });

    return { requestId: updated.id, status: updated.status };
  });
}
```

Confirm `NOT_FOUND` is a valid `PublicApiError` code by running `grep -n "NOT_FOUND\|type.*ErrorCode\|export.*Error" packages/contracts/src/common/errors.ts`. If it isn't, use the closest existing code (likely `CONFLICT` or `NOT_FOUND`) — the route layer translates it to HTTP 404 in Task 5.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace @ordah-please/web -- decideAdminAccessRequest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/access/access-service.ts \
        apps/web/src/features/access/access-service.test.ts
git commit -m "feat(access): add V1-06 decideAdminAccessRequest service"
```

---

## Task 4: Runtime wiring — expose decide and list-pending through `accessRuntime`

**Files:**
- Modify: `apps/web/src/features/access/access-runtime.ts`

This task has no test of its own — `access-runtime.ts` is a thin wiring layer, validated end-to-end by the route-handler tests in Task 5 and the live acceptance step at the end.

- [ ] **Step 1: Wire the new operations**

In `apps/web/src/features/access/access-runtime.ts`, add `decideAdminAccessRequest` and `listPendingAdminAccessRequests` to the imports from `./access-service`:

```ts
import {
  acceptGroupInvitation,
  decideAdminAccessRequest,
  issueGroupInvitation,
  listPendingAdminAccessRequests,
  manageGroupMember,
  submitAdminAccessRequest,
} from "./access-service";
```

`listPendingAdminAccessRequests` needs a thin service wrapper too. Add it to `access-service.ts` (this belongs with Task 3's service work but is called out separately here because it's read-only and trivial — write it together with Task 3 if doing both at once, otherwise add it now):

```ts
export function listPendingAdminAccessRequests(
  transactionRunner: Pick<AdminDecisionTransactionRunner, "run">,
): Promise<readonly AdminAccessRequestSummary[]> {
  return transactionRunner.run(async (repositories) => {
    const rows = await repositories.access.listPendingAdminAccessRequests();
    return rows.map((row) => ({
      id: row.id,
      requesterUserId: row.requesterUserId,
      requesterDisplayName: row.requesterDisplayName,
      groupId: row.groupId,
      groupName: row.groupName,
      status: "pending" as const,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}
```

This requires `listPendingAdminAccessRequests` on `AdminDecisionRepositories["access"]`. Add it to the interface from Task 3:

```ts
listPendingAdminAccessRequests(): Promise<
  readonly {
    readonly id: string;
    readonly requesterUserId: string;
    readonly requesterDisplayName: string;
    readonly groupId: string;
    readonly groupName: string;
    readonly status: "pending";
    readonly createdAt: Date;
  }[]
>;
```

Then extend the `accessRuntime` object at the bottom of `access-runtime.ts`:

```ts
export const accessRuntime = {
  acceptInvitation: (command: Parameters<typeof acceptGroupInvitation>[0]) =>
    acceptGroupInvitation(command, { run: runAccessTransaction }),
  decideAdminRequest: (command: Parameters<typeof decideAdminAccessRequest>[0]) =>
    decideAdminAccessRequest(command, { run: runAccessTransaction }),
  issueInvitation: (command: Parameters<typeof issueGroupInvitation>[0]) =>
    issueGroupInvitation(command, { run: runAccessTransaction }),
  listMembers: (groupId: string) =>
    createRepositories(getRuntimeDatabase()).groupAccess.listActiveMembers(groupId),
  listPendingAdminRequests: () =>
    listPendingAdminAccessRequests({ run: runAccessTransaction }),
  loadIdentity: loadRuntimeIdentity,
  manageMember: (command: Parameters<typeof manageGroupMember>[0]) =>
    manageGroupMember(command, { run: runAccessTransaction }),
  submitAdminRequest: (
    command: Parameters<typeof submitAdminAccessRequest>[0],
  ) => submitAdminAccessRequest(command, { run: runAccessTransaction }),
  verifySession,
};
```

- [ ] **Step 2: Verify type check and existing tests still pass**

Run: `npm run typecheck --workspace @ordah-please/web && npm test --workspace @ordah-please/web`
Expected: type check clean, existing tests still green (no behavior change yet — just wiring).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/access/access-service.ts \
        apps/web/src/features/access/access-runtime.ts
git commit -m "feat(access): wire V1-06 decide and list-pending through accessRuntime"
```

---

## Task 5: API routes — decide and pending endpoints

**Files:**
- Create: `apps/web/app/api/access/admin-requests/decide/route.ts`
- Create: `apps/web/app/api/access/admin-requests/pending/route.ts`
- Modify: `apps/web/src/features/access/access-route-handlers.ts`
- Test: `apps/web/src/features/access/access-route-handlers.test.ts`

- [ ] **Step 1: Write the failing handler tests**

Append to `apps/web/src/features/access/access-route-handlers.test.ts`. The file already imports the existing handler factories and uses stubbed `loadIdentity` / `verifySession` / `now` dependencies; mirror that style.

```ts
describe("createDecideAdminRequestHandler", () => {
  it("returns 403 when the caller is not a platform admin", async () => {
    const handler = createDecideAdminRequestHandler({
      decideAdminRequest: vi.fn(),
      loadIdentity: async () => ({
        authUserId: "auth-1",
        roles: ["group-owner"],
        userId: "user-1",
        groupId: "group-1",
      }),
      now: () => new Date("2026-07-30T08:00:00.000Z"),
      verifySession: () => ({ authUserId: "auth-1", displayName: "Owner" }),
    });

    const response = await handler(
      new Request("https://example.test/api/access/admin-requests/decide", {
        method: "POST",
        body: JSON.stringify({ requestId: "req-1", decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
  });

  it("approves through the service and returns the new status", async () => {
    const decideAdminRequest = vi.fn(async () => ({
      requestId: "req-1",
      status: "approved" as const,
    }));
    const handler = createDecideAdminRequestHandler({
      decideAdminRequest,
      loadIdentity: async () => ({
        authUserId: "auth-admin",
        roles: ["platform-admin"],
        userId: "admin-1",
      }),
      now: () => new Date("2026-07-30T08:00:00.000Z"),
      verifySession: () => ({ authUserId: "auth-admin", displayName: "Admin" }),
    });

    const response = await handler(
      new Request("https://example.test/api/access/admin-requests/decide", {
        method: "POST",
        body: JSON.stringify({ requestId: "req-1", decision: "approved" }),
        headers: {
          "content-type": "application/json",
          origin: "https://example.test",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(decideAdminRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        requestId: "req-1",
        decision: "approved",
      }),
    );
  });

  it("returns 400 on a malformed body", async () => {
    const handler = createDecideAdminRequestHandler({
      decideAdminRequest: vi.fn(),
      loadIdentity: async () => ({
        authUserId: "auth-admin",
        roles: ["platform-admin"],
        userId: "admin-1",
      }),
      now: () => new Date("2026-07-30T08:00:00.000Z"),
      verifySession: () => ({ authUserId: "auth-admin", displayName: "Admin" }),
    });

    const response = await handler(
      new Request("https://example.test/api/access/admin-requests/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: {
          "content-type": "application/json",
          origin: "https://example.test",
        },
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe("createListPendingAdminRequestsHandler", () => {
  it("returns 403 when the caller is not a platform admin", async () => {
    const handler = createListPendingAdminRequestsHandler({
      listPendingAdminRequests: vi.fn(async () => []),
      loadIdentity: async () => ({
        authUserId: "auth-1",
        roles: [],
        userId: "user-1",
      }),
      verifySession: () => ({ authUserId: "auth-1", displayName: "Member" }),
    });

    const response = await handler(
      new Request("https://example.test/api/access/admin-requests/pending"),
    );
    expect(response.status).toBe(403);
  });

  it("returns the pending list for a platform admin", async () => {
    const listPendingAdminRequests = vi.fn(async () => [
      {
        id: "req-1",
        requesterUserId: "usr-1",
        requesterDisplayName: "Owner One",
        groupId: "grp-1",
        groupName: "Group One",
        status: "pending" as const,
        createdAt: "2026-07-28T08:00:00.000Z",
      },
    ]);
    const handler = createListPendingAdminRequestsHandler({
      listPendingAdminRequests,
      loadIdentity: async () => ({
        authUserId: "auth-admin",
        roles: ["platform-admin"],
        userId: "admin-1",
      }),
      verifySession: () => ({ authUserId: "auth-admin", displayName: "Admin" }),
    });

    const response = await handler(
      new Request("https://example.test/api/access/admin-requests/pending"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.requests).toHaveLength(1);
  });
});
```

Add `createDecideAdminRequestHandler` and `createListPendingAdminRequestsHandler` to the import from `./access-route-handlers` at the top of the test file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace @ordah-please/web -- access-route-handlers`
Expected: FAIL — the two factories are not exported.

- [ ] **Step 3: Add the handler factories**

In `apps/web/src/features/access/access-route-handlers.ts`, extend the imports from `@ordah-please/contracts`:

```ts
import {
  parseAcceptInvitationRequest,
  parseCreateAdminAccessRequest,
  parseDecideAdminAccessRequestRequest,
  parseIssueInvitationRequest,
  parseListPendingAdminAccessRequestsResponse,
  parseMemberActionRequest,
  PublicApiError,
  type AcceptInvitationRequest,
  type CreateAdminAccessRequest,
  type DecideAdminAccessRequestRequest,
  type IssueInvitationRequest,
  type ListPendingAdminAccessRequestsResponse,
  type MemberActionRequest,
} from "@ordah-please/contracts";
```

Add `DecideAdminAccessRequestCommand` and the list result type to the import from `./access-service`:

```ts
import type {
  AcceptGroupInvitationCommand,
  DecideAdminAccessRequestCommand,
  IssueGroupInvitationCommand,
  ManageGroupMemberCommand,
  SubmitAdminAccessRequestCommand,
} from "./access-service";
```

Add a `platform-admin` helper next to `isGroupOwner`:

```ts
/** Identifies a platform admin (cross-group) for decide and pending-list routes. */
function isPlatformAdmin(identity: AppIdentity): boolean {
  return identity.roles.includes("platform-admin");
}
```

Add the two dependencies interfaces near `AdminRequestHandlerDependencies`:

```ts
export interface DecideAdminRequestHandlerDependencies {
  readonly decideAdminRequest: (
    command: DecideAdminAccessRequestCommand,
  ) => Promise<{ readonly requestId: string; readonly status: "approved" | "rejected" }>;
  readonly loadIdentity: (session: VerifiedSession) => MaybePromise<AppIdentity>;
  readonly now: () => Date;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export interface ListPendingAdminRequestsHandlerDependencies {
  readonly listPendingAdminRequests: () => Promise<
    readonly ListPendingAdminAccessRequestsResponse["requests"]
  >;
  readonly loadIdentity: (session: VerifiedSession) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}
```

Add the two factory functions at the bottom of the file:

```ts
/** Creates the platform-admin route that approves or rejects one pending admin request. */
export function createDecideAdminRequestHandler(
  dependencies: DecideAdminRequestHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      DecideAdminAccessRequestRequest,
      { readonly requestId: string; readonly status: "approved" | "rejected" }
    >(
      request,
      {
        authorize: ({ identity }) => isPlatformAdmin(identity),
        execute: ({ identity, input }) =>
          dependencies.decideAdminRequest({
            actorUserId: identity.userId,
            requestId: input.requestId,
            decision: input.decision,
            reason: input.reason,
            now: dependencies.now(),
          }),
        validate: (incomingRequest) =>
          parseRequestBody(incomingRequest, parseDecideAdminAccessRequestRequest),
        verifyRequest: verifyTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

/** Creates the platform-admin route that lists all pending admin requests. */
export function createListPendingAdminRequestsHandler(
  dependencies: ListPendingAdminRequestsHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<undefined, ListPendingAdminAccessRequestsResponse>(
      request,
      {
        authorize: ({ identity }) => isPlatformAdmin(identity),
        execute: async () => {
          const requests = await dependencies.listPendingAdminRequests();
          return parseListPendingAdminAccessRequestsResponse({ requests });
        },
        validate: () => undefined,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}
```

- [ ] **Step 4: Add the two route files**

`apps/web/app/api/access/admin-requests/decide/route.ts`:

```ts
import { createDecideAdminRequestHandler } from "../../../../../src/features/access/access-route-handlers";
import { accessRuntime } from "../../../../../src/features/access/access-runtime";

export const POST = createDecideAdminRequestHandler({
  decideAdminRequest: accessRuntime.decideAdminRequest,
  loadIdentity: accessRuntime.loadIdentity,
  now: () => new Date(),
  verifySession: accessRuntime.verifySession,
});
```

`apps/web/app/api/access/admin-requests/pending/route.ts`:

```ts
import { createListPendingAdminRequestsHandler } from "../../../../../src/features/access/access-route-handlers";
import { accessRuntime } from "../../../../../src/features/access/access-runtime";

export const GET = createListPendingAdminRequestsHandler({
  listPendingAdminRequests: accessRuntime.listPendingAdminRequests,
  loadIdentity: accessRuntime.loadIdentity,
  verifySession: accessRuntime.verifySession,
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace @ordah-please/web -- access-route-handlers`
Expected: PASS — the new handler tests pass and existing handler tests remain green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/access/access-route-handlers.ts \
        apps/web/src/features/access/access-route-handlers.test.ts \
        apps/web/app/api/access/admin-requests/decide/route.ts \
        apps/web/app/api/access/admin-requests/pending/route.ts
git commit -m "feat(api): add V1-06 decide and pending admin-request routes"
```

---

## Task 6: Web UI — decision screen and admin nav gate

**Files:**
- Modify: `apps/web/app/admin/access-requests/page.tsx`
- Modify: `apps/web/app/admin/layout.tsx`
- Create: `apps/web/src/features/access/admin-decision-panel.tsx`
- Test: `apps/web/src/features/access/admin-decision-panel.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `apps/web/src/features/access/admin-decision-panel.test.tsx`. Mirror the testing-library + vitest style used in `team-access-view.test.tsx` (read that file first if the imports are unfamiliar).

```ts
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { AdminDecisionPanel } from "./admin-decision-panel";

describe("AdminDecisionPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an empty state when there are no pending requests", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { requests: [] } }), {
        status: 200,
      }),
    );
    render(<AdminDecisionPanel />);
    await waitFor(() => {
      expect(screen.getByText(/no pending requests/i)).toBeInTheDocument();
    });
  });

  it("renders one card per pending request", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            requests: [
              {
                id: "req-1",
                requesterUserId: "usr-1",
                requesterDisplayName: "Owner Riley",
                groupId: "grp-1",
                groupName: "Riley's Group",
                status: "pending",
                createdAt: "2026-07-28T08:00:00.000Z",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    render(<AdminDecisionPanel />);
    await waitFor(() => {
      expect(screen.getByText("Owner Riley")).toBeInTheDocument();
      expect(screen.getByText("Riley's Group")).toBeInTheDocument();
    });
  });

  it("posts an approve decision and removes the card on success", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/pending")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              requests: [
                {
                  id: "req-1",
                  requesterUserId: "usr-1",
                  requesterDisplayName: "Owner Riley",
                  groupId: "grp-1",
                  groupName: "Riley's Group",
                  status: "pending",
                  createdAt: "2026-07-28T08:00:00.000Z",
                },
              ],
            },
          }),
          { status: 200 },
        );
      }
      // decide endpoint
      return new Response(
        JSON.stringify({
          ok: true,
          data: { requestId: "req-1", status: "approved" },
        }),
        { status: 200 },
      );
    });
    render(<AdminDecisionPanel />);
    await waitFor(() => {
      expect(screen.getByText("Owner Riley")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => {
      expect(screen.queryByText("Owner Riley")).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @ordah-please/web -- admin-decision-panel`
Expected: FAIL — `AdminDecisionPanel` does not exist.

- [ ] **Step 3: Implement the panel**

Create `apps/web/src/features/access/admin-decision-panel.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

type PendingRequest = Readonly<{
  id: string;
  requesterUserId: string;
  requesterDisplayName: string;
  groupId: string;
  groupName: string;
  status: "pending";
  createdAt: string;
}>;

type Status = "loading" | "ready" | "error" | "forbidden";

async function readData(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(response.status === 403 ? "forbidden" : "failed");
  }
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value)
  ) {
    throw new Error("failed");
  }
  return (value as { data: unknown }).data;
}

function parsePendingList(value: unknown): readonly PendingRequest[] {
  if (typeof value !== "object" || value === null || !("requests" in value)) {
    throw new Error("failed");
  }
  const list = (value as { requests: unknown }).requests;
  if (!Array.isArray(list)) {
    throw new Error("failed");
  }
  return list.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as PendingRequest).id !== "string" ||
      typeof (entry as PendingRequest).requesterDisplayName !== "string" ||
      typeof (entry as PendingRequest).groupName !== "string" ||
      (entry as PendingRequest).status !== "pending"
    ) {
      throw new Error("failed");
    }
    return entry as PendingRequest;
  });
}

/** Connects the platform-admin decision UI to the pending and decide routes. */
export function AdminDecisionPanel() {
  const [requests, setRequests] = useState<readonly PendingRequest[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const actionInFlight = useRef(false);

  const refresh = async () => {
    try {
      const parsed = parsePendingList(
        await readData(await fetch("/api/access/admin-requests/pending")),
      );
      setRequests(parsed);
      setStatus("ready");
    } catch (error) {
      setStatus(
        error instanceof Error && error.message === "forbidden" ? "forbidden" : "error",
      );
    }
  };

  useEffect(() => {
    let cancelled = false;
    void refresh().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = async (
    request: PendingRequest,
    decision: "approved" | "rejected",
  ) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusyId(request.id);
    setMessage(null);
    try {
      await readData(
        await fetch("/api/access/admin-requests/decide", {
          body: JSON.stringify({ requestId: request.id, decision }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      );
      setRequests((current) =>
        current.filter((entry) => entry.id !== request.id),
      );
    } catch {
      setMessage(`The ${decision} action could not be completed.`);
    } finally {
      actionInFlight.current = false;
      setBusyId(null);
    }
  };

  if (status === "loading") {
    return <p role="status">Loading admin requests…</p>;
  }
  if (status === "forbidden") {
    return <p>Only platform admins can review access requests.</p>;
  }
  if (status === "error") {
    return (
      <div>
        <p role="alert">Admin requests could not be loaded.</p>
        <button
          onClick={() => {
            setStatus("loading");
            void refresh();
          }}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }
  if (requests.length === 0) {
    return <p>There are no pending platform-admin requests.</p>;
  }
  return (
    <>
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            <p>{request.requesterDisplayName}</p>
            <p>{request.groupName}</p>
            <p>
              <button
                disabled={busyId === request.id}
                onClick={() => {
                  void decide(request, "approved");
                }}
                type="button"
              >
                Approve
              </button>
              <button
                disabled={busyId === request.id}
                onClick={() => {
                  void decide(request, "rejected");
                }}
                type="button"
              >
                Reject
              </button>
            </p>
          </li>
        ))}
      </ul>
      {message === null ? null : <p role="status">{message}</p>}
    </>
  );
}
```

Replace the stub at `apps/web/app/admin/access-requests/page.tsx`:

```tsx
import { AdminDecisionPanel } from "../../../src/features/access/admin-decision-panel";

/** Platform-admin screen for approving or rejecting pending platform-admin requests. */
export default function AccessRequestsPage() {
  return <AdminDecisionPanel />;
}
```

- [ ] **Step 4: Add the admin layout platform-admin gate**

Read `apps/web/app/admin/layout.tsx` first. It currently renders the admin nav unconditionally. Modify it so non-platform-admins see an honest no-access state and no nav. Use the same `loadAppIdentity` + `verifySession` pattern that other server components in this app use (check `apps/web/app/(member)/team/page.tsx` if it has a server gate, otherwise use the pattern from `apps/web/app/api/access/...` adapted to a server component). Concretely:

```tsx
import { redirect } from "next/navigation";

import { AdminNavigation } from "../components/admin-navigation";
import { loadRuntimeIdentity } from "../../src/features/access/access-runtime";
import { verifySession } from "../../src/auth/verify-session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession(await cookies());
  const identity = await loadRuntimeIdentity(session);
  if (!identity.roles.includes("platform-admin")) {
    redirect("/");
  }
  return (
    <div>
      <AdminNavigation />
      {children}
    </div>
  );
}
```

If the existing layout reads cookies via Next's `cookies()` import, keep that import. If it doesn't (and the existing layout is a plain client component), follow the existing pattern instead — read the file and match what is there. The goal is one server-side gate; do not invent a new session-reading pattern.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace @ordah-please/web -- admin-decision-panel`
Expected: PASS.

Also run: `npm run typecheck --workspace @ordah-please/web && npm run lint --workspace @ordah-please/web`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/access/admin-decision-panel.tsx \
        apps/web/src/features/access/admin-decision-panel.test.tsx \
        apps/web/app/admin/access-requests/page.tsx \
        apps/web/app/admin/layout.tsx
git commit -m "feat(web): replace V1-06 admin access-requests stub with real decision UI"
```

---

## Task 7: Mobile UI — admin route and Home card

**Files:**
- Create: `apps/mobile/app/admin/access-requests.tsx`
- Create: `apps/mobile/src/features/access/admin-decision-panel.tsx`
- Modify: `apps/mobile/app/(member)/index.tsx`
- Test: `apps/mobile/__tests__/admin-decision-panel.test.tsx`
- Test: `apps/mobile/__tests__/home-admin-card.test.tsx`

- [ ] **Step 1: Write the failing mobile panel test**

Create `apps/mobile/__tests__/admin-decision-panel.test.tsx`. Match the Jest + React Native Testing Library pattern used in `apps/mobile/__tests__/invitation-onboarding.test.tsx` (read that file first if needed).

```tsx
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import React from "react";

import { AdminDecisionPanel } from "../src/features/access/admin-decision-panel";

jest.mock("../src/auth/authenticated-request", () => ({
  buildAuthenticatedRequestInit: (cookie: string, init: RequestInit) => ({
    ...init,
    headers: { ...init.headers, cookie },
  }),
}));

describe("AdminDecisionPanel", () => {
  it("renders an empty state when there are no pending requests", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { requests: [] } }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;
    const { getByText } = render(<AdminDecisionPanel cookie="session=abc" />);
    await waitFor(() =>
      expect(getByText(/no pending platform-admin requests/i)).toBeTruthy(),
    );
  });

  it("renders one card per pending request and approves on tap", async () => {
    const fetchMock = jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/pending")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              requests: [
                {
                  id: "req-1",
                  requesterUserId: "usr-1",
                  requesterDisplayName: "Owner Riley",
                  groupId: "grp-1",
                  groupName: "Riley's Group",
                  status: "pending",
                  createdAt: "2026-07-28T08:00:00.000Z",
                },
              ],
            },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          data: { requestId: "req-1", status: "approved" },
        }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { getByText, queryByText } = render(
      <AdminDecisionPanel cookie="session=abc" />,
    );
    await waitFor(() => expect(getByText("Owner Riley")).toBeTruthy());
    fireEvent.press(getByText(/approve/i));
    await waitFor(() =>
      expect(queryByText("Owner Riley")).toBeNull(),
    );
  });
});
```

- [ ] **Step 2: Write the failing Home-card test**

Create `apps/mobile/__tests__/home-admin-card.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import React from "react";

import { HomeAdminCard } from "../src/features/access/home-admin-card";

describe("HomeAdminCard", () => {
  it("renders a navigation card when the user is a platform admin", () => {
    const { getByText } = render(
      <HomeAdminCard
        isPlatformAdmin
        pendingCount={3}
        onOpen={() => undefined}
      />,
    );
    expect(getByText(/platform-admin requests/i)).toBeTruthy();
    expect(getByText(/3 pending/i)).toBeTruthy();
  });

  it("renders nothing when the user is not a platform admin", () => {
    const { toJSON } = render(
      <HomeAdminCard
        isPlatformAdmin={false}
        pendingCount={0}
        onOpen={() => undefined}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace @ordah-please/mobile -- admin-decision-panel home-admin-card`
Expected: FAIL — neither component exists.

- [ ] **Step 4: Implement the mobile panel and Home card**

Create `apps/mobile/src/features/access/admin-decision-panel.tsx` (mobile equivalent of the web panel, using React Native primitives and `buildAuthenticatedRequestInit`):

```tsx
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { buildAuthenticatedRequestInit } from "../../auth/authenticated-request";

type PendingRequest = Readonly<{
  id: string;
  requesterDisplayName: string;
  groupName: string;
  status: "pending";
}>;

type Status = "loading" | "ready" | "error";

async function readData(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(response.status === 403 ? "forbidden" : "failed");
  }
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value)
  ) {
    throw new Error("failed");
  }
  return (value as { data: unknown }).data;
}

function parseList(value: unknown): readonly PendingRequest[] {
  if (typeof value !== "object" || value === null || !("requests" in value)) {
    throw new Error("failed");
  }
  const list = (value as { requests: unknown }).requests;
  if (!Array.isArray(list)) {
    throw new Error("failed");
  }
  return list.map((entry) => {
    const row = entry as Partial<PendingRequest>;
    if (
      typeof row.id !== "string" ||
      typeof row.requesterDisplayName !== "string" ||
      typeof row.groupName !== "string" ||
      row.status !== "pending"
    ) {
      throw new Error("failed");
    }
    return row as PendingRequest;
  });
}

interface AdminDecisionPanelProps {
  cookie: string;
}

export function AdminDecisionPanel({ cookie }: AdminDecisionPanelProps) {
  const [requests, setRequests] = useState<readonly PendingRequest[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const actionInFlight = useRef(false);

  const apiBase = process.env.EXPO_PUBLIC_API_URL;

  const refresh = async () => {
    try {
      const parsed = parseList(
        await readData(
          await fetch(
            `${apiBase}/api/access/admin-requests/pending`,
            buildAuthenticatedRequestInit(cookie, { method: "GET" }),
          ),
        ),
      );
      setRequests(parsed);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const decide = async (
    request: PendingRequest,
    decision: "approved" | "rejected",
  ) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusyId(request.id);
    setMessage(null);
    try {
      await readData(
        await fetch(
          `${apiBase}/api/access/admin-requests/decide`,
          buildAuthenticatedRequestInit(cookie, {
            body: JSON.stringify({ requestId: request.id, decision }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }),
        ),
      );
      setRequests((current) => current.filter((entry) => entry.id !== request.id));
    } catch {
      setMessage(`The ${decision} action could not be completed.`);
    } finally {
      actionInFlight.current = false;
      setBusyId(null);
    }
  };

  if (status === "loading") {
    return <ActivityIndicator accessibilityLabel="Loading admin requests" />;
  }
  if (status === "error") {
    return (
      <View>
        <Text>Admin requests could not be loaded.</Text>
        <Pressable onPress={() => {
          setStatus("loading");
          void refresh();
        }}>
          <Text>Try again</Text>
        </Pressable>
      </View>
    );
  }
  if (requests.length === 0) {
    return <Text>There are no pending platform-admin requests.</Text>;
  }
  return (
    <View>
      {requests.map((request) => (
        <View key={request.id}>
          <Text>{request.requesterDisplayName}</Text>
          <Text>{request.groupName}</Text>
          <Pressable
            disabled={busyId === request.id}
            onPress={() => {
              void decide(request, "approved");
            }}
          >
            <Text>Approve</Text>
          </Pressable>
          <Pressable
            disabled={busyId === request.id}
            onPress={() => {
              void decide(request, "rejected");
            }}
          >
            <Text>Reject</Text>
          </Pressable>
        </View>
      ))}
      {message === null ? null : <Text>{message}</Text>}
    </View>
  );
}
```

Create `apps/mobile/src/features/access/home-admin-card.tsx`:

```tsx
import React from "react";
import { Pressable, Text, View } from "react-native";

interface HomeAdminCardProps {
  isPlatformAdmin: boolean;
  pendingCount: number;
  onOpen: () => void;
}

export function HomeAdminCard({
  isPlatformAdmin,
  pendingCount,
  onOpen,
}: HomeAdminCardProps) {
  if (!isPlatformAdmin) {
    return null;
  }
  const body =
    pendingCount === 0
      ? "No pending requests"
      : `${pendingCount} pending`;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button">
      <View>
        <Text>Platform-admin requests</Text>
        <Text>{body}</Text>
      </View>
    </Pressable>
  );
}
```

Create the mobile route `apps/mobile/app/admin/access-requests.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";

import { AdminDecisionPanel } from "../../src/features/access/admin-decision-panel";
import { getMobileAuthClient, readMobileSessionCookie } from "../../src/auth/auth-client";

export default function AdminAccessRequestsScreen() {
  const router = useRouter();
  const [cookie, setCookie] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    try {
      setCookie(readMobileSessionCookie(getMobileAuthClient()));
    } catch {
      setForbidden(true);
    }
  }, []);

  if (forbidden) {
    return (
      <View>
        <Text>Only platform admins can review access requests.</Text>
      </View>
    );
  }
  if (cookie === null) {
    return null;
  }
  return <AdminDecisionPanel cookie={cookie} />;
}
```

Modify `apps/mobile/app/(member)/index.tsx` to render the Home card at the top. The Home screen currently is a stub (`ShellScreen`). Replace it with a minimal screen that loads identity (using the same mobile auth client pattern) and conditionally renders the card:

```tsx
import { CircleCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { ShellScreen } from "../../src/components/shell-screen";
import {
  getMobileAuthClient,
  readMobileSessionCookie,
} from "../../src/auth/auth-client";
import { HomeAdminCard } from "../../src/features/access/home-admin-card";

async function loadIdentity(cookie: string): Promise<{
  isPlatformAdmin: boolean;
  pendingCount: number;
}> {
  const apiBase = process.env.EXPO_PUBLIC_API_URL;
  const response = await fetch(
    `${apiBase}/api/identity/me`,
    { headers: { cookie }, credentials: "omit" },
  );
  if (!response.ok) {
    return { isPlatformAdmin: false, pendingCount: 0 };
  }
  const value = await response.json();
  const data = (value as { data?: { isPlatformAdmin?: boolean; pendingAdminRequestCount?: number } }).data;
  return {
    isPlatformAdmin: data?.isPlatformAdmin === true,
    pendingCount: data?.pendingAdminRequestCount ?? 0,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const [card, setCard] = useState<{
    isPlatformAdmin: boolean;
    pendingCount: number;
  } | null>(null);

  useEffect(() => {
    try {
      const cookie = readMobileSessionCookie(getMobileAuthClient());
      void loadIdentity(cookie).then(setCard);
    } catch {
      setCard({ isPlatformAdmin: false, pendingCount: 0 });
    }
  }, []);

  return (
    <View>
      {card === null ? (
        <ActivityIndicator accessibilityLabel="Loading home" />
      ) : (
        <HomeAdminCard
          isPlatformAdmin={card.isPlatformAdmin}
          pendingCount={card.pendingCount}
          onOpen={() => router.push("/admin/access-requests")}
        />
      )}
      <ShellScreen
        description="Active orders and restaurant updates will appear here."
        emptyTitle="Nothing needs your attention yet"
        icon={CircleCheck}
        title="Your home"
      />
    </View>
  );
}
```

Note: the `/api/identity/me` route does not yet exist. Add it as part of this task — it is a thin GET endpoint that returns `{ isPlatformAdmin, pendingAdminRequestCount }` for the signed-in user. Create `apps/web/app/api/identity/me/route.ts`:

```ts
import { createIdentityMeHandler } from "../../../../src/features/access/identity-route-handlers";
import { accessRuntime } from "../../../../src/features/access/access-runtime";

export const GET = createIdentityMeHandler({
  loadIdentity: accessRuntime.loadIdentity,
  countPendingAdminRequests: accessRuntime.listPendingAdminRequests,
  verifySession: accessRuntime.verifySession,
});
```

And in `apps/web/src/features/access/access-route-handlers.ts` add the factory:

```ts
export interface IdentityMeHandlerDependencies {
  readonly loadIdentity: (session: VerifiedSession) => MaybePromise<AppIdentity>;
  readonly countPendingAdminRequests: () => Promise<readonly unknown[]>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

export function createIdentityMeHandler(
  dependencies: IdentityMeHandlerDependencies,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      undefined,
      { isPlatformAdmin: boolean; pendingAdminRequestCount: number }
    >(
      request,
      {
        authorize: () => true,
        execute: async ({ identity }) => {
          const pending = await dependencies.countPendingAdminRequests();
          return {
            isPlatformAdmin: identity.roles.includes("platform-admin"),
            pendingAdminRequestCount: pending.length,
          };
        },
        validate: () => undefined,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}
```

This adds a fifth handler factory. It is used by the mobile Home screen only.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace @ordah-please/mobile`
Expected: PASS — new mobile tests pass and existing 7 suites remain green.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/admin/access-requests.tsx \
        apps/mobile/app/\(member\)/index.tsx \
        apps/mobile/src/features/access/admin-decision-panel.tsx \
        apps/mobile/src/features/access/home-admin-card.tsx \
        apps/mobile/__tests__/admin-decision-panel.test.tsx \
        apps/mobile/__tests__/home-admin-card.test.tsx \
        apps/web/app/api/identity/me/route.ts \
        apps/web/src/features/access/access-route-handlers.ts \
        apps/web/src/features/access/access-route-handlers.test.ts
git commit -m "feat(mobile): add V1-06 platform-admin decision route and Home card"
```

---

## Task 8: Tracker update and full task-branch verification

**Files:**
- Modify: `context/progress-tracker.md`

- [ ] **Step 1: Update the tracker**

In `context/progress-tracker.md`:

- Tick the V1-06 line under "Pending V1 Implementation Tasks":
  ```
  - [x] V1-06 Implement platform-admin approval and limited mobile-admin permissions
  ```
- Add a new pending line for V1-06B immediately after V1-06:
  ```
  - [ ] V1-06B Bring mobile team screen to organizer parity
  ```
- Under "Completed V1 Tasks" add:
  ```
  - [x] V1-06 platform-admin approve/reject decide flow, web decision screen, mobile decision route, and platform-admin Home card
  ```
- Update "Current Goal" to:
  ```
  - Begin V1-06B mobile team organizer parity from the reviewed V1-06 boundary.
  ```
- Add an evidence paragraph under "Latest V1 Completion Evidence" describing what V1-06 shipped, the audit actions, the idempotency keys, the per-route platform-admin gate, and the live acceptance result.

- [ ] **Step 2: Run the full V1-06 verification on the task branch**

Run each of these from the repository root. All must pass before squash-merge.

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm test
npm run test:provider    # if the workspace defines this script; otherwise run the provider integration suites explicitly
npm run android:export   # Expo export for Android
npm run build:web        # Next.js production build
git diff --check
```

Expected:
- Provider-free Vitest suites include the new contracts, service, route-handler, and web panel tests.
- Provider-backed suites include the new repository integration tests against rollback-only temporary schemas.
- All 8 mobile Jest suites pass (existing 7 + 1 new).
- Type checks, lint, every package build, the Next.js production build (now including `/api/access/admin-requests/decide`, `/api/access/admin-requests/pending`, and `/api/identity/me`), and Android Expo export all pass.
- `git diff --check` clean.
- Built-client secret scan (run the existing scan script used in V1-04A/V1-05) reports no server variable names.

- [ ] **Step 3: Live acceptance (web + mobile)**

On the Vercel preview (or local dev with the development Neon branch):

1. As a group owner without `is_platform_admin`, submit a platform-admin request via the web Team screen. Verify one `pending` row exists in `admin_access_requests`.
2. As the existing platform admin, open `/admin/access-requests` on web. Verify the request appears with the requester's display name and group name.
3. Click Approve. Verify: the card disappears, `users.is_platform_admin = true` for the requester in Neon, and exactly one `platform_admin.approved` audit row exists with idempotency key `platform_admin:decide:<requestId>:approved`.
4. On mobile, sign in as the platform admin. Verify the Home card shows "1 pending" (or "0 pending" after the approval).
5. Tap the card. Verify the decision route loads. Submit a new pending request from a second owner and Reject it from mobile. Verify the `platform_admin.rejected` audit row exists and the requester's `is_platform_admin` stays `false`.
6. Self-decision guard: attempt to decide a request where the requester is the deciding admin. Verify the typed `cannot_decide_own_request` error surfaces, no audit row is written, and the request stays pending.

- [ ] **Step 4: Commit the tracker update**

```bash
git add context/progress-tracker.md
git commit -m "docs: mark V1-06 complete and queue V1-06B"
```

- [ ] **Step 5: Squash-merge to main**

Per `AGENTS.md`, after the task branch passes full verification:

```bash
git checkout main
git pull
git merge --squash task/V1-06-platform-admin-approval
git commit -m "V1-06 Implement platform-admin approval and limited mobile-admin permissions"
```

The commit title must match the tracker exactly. Do not preserve internal subtask progress commits on `main`.

---

## Self-Review

**Spec coverage check:**

- Decide flow (approve + reject, audit, idempotency, self-guard, already-decided, not-found) → Task 3 service tests cover each case.
- Pending list endpoint and web/mobile rendering → Tasks 5, 6, 7.
- Approve promotes `is_platform_admin` → Task 3 + Task 2 repository.
- Web admin nav gate → Task 6 layout change.
- Mobile decision route + Home card visible only to platform admins → Task 7.
- "Approach 1" per-route guard → Task 5 `isPlatformAdmin` helper, no middleware introduced.
- Optional reason on both decisions → Task 1 parser enforces "if present, non-empty and ≤500 chars"; absent is allowed.
- No new migration → Tasks 2 and 4 add repository methods and runtime wiring only, no schema file changes.
- No notification in V1-06 → none of the tasks add OneSignal/email work.
- V1-06B (mobile team parity) carved out → Task 8 adds the V1-06B pending line and updates the current goal.

**Placeholder scan:** No `TBD`, `TODO`, "implement later", or "similar to Task N" wording. Every code step shows the actual code. Where a step depends on reading the existing file first (admin layout session pattern, identity-access platform-admin setter), the step tells the engineer exactly which `grep` to run and what to do based on the result, rather than leaving a placeholder.

**Type consistency:**

- `DecideAdminAccessRequestCommand` defined in Task 3, used by Task 4 runtime and Task 5 handler.
- `AdminAccessRequestSummary` defined in Task 1 contracts, returned through Task 3 list function and parsed in Task 5 list handler.
- `appendOnce` carries `idempotencyKey` — matches the existing `AuditEventsRepository.appendOnce` signature read from `packages/db/src/repositories/audit-events.ts`.
- `isPlatformAdmin(identity)` helper name used consistently in Task 5 across interface docs and implementation guidance.
- The idempotency key format `platform_admin:decide:<requestId>:<decision>` is identical in the spec, Task 3 service code, and Task 8 acceptance step.

**Open risks the integration owner should confirm before Task 2 starts:**

- Whether `ensureUserForAuthIdentity` in `identity-access.ts` already accepts an `isPlatformAdmin` flag, or whether the test fixture needs the `setPlatformAdminFlag` helper described in Task 2. The plan tells the engineer to grep first; if it already exists, skip the helper.
- Whether the existing `executeRoute` returns 403 or 401 when `authorize` returns false. The Task 5 tests assert 403 — verify against `apps/web/src/application/execute-route.ts` before writing the test, and adjust the assertion if it returns 401.
- The mobile Home screen reads `/api/identity/me`, which Task 7 also creates. If the project already has an identity endpoint with this shape, point the mobile Home at it instead of adding a new one. Run `grep -rn "api/identity" apps/` first.
