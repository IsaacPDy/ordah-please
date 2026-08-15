# Admin CRUD on Users and Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five Platform Admin actions on the Users & Permissions and Groups admin pages: add-user-to-group, remove-user-from-group, suspend-user, rename-group (admin-scoped), archive-group — each with audit event and Platform Admin authorization.

**Architecture:** Repository → Service → Route handler → API route, mirroring the existing `renameGroup` pipeline. Two new repository methods (`archiveUser`, `archiveGroup`) and one supporting lookup (`findUserById`) underpin five new service functions, five route handler factories, five thin API routes, and five admin modal components. UI calls `fetch` then `router.refresh()`.

**Tech Stack:** Next.js (App Router), React, TypeScript, drizzle-orm (Neon Postgres), vitest, @testing-library/react, Better Auth. No new dependencies. No new migrations.

**Progress:** Tasks 1–6 (repository methods, archived-group list filter, both runtime transaction helpers, both admin services with tests) are complete and committed — sections removed 2026-08-15. Tasks 7–20 (contract, route handlers, API routes, all UI) are also complete and committed. Only Task 21's manual browser verification and squash-merge remain.

---

## File Structure

### New files

**Repository / runtime / service / handlers:**
- `apps/web/src/features/users/users-admin-service.ts` — three admin user service functions
- `apps/web/src/features/users/users-admin-service.test.ts` — unit tests
- `apps/web/src/features/users/users-admin-route-handlers.ts` — three route handler factories
- `apps/web/src/features/users/users-admin-route-handlers.test.ts` — handler unit tests
- `apps/web/src/features/groups/groups-admin-service.ts` — two admin group service functions
- `apps/web/src/features/groups/groups-admin-service.test.ts` — unit tests
- `apps/web/src/features/groups/groups-admin-route-handlers.ts` — two route handler factories
- `apps/web/src/features/groups/groups-admin-route-handlers.test.ts` — handler unit tests

**Contracts:**
- `packages/contracts/src/users/user-requests.ts` — `parseAddUserToGroupRequest`
- `packages/contracts/src/users/user-requests.test.ts` — unit tests

**API routes (5):**
- `apps/web/app/api/admin/users/[userId]/suspend/route.ts`
- `apps/web/app/api/admin/users/[userId]/memberships/route.ts`
- `apps/web/app/api/admin/users/[userId]/memberships/[groupId]/remove/route.ts`
- `apps/web/app/api/admin/groups/[groupId]/rename/route.ts`
- `apps/web/app/api/admin/groups/[groupId]/archive/route.ts`

**UI components (5 dialogs + 1 row + 1 test):**
- `apps/web/app/admin/users/add-user-to-group-dialog.tsx`
- `apps/web/app/admin/users/confirm-suspend-dialog.tsx`
- `apps/web/app/admin/users/confirm-remove-membership-dialog.tsx`
- `apps/web/app/admin/groups/rename-group-dialog.tsx`
- `apps/web/app/admin/groups/archive-group-dialog.tsx`
- `apps/web/app/admin/groups/groups-admin-row.tsx`
- `apps/web/app/admin/groups/groups-admin-row.test.tsx`
- `apps/web/app/admin/groups/page.test.tsx`

**History:**
- `context/history/admin-users-groups-crud.md`

### Modified files

- `packages/db/src/repositories/identity-access.ts` — add `archiveUser`, `findUserById`
- `packages/db/src/repositories/group-access.ts` — add `archiveGroup`
- `packages/db/src/repositories/repositories.provider.integration.test.ts` — add test cases
- `apps/web/src/features/users/users-runtime.ts` — add `runUsersAdminTransaction` + 3 binding methods
- `apps/web/src/features/groups/group-runtime.ts` — add `runGroupsAdminTransaction` + 2 binding methods, filter archived groups from `listAllGroupsForAdmin`
- `packages/contracts/src/index.ts` — re-export `parseAddUserToGroupRequest`
- `apps/web/app/admin/users/page.tsx` — wire Add-user-to-group dialog, drop "future bundle" copy
- `apps/web/app/admin/users/users-admin-data.tsx` — also load groups, pass to view
- `apps/web/app/admin/users/users-admin-view.tsx` — accept `groups` prop, add Remove buttons, manage modal state, suspend activation
- `apps/web/app/admin/users/users-admin-view.test.tsx` — extend with action coverage
- `apps/web/app/admin/groups/page.tsx` — render `groups-admin-row` per row, change `<button>` to `<div>`

---

## Conventions used throughout

- **TDD discipline:** write the failing test, run it red, write the minimal code, run it green, commit. Each task lists the exact test command.
- **Commits:** conventional commit format (`feat(...)`, `test(...)`, `chore(...)`). One commit per task unless noted.
- **Test commands:**
  - Unit: `npm run test:unit -- <path>`
  - Provider integration: `npm run test:providers -- <path>`
  - Lint: `npm run lint`
  - Typecheck: `npm run typecheck`
  - Web build: `npm run build:web`
- **All files use 2-space indentation and double quotes for strings** (match existing files).
- **JSdoc comments** are short, imperative, and describe purpose — match existing files.

---

## Task 7: Contracts — `parseAddUserToGroupRequest`

**Files:**
- Create: `packages/contracts/src/users/user-requests.ts`
- Create: `packages/contracts/src/users/user-requests.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `packages/contracts/src/users/user-requests.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { parseAddUserToGroupRequest } from "./user-requests";
import { PublicApiError } from "../common/errors";

describe("parseAddUserToGroupRequest", () => {
  it("accepts a well-formed body", () => {
    expect(parseAddUserToGroupRequest({ groupId: "group-1" })).toEqual({
      groupId: "group-1",
    });
  });

  it("trims whitespace around the group id", () => {
    expect(parseAddUserToGroupRequest({ groupId: "  group-1  " })).toEqual({
      groupId: "group-1",
    });
  });

  it("rejects a missing groupId", () => {
    expect(() => parseAddUserToGroupRequest({})).toThrow(PublicApiError);
  });

  it("rejects an empty groupId", () => {
    expect(() => parseAddUserToGroupRequest({ groupId: "   " })).toThrow(
      PublicApiError,
    );
  });

  it("rejects a non-string groupId", () => {
    expect(() => parseAddUserToGroupRequest({ groupId: 42 })).toThrow(
      PublicApiError,
    );
  });

  it("strips unknown keys", () => {
    expect(
      parseAddUserToGroupRequest({ groupId: "group-1", extra: "ignored" }),
    ).toEqual({ groupId: "group-1" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:unit -- packages/contracts/src/users/user-requests.test.ts
```

Expected: fails because the validator doesn't exist.

- [ ] **Step 3: Implement the validator**

Create `packages/contracts/src/users/user-requests.ts`:

```typescript
import {
  parseStrictObject,
  parseString,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

export type AddUserToGroupRequest = Readonly<{ groupId: string }>;

/** Validates the body of POST /api/admin/users/[userId]/memberships. */
export function parseAddUserToGroupRequest(
  value: unknown,
): AddUserToGroupRequest {
  const object = parseStrictObject(value, "Add user to group request");
  rejectUnknownFields(object, ["groupId"], "Add user to group request");

  const groupId = parseString(object.groupId, "Group id").trim();
  if (groupId.length === 0) {
    throw new PublicApiError("INVALID_INPUT", "Group id is required.");
  }
  return { groupId };
}
```

Add the import for `PublicApiError`:

```typescript
import { PublicApiError } from "../common/errors.js";
```

(Confirm the exact path of `strict-boundary.js` and `errors.js` relative to the new `users/` folder — they're one level up.)

- [ ] **Step 4: Re-export from the contracts barrel**

Edit `packages/contracts/src/index.ts`. Add a line in the existing export group:

```typescript
export { parseAddUserToGroupRequest } from "./users/user-requests.js";
export type { AddUserToGroupRequest } from "./users/user-requests.js";
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test:unit -- packages/contracts/src/users/user-requests.test.ts
npm run typecheck
```

Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/users/ \
        packages/contracts/src/index.ts
git commit -m "feat(contracts): add parseAddUserToGroupRequest"
```

---

## Task 8: Route handlers — `users-admin-route-handlers.ts` (three handlers)

**Files:**
- Create: `apps/web/src/features/users/users-admin-route-handlers.ts`
- Create: `apps/web/src/features/users/users-admin-route-handlers.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `apps/web/src/features/users/users-admin-route-handlers.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";

import {
  createAddUserToGroupHandler,
  createRemoveUserFromGroupHandler,
  createSuspendUserHandler,
} from "./users-admin-route-handlers";

const adminIdentity = {
  authUserId: "auth-admin",
  userId: "admin-1",
  displayName: "Admin",
  email: "admin@example.test",
  imageUrl: null,
  isPlatformAdmin: true,
  memberships: [],
};

const regularIdentity = {
  ...adminIdentity,
  userId: "user-actor",
  isPlatformAdmin: false,
};

const baseDeps = {
  loadIdentity: () => adminIdentity,
  verifySession: () => ({
    authUserId: "auth-admin",
    displayName: "Admin",
    email: "admin@example.test",
    imageUrl: null,
  }),
  now: () => new Date("2026-08-13T12:00:00.000Z"),
};

describe("createSuspendUserHandler", () => {
  it("returns 200 and calls suspendUserAsAdmin on the happy path", async () => {
    const suspendUserAsAdmin = vi.fn(() => Promise.resolve({ userId: "user-2" }));
    const handler = createSuspendUserHandler({
      ...baseDeps,
      suspendUserAsAdmin,
    });
    const response = await handler(
      new Request("https://example.test/api/admin/users/user-2/suspend", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(suspendUserAsAdmin).toHaveBeenCalledWith({
      actorId: "admin-1",
      userId: "user-2",
      now: new Date("2026-08-13T12:00:00.000Z"),
    });
  });

  it("returns 403 when the actor is not a Platform Admin", async () => {
    const suspendUserAsAdmin = vi.fn(() =>
      Promise.reject(new PublicApiError("FORBIDDEN", "Access denied.")),
    );
    const handler = createSuspendUserHandler({
      ...baseDeps,
      loadIdentity: () => regularIdentity,
      suspendUserAsAdmin,
    });
    const response = await handler(
      new Request("https://example.test/api/admin/users/user-2/suspend", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 409 when the service throws CONFLICT", async () => {
    const suspendUserAsAdmin = vi.fn(() =>
      Promise.reject(
        new PublicApiError("CONFLICT", "You can't suspend your own account."),
      ),
    );
    const handler = createSuspendUserHandler({
      ...baseDeps,
      suspendUserAsAdmin,
    });
    const response = await handler(
      new Request("https://example.test/api/admin/users/user-2/suspend", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(409);
  });
});

describe("createAddUserToGroupHandler", () => {
  it("returns 200 on the happy path and parses the body", async () => {
    const addUserToGroupAsAdmin = vi.fn(() =>
      Promise.resolve({ groupId: "group-1", userId: "user-2" }),
    );
    const handler = createAddUserToGroupHandler({
      ...baseDeps,
      addUserToGroupAsAdmin,
    });
    const response = await handler(
      new Request("https://example.test/api/admin/users/user-2/memberships", {
        method: "POST",
        body: JSON.stringify({ groupId: "group-1" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(addUserToGroupAsAdmin).toHaveBeenCalledWith({
      actorId: "admin-1",
      userId: "user-2",
      groupId: "group-1",
    });
  });

  it("returns 400 when the body is missing groupId", async () => {
    const addUserToGroupAsAdmin = vi.fn();
    const handler = createAddUserToGroupHandler({
      ...baseDeps,
      addUserToGroupAsAdmin,
    });
    const response = await handler(
      new Request("https://example.test/api/admin/users/user-2/memberships", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(400);
    expect(addUserToGroupAsAdmin).not.toHaveBeenCalled();
  });
});

describe("createRemoveUserFromGroupHandler", () => {
  it("returns 200 on the happy path", async () => {
    const removeUserFromGroupAsAdmin = vi.fn(() =>
      Promise.resolve({ groupId: "group-1", userId: "user-2" }),
    );
    const handler = createRemoveUserFromGroupHandler({
      ...baseDeps,
      removeUserFromGroupAsAdmin,
    });
    const response = await handler(
      new Request(
        "https://example.test/api/admin/users/user-2/memberships/group-1/remove",
        { method: "POST" },
      ),
    );
    expect(response.status).toBe(200);
    expect(removeUserFromGroupAsAdmin).toHaveBeenCalledWith({
      actorId: "admin-1",
      userId: "user-2",
      groupId: "group-1",
      now: new Date("2026-08-13T12:00:00.000Z"),
    });
  });

  it("returns 409 when removing an owner", async () => {
    const removeUserFromGroupAsAdmin = vi.fn(() =>
      Promise.reject(
        new PublicApiError("CONFLICT", "Reassign ownership first."),
      ),
    );
    const handler = createRemoveUserFromGroupHandler({
      ...baseDeps,
      removeUserFromGroupAsAdmin,
    });
    const response = await handler(
      new Request(
        "https://example.test/api/admin/users/user-2/memberships/group-1/remove",
        { method: "POST" },
      ),
    );
    expect(response.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:unit -- apps/web/src/features/users/users-admin-route-handlers.test.ts
```

Expected: fails because the handler file doesn't exist.

- [ ] **Step 3: Implement the route handlers**

Create `apps/web/src/features/users/users-admin-route-handlers.ts`:

```typescript
import { parseAddUserToGroupRequest } from "@ordah-please/contracts";

import { executeRoute } from "../route-execution/execute-route";
// Note: confirm the exact import path of executeRoute. The explore showed it lives in execute-route.ts — check `apps/web/src/features/` for the file.
import { parseTrustedMutationRequest } from "../route-execution/verify-trusted-mutation-request";
// Confirm path against createRenameGroupHandler imports.

import type {
  AppIdentity,
} from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";

interface UsersAdminHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
  readonly now: () => Date;
}

interface SuspendUserDependencies extends UsersAdminHandlerDependencies {
  readonly suspendUserAsAdmin: (command: {
    readonly actorId: string;
    readonly userId: string;
    readonly now: Date;
  }) => Promise<{ readonly userId: string }>;
}

interface AddUserToGroupDependencies extends UsersAdminHandlerDependencies {
  readonly addUserToGroupAsAdmin: (command: {
    readonly actorId: string;
    readonly userId: string;
    readonly groupId: string;
  }) => Promise<{ readonly groupId: string; readonly userId: string }>;
}

interface RemoveUserFromGroupDependencies extends UsersAdminHandlerDependencies {
  readonly removeUserFromGroupAsAdmin: (command: {
    readonly actorId: string;
    readonly userId: string;
    readonly groupId: string;
    readonly now: Date;
  }) => Promise<{ readonly groupId: string; readonly userId: string }>;
}

function requirePlatformAdminInRoute(identity: AppIdentity): void {
  if (!identity.isPlatformAdmin) {
    throw new PublicApiError("FORBIDDEN", "Access denied.");
  }
}

export function createSuspendUserHandler(
  dependencies: SuspendUserDependencies,
  getUserId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ userId: string }>, { readonly userId: string }>(
      request,
      {
        authorize: ({ identity }) => {
          requirePlatformAdminInRoute(identity);
          return true;
        },
        execute: ({ identity, input }) =>
          dependencies.suspendUserAsAdmin({
            actorId: identity.userId,
            userId: input.userId,
            now: dependencies.now(),
          }),
        validate: (incomingRequest) =>
          Promise.resolve({ userId: getUserId(incomingRequest) ?? "" }),
        verifyRequest: parseTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}

export function createAddUserToGroupHandler(
  dependencies: AddUserToGroupDependencies,
  getUserId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ userId: string; groupId: string }>,
      { readonly groupId: string; readonly userId: string }
    >(request, {
      authorize: ({ identity }) => {
        requirePlatformAdminInRoute(identity);
        return true;
      },
      execute: ({ identity, input }) =>
        dependencies.addUserToGroupAsAdmin({
          actorId: identity.userId,
          userId: input.userId,
          groupId: input.groupId,
        }),
      validate: async (incomingRequest) => ({
        userId: getUserId(incomingRequest) ?? "",
        ...(await parseRequestBody(incomingRequest, parseAddUserToGroupRequest)),
      }),
      verifyRequest: parseTrustedMutationRequest,
    }, {
      loadIdentity: dependencies.loadIdentity,
      verifySession: () => dependencies.verifySession(request),
    });
}

export function createRemoveUserFromGroupHandler(
  dependencies: RemoveUserFromGroupDependencies,
  getUserId: (request: Request) => string | undefined,
  getGroupId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ userId: string; groupId: string }>,
      { readonly groupId: string; readonly userId: string }
    >(request, {
      authorize: ({ identity }) => {
        requirePlatformAdminInRoute(identity);
        return true;
      },
      execute: ({ identity, input }) =>
        dependencies.removeUserFromGroupAsAdmin({
          actorId: identity.userId,
          userId: input.userId,
          groupId: input.groupId,
          now: dependencies.now(),
        }),
      validate: (incomingRequest) =>
        Promise.resolve({
          userId: getUserId(incomingRequest) ?? "",
          groupId: getGroupId(incomingRequest) ?? "",
        }),
      verifyRequest: parseTrustedMutationRequest,
    }, {
      loadIdentity: dependencies.loadIdentity,
      verifySession: () => dependencies.verifySession(request),
    });
}
```

Add the imports the file needs (adjusting paths as you discover them by reading `group-route-handlers.ts`):

```typescript
import { PublicApiError } from "@ordah-please/contracts";
import { parseRequestBody } from "../route-execution/parse-request-body";
// Confirm exact path. The existing createRenameGroupHandler uses parseRequestBody.
```

**Important:** Read `apps/web/src/features/groups/group-route-handlers.ts` end-to-end first, then mirror its exact import paths for: `executeRoute`, `parseRequestBody`, `parseTrustedMutationRequest`, `VerifiedSession`, `AppIdentity`. The paths above are placeholders — correct them in the actual implementation.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:unit -- apps/web/src/features/users/users-admin-route-handlers.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/users/users-admin-route-handlers.ts \
        apps/web/src/features/users/users-admin-route-handlers.test.ts
git commit -m "feat(web): add users-admin route handlers"
```

---

## Task 9: Route handlers — `groups-admin-route-handlers.ts` (two handlers)

**Files:**
- Create: `apps/web/src/features/groups/groups-admin-route-handlers.ts`
- Create: `apps/web/src/features/groups/groups-admin-route-handlers.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `apps/web/src/features/groups/groups-admin-route-handlers.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";

import {
  createArchiveGroupHandler,
  createRenameGroupAsAdminHandler,
} from "./groups-admin-route-handlers";

const adminIdentity = {
  authUserId: "auth-admin",
  userId: "admin-1",
  displayName: "Admin",
  email: "admin@example.test",
  imageUrl: null,
  isPlatformAdmin: true,
  memberships: [],
};

const baseDeps = {
  loadIdentity: () => adminIdentity,
  verifySession: () => ({
    authUserId: "auth-admin",
    displayName: "Admin",
    email: "admin@example.test",
    imageUrl: null,
  }),
  now: () => new Date("2026-08-13T12:00:00.000Z"),
};

describe("createRenameGroupAsAdminHandler", () => {
  it("returns 200 and calls renameGroupAsAdmin on the happy path", async () => {
    const renameGroupAsAdmin = vi.fn(() =>
      Promise.resolve({ groupId: "group-1", name: "New Name" }),
    );
    const handler = createRenameGroupAsAdminHandler(
      {
        ...baseDeps,
        renameGroupAsAdmin,
      },
      () => "group-1",
    );
    const response = await handler(
      new Request("https://example.test/api/admin/groups/group-1/rename", {
        method: "POST",
        body: JSON.stringify({ name: "New Name" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(renameGroupAsAdmin).toHaveBeenCalledWith({
      actorId: "admin-1",
      groupId: "group-1",
      name: "New Name",
    });
  });

  it("returns 409 when the group is archived", async () => {
    const renameGroupAsAdmin = vi.fn(() =>
      Promise.reject(new PublicApiError("CONFLICT", "Group is archived.")),
    );
    const handler = createRenameGroupAsAdminHandler(
      { ...baseDeps, renameGroupAsAdmin },
      () => "group-1",
    );
    const response = await handler(
      new Request("https://example.test/api/admin/groups/group-1/rename", {
        method: "POST",
        body: JSON.stringify({ name: "New Name" }),
      }),
    );
    expect(response.status).toBe(409);
  });
});

describe("createArchiveGroupHandler", () => {
  it("returns 200 on the happy path", async () => {
    const archiveGroupAsAdmin = vi.fn(() =>
      Promise.resolve({ groupId: "group-1" }),
    );
    const handler = createArchiveGroupHandler(
      { ...baseDeps, archiveGroupAsAdmin },
      () => "group-1",
    );
    const response = await handler(
      new Request("https://example.test/api/admin/groups/group-1/archive", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(archiveGroupAsAdmin).toHaveBeenCalledWith({
      actorId: "admin-1",
      groupId: "group-1",
      now: new Date("2026-08-13T12:00:00.000Z"),
    });
  });

  it("returns 409 when the group is already archived", async () => {
    const archiveGroupAsAdmin = vi.fn(() =>
      Promise.reject(
        new PublicApiError("CONFLICT", "Group is already archived."),
      ),
    );
    const handler = createArchiveGroupHandler(
      { ...baseDeps, archiveGroupAsAdmin },
      () => "group-1",
    );
    const response = await handler(
      new Request("https://example.test/api/admin/groups/group-1/archive", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:unit -- apps/web/src/features/groups/groups-admin-route-handlers.test.ts
```

Expected: fails because the file doesn't exist.

- [ ] **Step 3: Implement the route handlers**

Create `apps/web/src/features/groups/groups-admin-route-handlers.ts`. Mirror Task 8's pattern exactly. Use `parseRenameGroupRequest` from `@ordah-please/contracts` for the rename body; the archive handler takes no body.

```typescript
import {
  parseRenameGroupRequest,
  PublicApiError,
} from "@ordah-please/contracts";

import { executeRoute } from "../route-execution/execute-route";
// (Adjust import paths to match group-route-handlers.ts exactly.)
import { parseRequestBody } from "../route-execution/parse-request-body";
import { parseTrustedMutationRequest } from "../route-execution/verify-trusted-mutation-request";
import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";

interface GroupsAdminHandlerDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
  readonly now: () => Date;
}

interface RenameGroupAsAdminDependencies extends GroupsAdminHandlerDependencies {
  readonly renameGroupAsAdmin: (command: {
    readonly actorId: string;
    readonly groupId: string;
    readonly name: string;
  }) => Promise<{ readonly groupId: string; readonly name: string }>;
}

interface ArchiveGroupDependencies extends GroupsAdminHandlerDependencies {
  readonly archiveGroupAsAdmin: (command: {
    readonly actorId: string;
    readonly groupId: string;
    readonly now: Date;
  }) => Promise<{ readonly groupId: string }>;
}

function requirePlatformAdminInRoute(identity: AppIdentity): void {
  if (!identity.isPlatformAdmin) {
    throw new PublicApiError("FORBIDDEN", "Access denied.");
  }
}

export function createRenameGroupAsAdminHandler(
  dependencies: RenameGroupAsAdminDependencies,
  getGroupId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<
      Readonly<{ groupId: string; name: string }>,
      { readonly groupId: string; readonly name: string }
    >(request, {
      authorize: ({ identity }) => {
        requirePlatformAdminInRoute(identity);
        return true;
      },
      execute: ({ identity, input }) =>
        dependencies.renameGroupAsAdmin({
          actorId: identity.userId,
          groupId: input.groupId,
          name: input.name,
        }),
      validate: async (incomingRequest) => ({
        groupId: getGroupId(incomingRequest) ?? "",
        ...(await parseRequestBody(incomingRequest, parseRenameGroupRequest)),
      }),
      verifyRequest: parseTrustedMutationRequest,
    }, {
      loadIdentity: dependencies.loadIdentity,
      verifySession: () => dependencies.verifySession(request),
    });
}

export function createArchiveGroupHandler(
  dependencies: ArchiveGroupDependencies,
  getGroupId: (request: Request) => string | undefined,
): (request: Request) => Promise<Response> {
  return (request) =>
    executeRoute<Readonly<{ groupId: string }>, { readonly groupId: string }>(
      request,
      {
        authorize: ({ identity }) => {
          requirePlatformAdminInRoute(identity);
          return true;
        },
        execute: ({ identity, input }) =>
          dependencies.archiveGroupAsAdmin({
            actorId: identity.userId,
            groupId: input.groupId,
            now: dependencies.now(),
          }),
        validate: (incomingRequest) =>
          Promise.resolve({ groupId: getGroupId(incomingRequest) ?? "" }),
        verifyRequest: parseTrustedMutationRequest,
      },
      {
        loadIdentity: dependencies.loadIdentity,
        verifySession: () => dependencies.verifySession(request),
      },
    );
}
```

**Reminder:** confirm `executeRoute`, `parseRequestBody`, `parseTrustedMutationRequest` import paths against `apps/web/src/features/groups/group-route-handlers.ts` before finalizing.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:unit -- apps/web/src/features/groups/groups-admin-route-handlers.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/groups/groups-admin-route-handlers.ts \
        apps/web/src/features/groups/groups-admin-route-handlers.test.ts
git commit -m "feat(web): add groups-admin route handlers"
```

---

## Task 10: API routes — five thin pass-throughs

**Files:**
- Create: `apps/web/app/api/admin/users/[userId]/suspend/route.ts`
- Create: `apps/web/app/api/admin/users/[userId]/memberships/route.ts`
- Create: `apps/web/app/api/admin/users/[userId]/memberships/[groupId]/remove/route.ts`
- Create: `apps/web/app/api/admin/groups/[groupId]/rename/route.ts`
- Create: `apps/web/app/api/admin/groups/[groupId]/archive/route.ts`

- [ ] **Step 1: Create the suspend route**

`apps/web/app/api/admin/users/[userId]/suspend/route.ts`:

```typescript
import {
  createSuspendUserHandler,
} from "../../../../../../src/features/users/users-admin-route-handlers";
import { usersRuntime } from "../../../../../../src/features/users/users-runtime";

/** Suspends a user (sets archivedAt). Platform Admin only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createSuspendUserHandler(
    {
      suspendUserAsAdmin: usersRuntime.suspendUserAsAdmin,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
      now: usersRuntime.now ?? groupRuntime.now,
    },
    () => params.userId,
  )(request);
}
```

**Note:** the existing `groupRuntime` exposes `loadIdentity`, `verifySession`, and `now`. The `usersRuntime` may not yet expose them — confirm. If `usersRuntime` doesn't expose `now` or `loadIdentity`, import from `groupRuntime` (already in the codebase) or add them to `usersRuntime` in Task 3.

Adjust the relative-path prefix to match the file depth (`../../../../../../` — count carefully: `app/api/admin/users/[userId]/suspend/route.ts` is 7 levels deep from `src/`).

- [ ] **Step 2: Create the memberships (add-to-group) route**

`apps/web/app/api/admin/users/[userId]/memberships/route.ts`:

```typescript
import { createAddUserToGroupHandler } from "../../../../../../src/features/users/users-admin-route-handlers";
import { usersRuntime } from "../../../../../../src/features/users/users-runtime";
import { groupRuntime } from "../../../../../../src/features/groups/group-runtime";

/** Adds the user to a group as a Member. Platform Admin only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createAddUserToGroupHandler(
    {
      addUserToGroupAsAdmin: usersRuntime.addUserToGroupAsAdmin,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
      now: groupRuntime.now,
    },
    () => params.userId,
  )(request);
}
```

- [ ] **Step 3: Create the remove-membership route**

`apps/web/app/api/admin/users/[userId]/memberships/[groupId]/remove/route.ts`:

```typescript
import { createRemoveUserFromGroupHandler } from "../../../../../../../../../src/features/users/users-admin-route-handlers";
import { usersRuntime } from "../../../../../../../../../src/features/users/users-runtime";
import { groupRuntime } from "../../../../../../../../../src/features/groups/group-runtime";

/** Removes the user from a group. Platform Admin only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string; groupId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createRemoveUserFromGroupHandler(
    {
      removeUserFromGroupAsAdmin: usersRuntime.removeUserFromGroupAsAdmin,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
      now: groupRuntime.now,
    },
    () => params.userId,
    () => params.groupId,
  )(request);
}
```

- [ ] **Step 4: Create the admin rename-group route**

`apps/web/app/api/admin/groups/[groupId]/rename/route.ts`:

```typescript
import { createRenameGroupAsAdminHandler } from "../../../../../../src/features/groups/groups-admin-route-handlers";
import { groupRuntime } from "../../../../../../src/features/groups/group-runtime";

/** Renames a group as Platform Admin (bypasses group-owner check). */
export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createRenameGroupAsAdminHandler(
    {
      renameGroupAsAdmin: groupRuntime.renameGroupAsAdmin,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
      now: groupRuntime.now,
    },
    () => params.groupId,
  )(request);
}
```

- [ ] **Step 5: Create the admin archive-group route**

`apps/web/app/api/admin/groups/[groupId]/archive/route.ts`:

```typescript
import { createArchiveGroupHandler } from "../../../../../../src/features/groups/groups-admin-route-handlers";
import { groupRuntime } from "../../../../../../src/features/groups/group-runtime";

/** Archives a group (sets archivedAt). Platform Admin only. */
export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
): Promise<Response> {
  const params = await context.params;
  return createArchiveGroupHandler(
    {
      archiveGroupAsAdmin: groupRuntime.archiveGroupAsAdmin,
      loadIdentity: groupRuntime.loadIdentity,
      verifySession: groupRuntime.verifySession,
      now: groupRuntime.now,
    },
    () => params.groupId,
  )(request);
}
```

- [ ] **Step 6: Run typecheck and the unit suite to confirm wiring**

```bash
npm run typecheck
npm run test:unit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/admin/
git commit -m "feat(web): add five admin API routes"
```

---

## Task 11: UI — `add-user-to-group-dialog.tsx`

**Files:**
- Create: `apps/web/app/admin/users/add-user-to-group-dialog.tsx`

- [ ] **Step 1: Implement the dialog**

Create the file. The dialog is self-contained: renders its own trigger button (matches `CreateGroupDialog` pattern), opens a portal modal with two dropdowns, calls fetch on submit.

```typescript
"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type { AdminUserSummary } from "../../../src/features/users/users-runtime";

interface AdminGroupOption {
  readonly groupId: string;
  readonly name: string;
}

interface AddUserToGroupDialogProps {
  readonly users: readonly AdminUserSummary[];
  readonly groups: readonly AdminGroupOption[];
  readonly defaultUserId: string | null;
  readonly triggerLabel?: string;
}

interface ApiErrorBody {
  readonly error?: { readonly message?: string };
}

export function AddUserToGroupDialog({
  users,
  groups,
  defaultUserId,
  triggerLabel = "Add user to group",
}: AddUserToGroupDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState(defaultUserId ?? users[0]?.id ?? "");
  const [groupId, setGroupId] = useState(groups[0]?.groupId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  function openDialog() {
    setUserId(defaultUserId ?? users[0]?.id ?? "");
    setGroupId(groups[0]?.groupId ?? "");
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError(null);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/memberships`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ groupId }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error?.message ?? "Couldn't add the user. Try again.");
        return;
      }
      close();
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        className="admin-primary-button"
        onClick={openDialog}
        type="button"
      >
        {triggerLabel}
      </button>
      {open
        ? createPortal(
            <div
              className="admin-dialog-backdrop"
              data-testid="add-user-to-group-backdrop"
              onClick={(event) => {
                if (event.target === event.currentTarget && !submitting) {
                  close();
                }
              }}
            >
              <div
                aria-labelledby={titleId}
                aria-modal="true"
                className="admin-dialog"
                role="dialog"
              >
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}
                >
                  <div className="admin-dialog-header">
                    <h2 id={titleId} className="admin-dialog-title">
                      Add user to group
                    </h2>
                  </div>
                  <div className="admin-dialog-fields">
                    <label className="admin-field">
                      <span>User</span>
                      <select
                        onChange={(event) => setUserId(event.target.value)}
                        value={userId}
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-field">
                      <span>Group</span>
                      <select
                        onChange={(event) => setGroupId(event.target.value)}
                        value={groupId}
                      >
                        {groups.map((group) => (
                          <option key={group.groupId} value={group.groupId}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {error ? <p className="admin-error">{error}</p> : null}
                  </div>
                  <div className="admin-dialog-actions">
                    <button
                      className="admin-secondary-button"
                      disabled={submitting}
                      onClick={close}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="admin-primary-button"
                      disabled={submitting}
                      type="submit"
                    >
                      {submitting ? "Adding…" : "Add to group"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
```

- [ ] **Step 2: Run typecheck and lint**

```bash
npm run typecheck
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit (will be combined with the page wiring in Task 16)**

Skip the standalone commit — this component only becomes useful once wired in Task 16. Commit at end of Task 16.

---

## Task 12: UI — `confirm-suspend-dialog.tsx`

**Files:**
- Create: `apps/web/app/admin/users/confirm-suspend-dialog.tsx`

- [ ] **Step 1: Implement the dialog**

Create the file. This is a controlled dialog (parent passes `user` and `onClose`).

```typescript
"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type { AdminUserSummary } from "../../../src/features/users/users-runtime";

interface ConfirmSuspendDialogProps {
  readonly user: AdminUserSummary;
  readonly open: boolean;
  readonly onClose: () => void;
}

interface ApiErrorBody {
  readonly error?: { readonly message?: string };
}

export function ConfirmSuspendDialog({
  user,
  open,
  onClose,
}: ConfirmSuspendDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.id)}/suspend`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error?.message ?? "Couldn't suspend the user. Try again.");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const ownedGroups = user.memberships.filter((m) => m.role === "group-owner").length;

  return createPortal(
    <div
      className="admin-dialog-backdrop"
      data-testid="confirm-suspend-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-dialog"
        role="dialog"
      >
        <div className="admin-dialog-confirmation">
          <div className="admin-dialog-header">
            <h2 id={titleId} className="admin-dialog-title">
              Suspend {user.displayName}?
            </h2>
          </div>
          <p>
            They won&apos;t be able to sign in. Their past activity stays intact.
          </p>
          {ownedGroups > 0 ? (
            <p>
              {user.displayName} owns {ownedGroups} group
              {ownedGroups === 1 ? "" : "s"}; those groups will have no active
              owner.
            </p>
          ) : null}
          {error ? <p className="admin-error">{error}</p> : null}
          <div className="admin-dialog-actions">
            <button
              className="admin-secondary-button"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="admin-danger-button"
              disabled={submitting}
              onClick={() => void submit()}
              type="button"
            >
              {submitting ? "Suspending…" : "Suspend"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Typecheck and lint (deferred commit)**

Skip standalone commit; bundled with Task 15.

---

## Task 13: UI — `confirm-remove-membership-dialog.tsx`

**Files:**
- Create: `apps/web/app/admin/users/confirm-remove-membership-dialog.tsx`

- [ ] **Step 1: Implement the dialog**

```typescript
"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type {
  AdminUserMembership,
  AdminUserSummary,
} from "../../../src/features/users/users-runtime";

interface ConfirmRemoveMembershipDialogProps {
  readonly user: AdminUserSummary;
  readonly membership: AdminUserMembership;
  readonly open: boolean;
  readonly onClose: () => void;
}

interface ApiErrorBody {
  readonly error?: { readonly message?: string };
}

export function ConfirmRemoveMembershipDialog({
  user,
  membership,
  open,
  onClose,
}: ConfirmRemoveMembershipDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.id)}/memberships/${encodeURIComponent(membership.groupId)}/remove`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error?.message ?? "Couldn't remove the user. Try again.");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="admin-dialog-backdrop"
      data-testid="confirm-remove-membership-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-dialog"
        role="dialog"
      >
        <div className="admin-dialog-confirmation">
          <div className="admin-dialog-header">
            <h2 id={titleId} className="admin-dialog-title">
              Remove {user.displayName} from {membership.groupName}?
            </h2>
          </div>
          <p>They&apos;ll need a new invite to rejoin.</p>
          {error ? <p className="admin-error">{error}</p> : null}
          <div className="admin-dialog-actions">
            <button
              className="admin-secondary-button"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="admin-danger-button"
              disabled={submitting}
              onClick={() => void submit()}
              type="button"
            >
              {submitting ? "Removing…" : "Remove"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Typecheck and lint (deferred commit)**

Skip standalone commit; bundled with Task 15.

---

## Task 14: UI — extend `users-admin-data.tsx` to load groups

**Files:**
- Modify: `apps/web/app/admin/users/users-admin-data.tsx`

- [ ] **Step 1: Update to fetch groups in parallel**

Replace the file contents with:

```typescript
import { groupRuntime } from "../../../src/features/groups/group-runtime";
import { usersRuntime } from "../../../src/features/users/users-runtime";

import { UsersAdminView } from "./users-admin-view";

/** Fetches the admin user list and active groups, renders the interactive view. */
export async function UsersAdminData() {
  const [users, groups] = await Promise.all([
    usersRuntime.listUsersForAdmin(),
    groupRuntime.listAllGroupsForAdmin(),
  ]);
  return (
    <UsersAdminView
      users={users}
      groups={groups.map((group) => ({
        groupId: group.groupId,
        name: group.name,
      }))}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: error because `UsersAdminView` doesn't accept a `groups` prop yet — that's resolved in Task 15.

---

## Task 15: UI — extend `users-admin-view.tsx` with `groups`, Remove buttons, modal state, suspend activation

**Files:**
- Modify: `apps/web/app/admin/users/users-admin-view.tsx`
- Modify: `apps/web/app/admin/users/users-admin-view.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Open `apps/web/app/admin/users/users-admin-view.test.tsx`. Extend with these tests inside the existing `describe` block:

```typescript
import { useRouter } from "next/navigation";

const mockRefresh = vi.fn();
const mockFetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

beforeEach(() => {
  mockRefresh.mockClear();
  mockFetch.mockClear();
  (globalThis as { fetch?: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
});

const groups = [
  { groupId: "group-friends", name: "Friends" },
  { groupId: "group-work", name: "Work" },
];

it("opens the add-user-to-group dialog when the trigger is clicked", async () => {
  render(<UsersAdminView users={users} groups={groups} />);
  fireEvent.click(screen.getByRole("button", { name: "Add user to group" }));
  expect(
    await screen.findByRole("heading", { name: "Add user to group" }),
  ).toBeInTheDocument();
});

it("removes a membership and refreshes on confirm", async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  render(<UsersAdminView users={users} groups={groups} />);
  fireEvent.click(screen.getByRole("button", { name: /Remove from Friends/i }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove" }),
  );
  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/users/user-alice/memberships/group-friends/remove",
      { method: "POST" },
    );
    expect(mockRefresh).toHaveBeenCalled();
  });
});

it("surfaces a 409 error inline in the remove-membership dialog", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ error: { message: "Reassign ownership first." } }),
  });
  render(<UsersAdminView users={users} groups={groups} />);
  fireEvent.click(screen.getByRole("button", { name: /Remove from Friends/i }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove" }),
  );
  expect(
    await screen.findByText("Reassign ownership first."),
  ).toBeInTheDocument();
});

it("opens the confirm-suspend dialog when Suspend is clicked", async () => {
  render(<UsersAdminView users={users} groups={groups} />);
  fireEvent.click(screen.getByRole("button", { name: /Suspend account/i }));
  expect(
    await screen.findByRole("heading", { name: /Suspend Alice Admin/i }),
  ).toBeInTheDocument();
});
```

Add the imports at the top of the test file:

```typescript
import { fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
```

(The Remove button label uses the membership's groupName, so the test searches by `name: /Remove from Friends/i` — adjust the button label in the implementation to match.)

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:unit -- apps/web/app/admin/users/users-admin-view.test.tsx
```

Expected: fails because the new behavior doesn't exist.

- [ ] **Step 3: Update `UsersAdminView` to accept `groups`, manage modal state, render Remove buttons, activate Suspend**

Modify `apps/web/app/admin/users/users-admin-view.tsx`. The full revised shape:

```typescript
"use client";

import { useState } from "react";

import type {
  AdminUserMembership,
  AdminUserSummary,
} from "../../../src/features/users/users-runtime";

import { AddUserToGroupDialog } from "./add-user-to-group-dialog";
import { ConfirmRemoveMembershipDialog } from "./confirm-remove-membership-dialog";
import { ConfirmSuspendDialog } from "./confirm-suspend-dialog";

interface AdminGroupOption {
  readonly groupId: string;
  readonly name: string;
}

interface UsersAdminViewProps {
  readonly users: readonly AdminUserSummary[];
  readonly groups: readonly AdminGroupOption[];
}

const ROLE_LABELS = {
  "group-owner": "Owner",
  manager: "Manager",
  member: "Member",
} as const;

export function UsersAdminView({ users, groups }: UsersAdminViewProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    users[0]?.id ?? null,
  );
  const [removeTarget, setRemoveTarget] = useState<AdminUserMembership | null>(
    null,
  );
  const [suspendOpen, setSuspendOpen] = useState(false);

  const filtered = users.filter((user) => {
    if (!query.trim()) {
      return true;
    }
    const q = query.toLowerCase();
    return (
      user.displayName.toLowerCase().includes(q) ||
      (user.email ?? "").toLowerCase().includes(q)
    );
  });

  const selected = users.find((user) => user.id === selectedId) ?? null;

  return (
    <div className="admin-split">
      <section className="admin-split__list">
        <input
          aria-label="Search users"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
          value={query}
        />
        <ul>
          {filtered.map((user) => {
            const isSelected = user.id === selected?.id;
            return (
              <li key={user.id}>
                <button
                  className={isSelected ? "is-selected" : ""}
                  onClick={() => setSelectedId(user.id)}
                  type="button"
                >
                  <strong>{user.displayName}</strong>
                  {user.isPlatformAdmin ? <span>Platform admin</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="admin-split__detail">
        {selected ? (
          <>
            <header>
              <h2>{selected.displayName}</h2>
              {selected.email ? <p>{selected.email}</p> : null}
            </header>
            <div className="permission-groups">
              <h3>Group roles</h3>
              {selected.memberships.length === 0 ? (
                <p className="admin-empty">Not in any groups yet.</p>
              ) : (
                <ul>
                  {selected.memberships.map((membership) => (
                    <li key={membership.groupId}>
                      <span>{membership.groupName}</span>
                      <strong>{ROLE_LABELS[membership.role]}</strong>
                      <button
                        onClick={() => setRemoveTarget(membership)}
                        type="button"
                      >
                        Remove from {membership.groupName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="admin-actions">
              <button
                className="secondary-action"
                onClick={() => setSuspendOpen(true)}
                type="button"
              >
                Suspend account
              </button>
            </div>
          </>
        ) : null}
      </section>
      <AddUserToGroupDialog
        defaultUserId={selected?.id ?? null}
        groups={groups}
        users={users}
      />
      {selected && removeTarget ? (
        <ConfirmRemoveMembershipDialog
          membership={removeTarget}
          onClose={() => setRemoveTarget(null)}
          open={removeTarget !== null}
          user={selected}
        />
      ) : null}
      {selected ? (
        <ConfirmSuspendDialog
          onClose={() => setSuspendOpen(false)}
          open={suspendOpen}
          user={selected}
        />
      ) : null}
    </div>
  );
}
```

**Note:** the exact existing markup (e.g., the search input, the user list `<li>`, the detail panel header) should be preserved from the current file. The diff above is illustrative; in practice, edit the existing file in place: add the `groups` prop, the two state hooks, the Remove button next to each membership row, replace the disabled Suspend button with an active one, and render the three dialogs at the bottom.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:unit -- apps/web/app/admin/users/users-admin-view.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit Tasks 11–15 together**

```bash
git add apps/web/app/admin/users/add-user-to-group-dialog.tsx \
        apps/web/app/admin/users/confirm-suspend-dialog.tsx \
        apps/web/app/admin/users/confirm-remove-membership-dialog.tsx \
        apps/web/app/admin/users/users-admin-data.tsx \
        apps/web/app/admin/users/users-admin-view.tsx \
        apps/web/app/admin/users/users-admin-view.test.tsx
git commit -m "feat(web): wire Users & Permissions page to admin CRUD modals"
```

---

## Task 16: UI — activate page header button, drop "future bundle" copy

**Files:**
- Modify: `apps/web/app/admin/users/page.tsx`

- [ ] **Step 1: Replace the disabled header button with the live dialog**

The current `page.tsx` renders a disabled button in `actions`. Move the trigger into the page by either:

(a) Rendering `<AddUserToGroupDialog>` directly in the page header (passing users + groups via server fetch), or

(b) Leaving the trigger in `UsersAdminView` (which already has it from Task 15) and removing the page header button entirely.

Option (b) is simpler and matches the existing layout where actions live next to the user list. Choose (b): remove the disabled button and the `actions` slot from `AdminPage`:

```typescript
import { Suspense } from "react";

import { AdminPage } from "../../components/admin-page";

import { UsersAdminData } from "./users-admin-data";

/** Shows real users, their group roles, and Platform Admin status. Effective-permission overrides arrive in a future bundle. */
export default function UsersPermissionsPage() {
  return (
    <AdminPage
      description="Add or remove members, suspend accounts, and review roles."
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
```

(Preserve the existing `UsersAdminSkeleton` import and component if present.)

**Note:** if the existing `AdminPage` requires the `actions` prop, pass `actions={null}` or wrap accordingly. Confirm by reading the file.

- [ ] **Step 2: Run typecheck, lint, and the full test suite**

```bash
npm run typecheck
npm run lint
npm run test:unit -- apps/web/app/admin/users/
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/admin/users/page.tsx
git commit -m "feat(web): activate Users page header actions"
```

---

## Task 17: UI — `rename-group-dialog.tsx`

**Files:**
- Create: `apps/web/app/admin/groups/rename-group-dialog.tsx`

- [ ] **Step 1: Implement the dialog**

Controlled dialog (parent passes `group` and `open`).

```typescript
"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface RenameGroupDialogProps {
  readonly group: { readonly groupId: string; readonly name: string };
  readonly open: boolean;
  readonly onClose: () => void;
}

interface ApiErrorBody {
  readonly error?: { readonly message?: string };
}

export function RenameGroupDialog({
  group,
  open,
  onClose,
}: RenameGroupDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      setName(group.name);
      setError(null);
      setSubmitting(false);
    }
  }, [open, group.name]);

  if (!open) {
    return null;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/groups/${encodeURIComponent(group.groupId)}/rename`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error?.message ?? "Couldn't rename the group. Try again.");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="admin-dialog-backdrop"
      data-testid="rename-group-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-dialog"
        role="dialog"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="admin-dialog-header">
            <h2 id={titleId} className="admin-dialog-title">
              Rename {group.name}
            </h2>
          </div>
          <div className="admin-dialog-fields">
            <label className="admin-field">
              <span>Group name</span>
              <input
                autoFocus
                onChange={(event) => setName(event.target.value)}
                type="text"
                value={name}
              />
            </label>
            {error ? <p className="admin-error">{error}</p> : null}
          </div>
          <div className="admin-dialog-actions">
            <button
              className="admin-secondary-button"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="admin-primary-button"
              disabled={submitting || name.trim().length === 0}
              type="submit"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Typecheck and lint (deferred commit)**

Bundled with Task 19.

---

## Task 18: UI — `archive-group-dialog.tsx`

**Files:**
- Create: `apps/web/app/admin/groups/archive-group-dialog.tsx`

- [ ] **Step 1: Implement the dialog**

```typescript
"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface ArchiveGroupDialogProps {
  readonly group: { readonly groupId: string; readonly name: string };
  readonly open: boolean;
  readonly onClose: () => void;
}

interface ApiErrorBody {
  readonly error?: { readonly message?: string };
}

export function ArchiveGroupDialog({
  group,
  open,
  onClose,
}: ArchiveGroupDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/groups/${encodeURIComponent(group.groupId)}/archive`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        setError(body?.error?.message ?? "Couldn't archive the group. Try again.");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="admin-dialog-backdrop"
      data-testid="archive-group-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-dialog"
        role="dialog"
      >
        <div className="admin-dialog-confirmation">
          <div className="admin-dialog-header">
            <h2 id={titleId} className="admin-dialog-title">
              Archive {group.name}?
            </h2>
          </div>
          <p>It disappears for members but all history is kept.</p>
          {error ? <p className="admin-error">{error}</p> : null}
          <div className="admin-dialog-actions">
            <button
              className="admin-secondary-button"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="admin-danger-button"
              disabled={submitting}
              onClick={() => void submit()}
              type="button"
            >
              {submitting ? "Archiving…" : "Archive"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Typecheck and lint (deferred commit)**

Bundled with Task 19.

---

## Task 19: UI — `groups-admin-row.tsx` and tests

**Files:**
- Create: `apps/web/app/admin/groups/groups-admin-row.tsx`
- Create: `apps/web/app/admin/groups/groups-admin-row.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `apps/web/app/admin/groups/groups-admin-row.test.tsx`:

```typescript
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GroupsAdminRow } from "./groups-admin-row";

afterEach(cleanup);

const mockRefresh = vi.fn();
const mockFetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

beforeEach(() => {
  mockRefresh.mockClear();
  mockFetch.mockClear();
  (globalThis as { fetch?: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
});

const group = {
  groupId: "group-1",
  name: "Friends",
  ownerDisplayName: "Alice",
  memberCount: 4,
};

it("renders the group name, owner, and member count", () => {
  render(<GroupsAdminRow group={group} />);
  expect(screen.getByText("Friends")).toBeInTheDocument();
  expect(screen.getByText("Alice")).toBeInTheDocument();
  expect(screen.getByText("4")).toBeInTheDocument();
});

it("opens the rename dialog prefilled and submits a rename", async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  render(<GroupsAdminRow group={group} />);
  fireEvent.click(screen.getByRole("button", { name: /Rename/i }));
  const input = await screen.findByDisplayValue("Friends");
  fireEvent.change(input, { target: { value: "Best Friends" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/groups/group-1/rename",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Best Friends" }),
      }),
    );
    expect(mockRefresh).toHaveBeenCalled();
  });
});

it("opens the archive confirm and submits", async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  render(<GroupsAdminRow group={group} />);
  fireEvent.click(screen.getByRole("button", { name: /Archive/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/groups/group-1/archive",
      { method: "POST" },
    );
    expect(mockRefresh).toHaveBeenCalled();
  });
});

it("surfaces a 409 inline in the rename dialog", async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ error: { message: "Group is archived." } }),
  });
  render(<GroupsAdminRow group={group} />);
  fireEvent.click(screen.getByRole("button", { name: /Rename/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  expect(await screen.findByText("Group is archived.")).toBeInTheDocument();
});
```

Add the missing `render` import (from `@testing-library/react`).

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:unit -- apps/web/app/admin/groups/groups-admin-row.test.tsx
```

Expected: fails because the component doesn't exist.

- [ ] **Step 3: Implement `groups-admin-row.tsx`**

```typescript
"use client";

import { Users } from "lucide-react";
import { useState } from "react";

import { ArchiveGroupDialog } from "./archive-group-dialog";
import { RenameGroupDialog } from "./rename-group-dialog";

interface GroupsAdminRowProps {
  readonly group: {
    readonly groupId: string;
    readonly name: string;
    readonly ownerDisplayName: string | null;
    readonly memberCount: number;
  };
}

export function GroupsAdminRow({ group }: GroupsAdminRowProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="admin-table__row">
      <strong>
        <Users aria-hidden="true" size={18} /> {group.name}
      </strong>
      <span>{group.ownerDisplayName ?? "—"}</span>
      <span>{group.memberCount}</span>
      <span>0</span>
      <span className="status-pill">Active</span>
      <span className="admin-table__actions">
        <button onClick={() => setRenameOpen(true)} type="button">
          Rename
        </button>
        <button onClick={() => setArchiveOpen(true)} type="button">
          Archive
        </button>
      </span>
      <RenameGroupDialog
        group={{ groupId: group.groupId, name: group.name }}
        onClose={() => setRenameOpen(false)}
        open={renameOpen}
      />
      <ArchiveGroupDialog
        group={{ groupId: group.groupId, name: group.name }}
        onClose={() => setArchiveOpen(false)}
        open={archiveOpen}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:unit -- apps/web/app/admin/groups/groups-admin-row.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit Tasks 17–19 together**

```bash
git add apps/web/app/admin/groups/rename-group-dialog.tsx \
        apps/web/app/admin/groups/archive-group-dialog.tsx \
        apps/web/app/admin/groups/groups-admin-row.tsx \
        apps/web/app/admin/groups/groups-admin-row.test.tsx
git commit -m "feat(web): add groups-admin row with rename and archive modals"
```

---

## Task 20: UI — refactor `groups/page.tsx` to use `groups-admin-row`

**Files:**
- Modify: `apps/web/app/admin/groups/page.tsx`
- Create: `apps/web/app/admin/groups/page.test.tsx`

- [ ] **Step 1: Write a page smoke test**

Create `apps/web/app/admin/groups/page.test.tsx`:

```typescript
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminGroupsPage from "./page";

vi.mock("../../../src/features/groups/group-runtime", () => ({
  groupRuntime: {
    listAllGroupsForAdmin: vi.fn(() =>
      Promise.resolve([
        {
          groupId: "group-1",
          name: "Active Group",
          ownerDisplayName: "Alice",
          memberCount: 3,
        },
        {
          groupId: "group-archived",
          name: "Should Not Appear",
          ownerDisplayName: null,
          memberCount: 0,
        },
      ]),
    ),
    listAllUsers: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock("../../components/admin-page", () => ({
  AdminPage: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../../components/create-group-dialog", () => ({
  CreateGroupDialog: () => <div data-testid="create-group-dialog" />,
}));

afterEach(cleanup);

describe("AdminGroupsPage", () => {
  it("renders the table header and one row per active group", async () => {
    const { findByText } = render(await AdminGroupsPage());
    expect(await findByText("Active Group")).toBeInTheDocument();
    expect(screen.queryByText("Should Not Appear")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (or passes if listAllGroupsForAdmin is already filtered)**

```bash
npm run test:unit -- apps/web/app/admin/groups/page.test.tsx
```

- [ ] **Step 3: Refactor the page to use `GroupsAdminRow`**

Replace the `<button>` row markup with `<GroupsAdminRow>`:

```typescript
import { Users } from "lucide-react";

import { AdminPage } from "../../components/admin-page";
import { CreateGroupDialog } from "../../components/create-group-dialog";
import { groupRuntime } from "../../../src/features/groups/group-runtime";

import { GroupsAdminRow } from "./groups-admin-row";

/** Lets the platform admin inspect, create, suspend, and open every group. */
export default async function AdminGroupsPage() {
  const [groups, users] = await Promise.all([
    groupRuntime.listAllGroupsForAdmin(),
    groupRuntime.listAllUsers(),
  ]);

  return (
    <AdminPage
      actions={<CreateGroupDialog users={users} />}
      description="Inspect membership and orders, or suspend a group without destroying its history."
      eyebrow="Membership"
      title="Groups"
    >
      <section className="admin-panel">
        <div className="admin-table">
          <div className="admin-table__row admin-table__header">
            <span>Group</span>
            <span>Owner</span>
            <span>Members</span>
            <span>Active orders</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {groups.length === 0 ? (
            <p className="admin-empty">No groups yet. Create the first one.</p>
          ) : (
            groups.map((group) => (
              <GroupsAdminRow group={group} key={group.groupId} />
            ))
          )}
        </div>
      </section>
    </AdminPage>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:unit -- apps/web/app/admin/groups/page.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/groups/page.tsx \
        apps/web/app/admin/groups/page.test.tsx
git commit -m "feat(web): render groups-admin row with rename and archive actions"
```

---

## Task 21: Final focused checks, history file, squash-merge

**Files:**
- Create: `context/history/admin-users-groups-crud.md`
- Modify: `context/progress-tracker.md`

- [ ] **Step 1: Run every focused check**

```bash
npm run test:unit
npm run test:providers
npm run lint
npm run typecheck
npm run build:web
```

Expected: all green. Investigate and fix any failures before moving on.

- [ ] **Step 2: Manual browser verification (per spec § Manual verification)**

Run the dev server, sign in as Platform Admin, and walk through:

1. Users page → Add user to group → membership appears in the detail panel.
2. Users page → Add duplicate → modal shows `Already a member.`
3. Users page → Remove from group → membership disappears.
4. Users page → Remove owner blocked → modal shows `Reassign ownership first.`
5. Users page → Suspend a non-self user → user disappears from the list.
6. Users page → Self-suspend blocked → modal shows `You can't suspend your own account.`
7. Groups page → Rename → row updates.
8. Groups page → Archive → row disappears.
9. Audit page → each action appears with correct actor, target, timestamp.

Record any deviations. Fix bugs and re-verify.

- [ ] **Step 3: Write the history file**

Create `context/history/admin-users-groups-crud.md` following the format of `context/history/users-and-permissions-real-users.md`. Include:

- One-line summary of what shipped.
- Test commands run + their results.
- Manual verification steps completed.
- Key design decisions (e.g., defense-in-depth admin auth via `findUserById` + route-handler check; per-row rename/archive modals; controlled dialog pattern for confirm flows).
- Anything deferred or known issues.

- [ ] **Step 4: Update `context/progress-tracker.md`**

In the `## Completed` section, add a new bullet at the bottom:

```markdown
- Admin CRUD on users and groups — Platform Admin can add/remove users in groups (Member role only), suspend users (sets archivedAt), rename groups (bypassing owner check), and archive groups. All five actions are Platform-Admin-gated and append an immutable audit event. Effective permissions, override Save, role changes within a group, ownership transfer, and restoration of archived rows remain deferred.
```

- [ ] **Step 5: Commit the docs**

```bash
git add context/history/admin-users-groups-crud.md \
        context/progress-tracker.md
git commit -m "docs: record admin-users-groups-crud completion"
```

- [ ] **Step 6: Squash-merge to main**

```bash
git checkout main
git merge --squash task/admin-users-groups-crud
git commit -m "Admin CRUD on users and groups"
git push origin main
git branch -D task/admin-users-groups-crud
```

Confirm the squash title matches the tracker entry exactly.

---

## Self-Review

**Spec coverage:**
- ✅ Add user to group — Tasks 5, 7, 8, 10, 11, 14, 15
- ✅ Remove user from group — Tasks 1 (no new repo method needed), 5, 8, 10, 13, 15
- ✅ Suspend user — Tasks 1 (archiveUser), 5, 8, 10, 12, 15, 16
- ✅ Rename group (admin) — Tasks 1 (no new method), 6, 9, 10, 17, 19, 20
- ✅ Archive group — Tasks 1 (archiveGroup), 6, 9, 10, 18, 19, 20
- ✅ Audit events for all five — every service task
- ✅ Platform Admin authorization — service layer + route layer
- ✅ Archived groups filtered from admin list — Task 2
- ✅ `<button>` → `<div>` on groups page — Task 20

**Placeholder scan:** no "TBD"/"TODO"/"implement later". Two flagged unknowns (`executeRoute`/`parseRequestBody` import paths, `validateGroupName` import path) are flagged inline as "confirm against existing file" — they're not blockers, just verification steps for the implementer.

**Type consistency:** `actorId`, `userId`, `groupId`, `name`, `now`, `archivedAt` used consistently across service/handler/route/UI. Service command shapes match the binding methods on `usersRuntime`/`groupRuntime`. Dialog props match what `UsersAdminView` and `GroupsAdminRow` render.

**Known risk:** the implementer must confirm the exact import paths for `executeRoute`, `parseRequestBody`, `parseTrustedMutationRequest`, `validateGroupName`, `withTransaction`, `getRuntimeDatabase`, `createRepositories`, and the `AdminPage`/`UsersAdminSkeleton` shape. The plan flags these inline. Read the referenced existing files (`group-route-handlers.ts`, `group-runtime.ts`, `users-runtime.ts`, `group-service.ts`, the existing `page.tsx`) before implementing each task.

---
