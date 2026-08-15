import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";

import {
  createArchiveGroupHandler,
  createRenameGroupAsAdminHandler,
} from "./groups-admin-route-handlers";

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

describe("createRenameGroupAsAdminHandler", () => {
  it("returns 200 and calls renameGroupAsAdmin on the happy path", async () => {
    const renameGroupAsAdmin = vi.fn(() =>
      Promise.resolve({ groupId: parseId<GroupId>("group-1"), name: "New Name" }),
    );
    const handler = createRenameGroupAsAdminHandler(
      { ...baseDeps, renameGroupAsAdmin },
      (request) => new URL(request.url).pathname.split("/")[4],
    );
    const response = await handler(
      new Request("https://example.test/api/admin/groups/group-1/rename", {
        method: "POST",
        body: JSON.stringify({ name: "New Name" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(renameGroupAsAdmin).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      groupId: "group-1",
      name: "New Name",
    });
  });

  it("returns 403 when the actor is not a Platform Admin", async () => {
    const renameGroupAsAdmin = vi.fn(() =>
      Promise.resolve({ groupId: parseId<GroupId>("group-1"), name: "New Name" }),
    );
    const handler = createRenameGroupAsAdminHandler(
      {
        ...baseDeps,
        loadIdentity: () => createIdentity({ isPlatformAdmin: false }),
        renameGroupAsAdmin,
      },
      (request) => new URL(request.url).pathname.split("/")[4],
    );
    const response = await handler(
      new Request("https://example.test/api/admin/groups/group-1/rename", {
        method: "POST",
        body: JSON.stringify({ name: "New Name" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(renameGroupAsAdmin).not.toHaveBeenCalled();
  });

  it("returns 409 when the group is archived", async () => {
    const renameGroupAsAdmin = vi.fn(() =>
      Promise.reject(new PublicApiError("CONFLICT", "Group is archived.")),
    );
    const handler = createRenameGroupAsAdminHandler(
      { ...baseDeps, renameGroupAsAdmin },
      (request) => new URL(request.url).pathname.split("/")[4],
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
      Promise.resolve({ groupId: parseId<GroupId>("group-1") }),
    );
    const handler = createArchiveGroupHandler(
      { ...baseDeps, archiveGroupAsAdmin },
      (request) => new URL(request.url).pathname.split("/")[4],
    );
    const response = await handler(
      new Request("https://example.test/api/admin/groups/group-1/archive", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(archiveGroupAsAdmin).toHaveBeenCalledWith({
      actorUserId: "admin-1",
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
      (request) => new URL(request.url).pathname.split("/")[4],
    );
    const response = await handler(
      new Request("https://example.test/api/admin/groups/group-1/archive", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(409);
  });
});
