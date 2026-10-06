import { describe, expect, it, vi } from "vitest";
import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type UserId } from "@ordah-please/domain";
import {
  createRotateInviteLinkHandler,
  createRenameGroupHandler,
} from "./group-route-handlers";
import { createSetGroupMemberRoleHandler } from "./groups-admin-route-handlers";
const identity = {
  authUserId: "auth",
  userId: parseId<UserId>("admin"),
  displayName: "Admin",
  email: "admin@example.test",
  imageUrl: null,
  isPlatformAdmin: true,
  memberships: [],
};
function fixture(isPlatformAdmin = true) {
  const setGroupMemberRoleAsAdmin = vi.fn(() =>
    Promise.resolve({
      groupId: "group",
      userId: "person",
      role: "manager" as const,
    }),
  );
  const deps = {
    setGroupMemberRoleAsAdmin,
    loadIdentity: () => ({ ...identity, isPlatformAdmin }),
    verifySession: () => identity,
  };
  return {
    deps,
    handler: createSetGroupMemberRoleHandler(
      deps,
      () => "group",
      () => "person",
    ),
  };
}
const request = (
  body: unknown = { expectedRole: "member", role: "manager" },
  headers = {},
) =>
  new Request("http://localhost/api/admin/groups/group/members/person/role", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
describe("group member role API", () => {
  it("passes authenticated actor and exact group to the mutation", async () => {
    const f = fixture();
    expect((await f.handler(request())).status).toBe(200);
    expect(f.deps.setGroupMemberRoleAsAdmin).toHaveBeenCalledWith({
      actorUserId: "admin",
      groupId: "group",
      userId: "person",
      expectedRole: "member",
      role: "manager",
    });
  });
  it("rejects non-admins without calling the mutation", async () => {
    const f = fixture(false);
    expect((await f.handler(request())).status).toBe(403);
    expect(f.deps.setGroupMemberRoleAsAdmin).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated requests", async () => {
    const f = fixture();
    f.deps.verifySession = () => {
      throw new PublicApiError("UNAUTHENTICATED", "Sign in.");
    };
    const handler = createSetGroupMemberRoleHandler(
      f.deps,
      () => "group",
      () => "person",
    );
    expect((await handler(request())).status).toBe(401);
  });
  it.each([
    { role: "owner", expectedRole: "member" },
    { role: "manager" },
    null,
    { role: "manager", expectedRole: "member", isPlatformAdmin: true },
  ])("rejects invalid role input %j", async (body) => {
    const f = fixture();
    expect((await f.handler(request(body))).status).toBe(400);
    expect(f.deps.setGroupMemberRoleAsAdmin).not.toHaveBeenCalled();
  });
  it("rejects cross-site changes", async () => {
    const f = fixture();
    expect(
      (await f.handler(request(undefined, { origin: "https://evil.example" })))
        .status,
    ).toBe(403);
    expect(f.deps.setGroupMemberRoleAsAdmin).not.toHaveBeenCalled();
  });
});

describe("group management boundaries", () => {
  it("reserves invitation rotation for admins, even when the actor owns the group", async () => {
    const rotateInviteLink = vi.fn(() =>
      Promise.resolve({ publicValue: "token", tokenPrefix: "token" }),
    );
    const dependencies = {
      loadIdentity: () => ({
        ...identity,
        isPlatformAdmin: false,
        memberships: [
          { groupId: "group" as never, role: "group-owner" as const },
        ],
      }),
      verifySession: () => identity,
      now: () => new Date(),
      rotateInviteLink,
    };
    expect(
      (
        await createRotateInviteLinkHandler(
          dependencies,
          () => "group",
        )(request())
      ).status,
    ).toBe(403);
    expect(rotateInviteLink).not.toHaveBeenCalled();
    dependencies.loadIdentity = () => ({
      ...identity,
      memberships: [
        { groupId: "group" as never, role: "group-owner" as const },
      ],
    });
    expect(
      (
        await createRotateInviteLinkHandler(
          dependencies,
          () => "group",
        )(request())
      ).status,
    ).toBe(200);
  });
  it("allows a Manager to rename only their own group", async () => {
    const renameGroup = vi.fn(() =>
      Promise.resolve({ groupId: "group" as never, name: "Team" }),
    );
    const dependencies = {
      loadIdentity: () => ({
        ...identity,
        isPlatformAdmin: false,
        memberships: [{ groupId: "group" as never, role: "manager" as const }],
      }),
      verifySession: () => identity,
      now: () => new Date(),
      renameGroup,
    };
    expect(
      (
        await createRenameGroupHandler(
          dependencies,
          () => "group",
        )(request({ name: "Team" }))
      ).status,
    ).toBe(200);
    expect(
      (
        await createRenameGroupHandler(
          dependencies,
          () => "other",
        )(request({ name: "Team" }))
      ).status,
    ).toBe(403);
  });
});
