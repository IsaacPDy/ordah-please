import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";

import {
  createAcceptInvitationHandler,
  createAdminRequestHandler,
  createIssueInvitationHandler,
  createListMembersHandler,
  createManageMemberHandler,
} from "./access-route-handlers";

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

  it("lets an authenticated groupless identity execute invitation acceptance", async () => {
    const acceptInvitation = vi.fn(() =>
      Promise.resolve({ groupId: "group-1", role: "member" as const }),
    );
    const handler = createAcceptInvitationHandler({
      acceptInvitation,
      deploymentId: "preview.ordah-please.test",
      loadIdentity: () => ({
        authUserId: "10000000-0000-4000-8000-000000000001",
        roles: [],
        userId: "user-1" as never,
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

  it("rejects organizer access to owner member actions", async () => {
    const manageMember = vi.fn(() =>
      Promise.resolve({ role: "organizer" as const, userId: "member-1" }),
    );
    const handler = createManageMemberHandler("promote", {
      loadIdentity: () => ({
        authUserId: "10000000-0000-4000-8000-000000000001",
        groupId: "group-1" as never,
        roles: ["organizer"],
        userId: "user-1" as never,
      }),
      manageMember,
      now: () => new Date("2026-07-25T09:00:00.000Z"),
      verifySession: () => ({
        authUserId: "10000000-0000-4000-8000-000000000001",
        displayName: "Organizer",
      }),
    });

    const response = await handler(
      new Request("https://preview.ordah-please.test/api/access/promote", {
        body: JSON.stringify({ userId: "member-1" }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(manageMember).not.toHaveBeenCalled();
  });

  it("executes invitation, member-list, and admin-request handlers for a group owner", async () => {
    const base = {
      loadIdentity: () => ({
        authUserId: "10000000-0000-4000-8000-000000000001",
        groupId: "group-1" as never,
        roles: ["group-owner" as const],
        userId: "owner-1" as never,
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
        body: JSON.stringify({ expiresAt: "2026-07-26T08:00:00.000Z" }),
        method: "POST",
      }),
    );
    const membersResponse = await createListMembersHandler({
      ...base,
      listMembers,
    })(new Request("https://preview.ordah-please.test/api/access/members"));
    const adminResponse = await createAdminRequestHandler({
      ...base,
      submitAdminRequest,
    })(
      new Request(
        "https://preview.ordah-please.test/api/access/admin-requests",
        {
          body: "{}",
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
    expect(listMembers).toHaveBeenCalledWith("group-1");
    expect(submitAdminRequest).toHaveBeenCalledTimes(1);
  });
});
