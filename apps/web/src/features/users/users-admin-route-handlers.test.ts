import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";

import {
  createAddUserToGroupHandler,
  createRemoveUserFromGroupHandler,
  createSuspendUserHandler,
} from "./users-admin-route-handlers";

/** Creates a typed application identity without hiding its membership permissions. */
function createIdentity(
  input: Readonly<{
    isPlatformAdmin?: boolean;
    userId?: string;
  }> = {},
): AppIdentity {
  return {
    authUserId: "auth-admin",
    displayName: "Admin",
    email: "admin@example.test",
    imageUrl: null,
    isPlatformAdmin: input.isPlatformAdmin ?? true,
    memberships: [],
    userId: parseId<UserId>(input.userId ?? "admin-1"),
  };
}

const baseDeps = {
  loadIdentity: () => createIdentity(),
  now: () => new Date("2026-08-13T12:00:00.000Z"),
  verifySession: () => ({
    authUserId: "auth-admin",
    displayName: "Admin",
    email: "admin@example.test",
    imageUrl: null,
  }),
};

describe("createSuspendUserHandler", () => {
  it("returns 200 and calls suspendUserAsAdmin on the happy path", async () => {
    const suspendUserAsAdmin = vi.fn(() =>
      Promise.resolve({ userId: parseId<UserId>("user-2") }),
    );
    const handler = createSuspendUserHandler(
      { ...baseDeps, suspendUserAsAdmin },
      (request) => new URL(request.url).pathname.split("/")[4],
    );
    const response = await handler(
      new Request("https://example.test/api/admin/users/user-2/suspend", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(suspendUserAsAdmin).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      userId: "user-2",
      now: new Date("2026-08-13T12:00:00.000Z"),
    });
  });

  it("returns 403 when the actor is not a Platform Admin", async () => {
    const suspendUserAsAdmin = vi.fn(() =>
      Promise.resolve({ userId: parseId<UserId>("user-2") }),
    );
    const handler = createSuspendUserHandler(
      {
        ...baseDeps,
        loadIdentity: () => createIdentity({ isPlatformAdmin: false }),
        suspendUserAsAdmin,
      },
      (request) => new URL(request.url).pathname.split("/")[4],
    );
    const response = await handler(
      new Request("https://example.test/api/admin/users/user-2/suspend", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
    expect(suspendUserAsAdmin).not.toHaveBeenCalled();
  });

  it("returns 409 when the service throws CONFLICT", async () => {
    const suspendUserAsAdmin = vi.fn(() =>
      Promise.reject(
        new PublicApiError("CONFLICT", "You can't suspend your own account."),
      ),
    );
    const handler = createSuspendUserHandler(
      { ...baseDeps, suspendUserAsAdmin },
      (request) => new URL(request.url).pathname.split("/")[4],
    );
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
      Promise.resolve({ groupId: parseId<GroupId>("group-1"), userId: parseId<UserId>("user-2") }),
    );
    const handler = createAddUserToGroupHandler(
      { ...baseDeps, addUserToGroupAsAdmin },
      (request) => new URL(request.url).pathname.split("/")[4],
    );
    const response = await handler(
      new Request("https://example.test/api/admin/users/user-2/memberships", {
        method: "POST",
        body: JSON.stringify({ groupId: "group-1" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(addUserToGroupAsAdmin).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      userId: "user-2",
      groupId: "group-1",
    });
  });

  it("returns 400 when the body is missing groupId", async () => {
    const addUserToGroupAsAdmin = vi.fn(() =>
      Promise.resolve({ groupId: parseId<GroupId>("group-1"), userId: parseId<UserId>("user-2") }),
    );
    const handler = createAddUserToGroupHandler(
      { ...baseDeps, addUserToGroupAsAdmin },
      (request) => new URL(request.url).pathname.split("/")[4],
    );
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
      Promise.resolve({ groupId: parseId<GroupId>("group-1"), userId: parseId<UserId>("user-2") }),
    );
    const handler = createRemoveUserFromGroupHandler(
      { ...baseDeps, removeUserFromGroupAsAdmin },
      (request) => new URL(request.url).pathname.split("/")[4],
      (request) => new URL(request.url).pathname.split("/")[6],
    );
    const response = await handler(
      new Request(
        "https://example.test/api/admin/users/user-2/memberships/group-1/remove",
        { method: "POST" },
      ),
    );
    expect(response.status).toBe(200);
    expect(removeUserFromGroupAsAdmin).toHaveBeenCalledWith({
      actorUserId: "admin-1",
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
    const handler = createRemoveUserFromGroupHandler(
      { ...baseDeps, removeUserFromGroupAsAdmin },
      (request) => new URL(request.url).pathname.split("/")[4],
      (request) => new URL(request.url).pathname.split("/")[6],
    );
    const response = await handler(
      new Request(
        "https://example.test/api/admin/users/user-2/memberships/group-1/remove",
        { method: "POST" },
      ),
    );
    expect(response.status).toBe(409);
  });
});
