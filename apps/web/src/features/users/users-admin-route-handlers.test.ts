import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";

import {
  createMemberAccountHandler,
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
      Promise.resolve({
        groupId: parseId<GroupId>("group-1"),
        userId: parseId<UserId>("user-2"),
      }),
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
      Promise.resolve({
        groupId: parseId<GroupId>("group-1"),
        userId: parseId<UserId>("user-2"),
      }),
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
      Promise.resolve({
        groupId: parseId<GroupId>("group-1"),
        userId: parseId<UserId>("user-2"),
      }),
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

describe("member account routes", () => {
  function deps() {
    return {
      ...baseDeps,
      createMemberAsAdmin: vi.fn(() =>
        Promise.resolve({ userId: "new-member" }),
      ),
      linkMemberAsAdmin: vi.fn(() => Promise.resolve({ userId: "account" })),
    };
  }
  const request = (body: unknown, headers = {}) =>
    new Request("https://example.test/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  it("creates a member and links only the explicit selected pair", async () => {
    const d = deps();
    expect(
      (await createMemberAccountHandler(d)(request({ displayName: "Sam" })))
        .status,
    ).toBe(200);
    expect(d.createMemberAsAdmin).toHaveBeenCalledWith("admin-1", "Sam");
    expect(
      (
        await createMemberAccountHandler(
          d,
          "member",
        )(request({ accountUserId: "account" }))
      ).status,
    ).toBe(200);
    expect(d.linkMemberAsAdmin).toHaveBeenCalledWith(
      "admin-1",
      "member",
      "account",
    );
  });
  it("rejects non-admins, unauthenticated callers, and cross-origin requests before mutations", async () => {
    const d = deps();
    const cases = [
      { ...d, loadIdentity: () => createIdentity({ isPlatformAdmin: false }) },
      {
        ...d,
        verifySession: () => {
          throw new PublicApiError("UNAUTHENTICATED", "Sign in.");
        },
      },
    ];
    expect(
      (
        await createMemberAccountHandler(cases[0]!)(
          request({ displayName: "Sam" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await createMemberAccountHandler(cases[1]!)(
          request({ displayName: "Sam" }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await createMemberAccountHandler(d)(
          request({ displayName: "Sam" }, { origin: "https://evil.test" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await createMemberAccountHandler(
          d,
          "member",
        )(
          request(
            { accountUserId: "account" },
            { "sec-fetch-site": "cross-site" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(d.createMemberAsAdmin).not.toHaveBeenCalled();
    expect(d.linkMemberAsAdmin).not.toHaveBeenCalled();
  });
  it.each([null, {}, { displayName: 12 }])(
    "rejects malformed creation bodies",
    async (body) => {
      const d = deps();
      expect((await createMemberAccountHandler(d)(request(body))).status).toBe(
        400,
      );
      expect(d.createMemberAsAdmin).not.toHaveBeenCalled();
    },
  );
  it("rejects missing link selection and surfaces a safe conflict", async () => {
    const d = deps();
    expect(
      (await createMemberAccountHandler(d, "member")(request({}))).status,
    ).toBe(400);
    d.linkMemberAsAdmin.mockRejectedValueOnce(
      new PublicApiError("CONFLICT", "Duplicate session."),
    );
    const response = await createMemberAccountHandler(
      d,
      "member",
    )(request({ accountUserId: "account" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { message: "Duplicate session." },
    });
  });
});
