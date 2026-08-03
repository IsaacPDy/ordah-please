import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";

import {
  createAcceptInvitationHandler,
  createAdminRequestHandler,
  createDecideAdminRequestHandler,
  createIdentityMeHandler,
  createIssueInvitationHandler,
  createListMembersHandler,
  createListPendingAdminRequestsHandler,
  createManageMemberHandler,
} from "./access-route-handlers";

/** Creates a typed application identity without hiding its membership permissions. */
function createIdentity(
  input: Readonly<{
    authUserId?: string;
    isPlatformAdmin?: boolean;
    memberships?: AppIdentity["memberships"];
    userId?: string;
  }> = {},
): AppIdentity {
  return {
    authUserId: input.authUserId ?? "auth-user-1",
    isPlatformAdmin: input.isPlatformAdmin ?? false,
    memberships: input.memberships ?? [],
    userId: parseId<UserId>(input.userId ?? "user-1"),
  };
}

/** Brands a readable test group identifier at the same boundary as production input. */
function testGroupId(value: string): GroupId {
  return parseId<GroupId>(value);
}

describe("access route handlers", () => {
  it("requires authentication before invitation acceptance", async () => {
    const acceptInvitation = vi.fn(() =>
      Promise.resolve({ groupId: "group-1", role: "member" as const }),
    );
    const handler = createAcceptInvitationHandler({
      acceptInvitation,
      deploymentId: "preview.ordah-please.test",
      loadIdentity: () => {
        throw new Error("identity must not load");
      },
      now: () => new Date("2026-07-25T08:00:00.000Z"),
      verifySession: () => {
        throw new PublicApiError("UNAUTHENTICATED", "Sign in is required.");
      },
    });

    const response = await handler(
      new Request("https://preview.ordah-please.test/api/access/accept", {
        body: JSON.stringify({ token: "public-token" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("rejects a cross-site browser mutation before authentication or execution", async () => {
    const acceptInvitation = vi.fn(() =>
      Promise.resolve({ groupId: "group-1", role: "member" as const }),
    );
    const verifySession = vi.fn(() => ({
      authUserId: "10000000-0000-4000-8000-000000000001",
      displayName: "Invited Member",
    }));
    const handler = createAcceptInvitationHandler({
      acceptInvitation,
      deploymentId: "https://preview.ordah-please.test",
      loadIdentity: () =>
        createIdentity({
          authUserId: "10000000-0000-4000-8000-000000000001",
        }),
      now: () => new Date("2026-07-25T08:00:00.000Z"),
      verifySession,
    });

    const response = await handler(
      new Request(
        "https://preview.ordah-please.test/api/access/invitations/accept",
        {
          body: JSON.stringify({ token: "public-token" }),
          headers: {
            Origin: "https://hostile.example",
            "Sec-Fetch-Site": "cross-site",
          },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(verifySession).not.toHaveBeenCalled();
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("lets an authenticated groupless identity execute invitation acceptance", async () => {
    const acceptInvitation = vi.fn(() =>
      Promise.resolve({ groupId: "group-1", role: "member" as const }),
    );
    const handler = createAcceptInvitationHandler({
      acceptInvitation,
      deploymentId: "preview.ordah-please.test",
      loadIdentity: () =>
        createIdentity({
          authUserId: "10000000-0000-4000-8000-000000000001",
        }),
      now: () => new Date("2026-07-25T08:00:00.000Z"),
      verifySession: () => ({
        authUserId: "10000000-0000-4000-8000-000000000001",
        displayName: "Invited Member",
      }),
    });

    const response = await handler(
      new Request("https://preview.ordah-please.test/api/access/accept", {
        body: JSON.stringify({ token: "public-token" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(acceptInvitation).toHaveBeenCalledWith({
      deploymentId: "preview.ordah-please.test",
      now: new Date("2026-07-25T08:00:00.000Z"),
      publicToken: "public-token",
      userId: "user-1",
    });
  });

  it("rejects a Group B owner action when ownership belongs only to Group A", async () => {
    const manageMember = vi.fn(() =>
      Promise.resolve({ role: "manager" as const, userId: "member-1" }),
    );
    const handler = createManageMemberHandler("promote", {
      loadIdentity: () =>
        createIdentity({
          memberships: [
            { groupId: testGroupId("group-a"), role: "group-owner" },
            { groupId: testGroupId("group-b"), role: "manager" },
          ],
        }),
      manageMember,
      now: () => new Date("2026-07-25T09:00:00.000Z"),
      verifySession: () => ({
        authUserId: "10000000-0000-4000-8000-000000000001",
        displayName: "Manager",
      }),
    });

    const response = await handler(
      new Request("https://preview.ordah-please.test/api/access/promote", {
        body: JSON.stringify({ groupId: "group-b", userId: "member-1" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(manageMember).not.toHaveBeenCalled();
  });

  it("executes invitation, member-list, and admin-request handlers for a group owner", async () => {
    const base = {
      loadIdentity: () =>
        createIdentity({
          authUserId: "10000000-0000-4000-8000-000000000001",
          memberships: [
            { groupId: testGroupId("group-1"), role: "group-owner" },
            { groupId: testGroupId("group-2"), role: "member" },
          ],
          userId: "owner-1",
        }),
      verifySession: () => ({
        authUserId: "10000000-0000-4000-8000-000000000001",
        displayName: "Owner",
      }),
    };
    const issueInvitation = vi.fn(() =>
      Promise.resolve({
        expiresAt: "2026-07-26T08:00:00.000Z",
        invitationId: "invitation-1",
        publicToken: "public-token",
      }),
    );
    const listMembers = vi.fn(() =>
      Promise.resolve([
        { displayName: "Owner", role: "owner" as const, userId: "owner-1" },
      ]),
    );
    const submitAdminRequest = vi.fn(() =>
      Promise.resolve({ requestId: "request-1", status: "pending" as const }),
    );

    const issueResponse = await createIssueInvitationHandler({
      ...base,
      deploymentId: "preview.ordah-please.test",
      issueInvitation,
      now: () => new Date("2026-07-25T08:00:00.000Z"),
    })(
      new Request("https://preview.ordah-please.test/api/access/invitations", {
        body: JSON.stringify({
          expiresAt: "2026-07-26T08:00:00.000Z",
          groupId: "group-1",
        }),
        method: "POST",
      }),
    );
    const membersResponse = await createListMembersHandler({
      ...base,
      listMembers,
    })(
      new Request(
        "https://preview.ordah-please.test/api/access/members?groupId=group-1",
      ),
    );
    const adminResponse = await createAdminRequestHandler({
      ...base,
      submitAdminRequest,
    })(
      new Request(
        "https://preview.ordah-please.test/api/access/admin-requests",
        {
          body: JSON.stringify({ groupId: "group-1" }),
          method: "POST",
        },
      ),
    );

    expect([
      issueResponse.status,
      membersResponse.status,
      adminResponse.status,
    ]).toEqual([200, 200, 200]);
    expect(issueInvitation).toHaveBeenCalledTimes(1);
    expect(issueInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: "group-1" }),
    );
    expect(listMembers).toHaveBeenCalledWith("group-1");
    expect(submitAdminRequest).toHaveBeenCalledTimes(1);
  });

  it("lets a Platform Admin issue an invitation without group membership", async () => {
    const issueInvitation = vi.fn(() =>
      Promise.resolve({
        expiresAt: "2026-07-26T08:00:00.000Z",
        invitationId: "invitation-1",
        publicToken: "public-token",
      }),
    );
    const handler = createIssueInvitationHandler({
      deploymentId: "preview.ordah-please.test",
      issueInvitation,
      loadIdentity: () =>
        createIdentity({
          isPlatformAdmin: true,
          memberships: [],
          userId: "admin-1",
        }),
      now: () => new Date("2026-07-25T08:00:00.000Z"),
      verifySession: () => ({
        authUserId: "10000000-0000-4000-8000-000000000001",
        displayName: "Platform Admin",
      }),
    });

    const response = await handler(
      new Request("https://preview.ordah-please.test/api/access/invitations", {
        body: JSON.stringify({
          expiresAt: "2026-07-26T08:00:00.000Z",
          groupId: "group-1",
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(issueInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: "admin-1", groupId: "group-1" }),
    );
  });
});

describe("createDecideAdminRequestHandler", () => {
  it("returns 403 when the caller is not a platform admin", async () => {
    const handler = createDecideAdminRequestHandler({
      decideAdminRequest: vi.fn(),
      loadIdentity: () =>
        createIdentity({
          authUserId: "auth-1",
          memberships: [
            { groupId: testGroupId("group-1"), role: "group-owner" },
          ],
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
    const decideAdminRequest = vi.fn(() =>
      Promise.resolve({
        requestId: "req-1",
        status: "approved" as const,
      }),
    );
    const handler = createDecideAdminRequestHandler({
      decideAdminRequest,
      loadIdentity: () =>
        createIdentity({
          authUserId: "auth-admin",
          isPlatformAdmin: true,
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
      loadIdentity: () =>
        createIdentity({
          authUserId: "auth-admin",
          isPlatformAdmin: true,
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
      listPendingAdminRequests: vi.fn(() => Promise.resolve([])),
      loadIdentity: () => createIdentity({ authUserId: "auth-1" }),
      verifySession: () => ({ authUserId: "auth-1", displayName: "Member" }),
    });

    const response = await handler(
      new Request("https://example.test/api/access/admin-requests/pending"),
    );
    expect(response.status).toBe(403);
  });

  it("returns the pending list for a platform admin", async () => {
    const listPendingAdminRequests = vi.fn(() =>
      Promise.resolve([
        {
          id: "req-1",
          requesterUserId: "usr-1",
          requesterDisplayName: "Owner One",
          groupId: "grp-1",
          groupName: "Group One",
          status: "pending" as const,
          createdAt: "2026-07-28T08:00:00.000Z",
        },
      ]),
    );
    const handler = createListPendingAdminRequestsHandler({
      listPendingAdminRequests,
      loadIdentity: () =>
        createIdentity({
          authUserId: "auth-admin",
          isPlatformAdmin: true,
          userId: "admin-1",
        }),
      verifySession: () => ({ authUserId: "auth-admin", displayName: "Admin" }),
    });

    const response = await handler(
      new Request("https://example.test/api/access/admin-requests/pending"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { requests: unknown[] };
    };
    expect(body.data.requests).toHaveLength(1);
  });
});

describe("createIdentityMeHandler", () => {
  it("requires authentication before reading identity", async () => {
    const handler = createIdentityMeHandler({
      countPendingAdminRequests: vi.fn(),
      loadIdentity: () => {
        throw new Error("identity must not load");
      },
      verifySession: () => {
        throw new PublicApiError("UNAUTHENTICATED", "Sign in is required.");
      },
    });

    const response = await handler(
      new Request("https://example.test/api/identity/me"),
    );

    expect(response.status).toBe(401);
  });

  it("reports the non-admin identity with a zero pending count", async () => {
    const countPendingAdminRequests = vi.fn(() => Promise.resolve([]));
    const handler = createIdentityMeHandler({
      countPendingAdminRequests,
      loadIdentity: () =>
        createIdentity({
          authUserId: "auth-1",
          memberships: [
            { groupId: testGroupId("group-1"), role: "group-owner" },
          ],
        }),
      verifySession: () => ({ authUserId: "auth-1", displayName: "Owner" }),
    });

    const response = await handler(
      new Request("https://example.test/api/identity/me"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        isPlatformAdmin: boolean;
        memberships: AppIdentity["memberships"];
        pendingAdminRequestCount: number;
      };
    };
    expect(body.data).toEqual({
      isPlatformAdmin: false,
      memberships: [{ groupId: "group-1", role: "group-owner" }],
      pendingAdminRequestCount: 0,
    });
  });

  it("reports the platform-admin identity with the live pending count", async () => {
    const countPendingAdminRequests = vi.fn(() =>
      Promise.resolve([
        {
          id: "req-1",
          requesterUserId: "usr-1",
          requesterDisplayName: "Owner One",
          groupId: "grp-1",
          groupName: "Group One",
          status: "pending" as const,
          createdAt: "2026-07-28T08:00:00.000Z",
        },
        {
          id: "req-2",
          requesterUserId: "usr-2",
          requesterDisplayName: "Owner Two",
          groupId: "grp-2",
          groupName: "Group Two",
          status: "pending" as const,
          createdAt: "2026-07-29T08:00:00.000Z",
        },
      ]),
    );
    const handler = createIdentityMeHandler({
      countPendingAdminRequests,
      loadIdentity: () =>
        createIdentity({
          authUserId: "auth-admin",
          isPlatformAdmin: true,
          memberships: [{ groupId: testGroupId("group-9"), role: "member" }],
          userId: "admin-1",
        }),
      verifySession: () => ({ authUserId: "auth-admin", displayName: "Admin" }),
    });

    const response = await handler(
      new Request("https://example.test/api/identity/me"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        isPlatformAdmin: boolean;
        memberships: AppIdentity["memberships"];
        pendingAdminRequestCount: number;
      };
    };
    expect(body.data).toEqual({
      isPlatformAdmin: true,
      memberships: [{ groupId: "group-9", role: "member" }],
      pendingAdminRequestCount: 2,
    });
    expect(countPendingAdminRequests).toHaveBeenCalledTimes(1);
  });
});
