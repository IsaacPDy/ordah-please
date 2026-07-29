import { describe, expect, it, vi } from "vitest";

import {
  acceptGroupInvitation,
  issueGroupInvitation,
  manageGroupMember,
  submitAdminAccessRequest,
} from "./access-service";

describe("access service", () => {
  it("persists only the invitation hash and audits owner issuance", async () => {
    const createInvitation = vi.fn<
      (input: {
        createdByUserId: string;
        expiresAt: Date;
        groupId: string;
        tokenHash: string;
      }) => Promise<{ id: string }>
    >(() => Promise.resolve({ id: "invitation-1" }));
    const appendAudit = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: { createInvitation: typeof createInvitation };
          auditEvents: { append: typeof appendAudit };
        }) => Promise<Result>,
      ) =>
        operation({
          access: { createInvitation },
          auditEvents: { append: appendAudit },
        }),
    };

    await expect(
      issueGroupInvitation(
        {
          actorUserId: "owner-1",
          deploymentId: "preview.ordah-please.test",
          expiresAt: new Date("2026-07-26T08:00:00.000Z"),
          groupId: "group-1",
          now: new Date("2026-07-25T08:00:00.000Z"),
        },
        transactionRunner,
        () => ({
          publicToken: "invite.v1.deployment.random",
          tokenHash: "persisted-hash",
        }),
      ),
    ).resolves.toEqual({
      expiresAt: "2026-07-26T08:00:00.000Z",
      invitationId: "invitation-1",
      publicToken: "invite.v1.deployment.random",
    });

    expect(createInvitation).toHaveBeenCalledWith({
      createdByUserId: "owner-1",
      expiresAt: new Date("2026-07-26T08:00:00.000Z"),
      groupId: "group-1",
      tokenHash: "persisted-hash",
    });
    expect(appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "group.invitation_issued",
        actorUserId: "owner-1",
        resourceId: "invitation-1",
      }),
    );
  });

  it("accepts an available invitation into membership without enrolling an order participant", async () => {
    const access = {
      acceptInvitation: vi.fn(() => Promise.resolve(true)),
      addMembership: vi.fn(() =>
        Promise.resolve({
          groupId: "group-1",
          role: "member",
          userId: "user-1",
        }),
      ),
      findInvitationByTokenHash: vi.fn(() =>
        Promise.resolve({
          acceptedAt: null,
          expiresAt: new Date("2026-07-26T08:00:00.000Z"),
          groupId: "group-1",
          id: "invitation-1",
        }),
      ),
      listActiveMemberships: vi.fn(() => Promise.resolve([])),
    };
    const append = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: typeof access;
          auditEvents: { append: typeof append };
        }) => Promise<Result>,
      ) => operation({ access, auditEvents: { append } }),
    };

    await expect(
      acceptGroupInvitation(
        {
          deploymentId: "preview.ordah-please.test",
          now: new Date("2026-07-25T08:00:00.000Z"),
          publicToken: "public-token",
          userId: "user-1",
        },
        transactionRunner,
        () => "persisted-hash",
      ),
    ).resolves.toEqual({ groupId: "group-1", role: "member" });

    expect(access.addMembership).toHaveBeenCalledWith({
      groupId: "group-1",
      joinedAt: new Date("2026-07-25T08:00:00.000Z"),
      role: "member",
      userId: "user-1",
    });
    expect(access.acceptInvitation).toHaveBeenCalledWith(
      "invitation-1",
      "user-1",
      new Date("2026-07-25T08:00:00.000Z"),
    );
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "group.invitation_accepted" }),
    );
    expect(transactionRunner).not.toHaveProperty("orders");
  });

  it.each([
    {
      acceptedAt: new Date("2026-07-25T07:00:00.000Z"),
      expiresAt: new Date("2026-07-26T08:00:00.000Z"),
    },
    {
      acceptedAt: null,
      expiresAt: new Date("2026-07-25T08:00:00.000Z"),
    },
  ])(
    "rejects reused or expired invitations with one safe error",
    async (state) => {
      const access = {
        acceptInvitation: vi.fn(() => Promise.resolve(true)),
        addMembership: vi.fn(() => Promise.resolve({})),
        findInvitationByTokenHash: vi.fn(() =>
          Promise.resolve({
            ...state,
            groupId: "group-1",
            id: "invitation-1",
          }),
        ),
        listActiveMemberships: vi.fn(() => Promise.resolve([])),
      };
      const transactionRunner = {
        run: <Result>(
          operation: (repositories: {
            access: typeof access;
            auditEvents: { append: () => Promise<{ id: string }> };
          }) => Promise<Result>,
        ) =>
          operation({
            access,
            auditEvents: {
              append: () => Promise.resolve({ id: "audit-1" }),
            },
          }),
      };

      await expect(
        acceptGroupInvitation(
          {
            deploymentId: "preview.ordah-please.test",
            now: new Date("2026-07-25T08:00:00.000Z"),
            publicToken: "public-token",
            userId: "user-1",
          },
          transactionRunner,
          () => "persisted-hash",
        ),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "This invitation link is no longer available.",
      });
      expect(access.addMembership).not.toHaveBeenCalled();
    },
  );

  it("rejects a concurrent role change without writing a duplicate audit", async () => {
    const access = {
      listActiveMembers: vi.fn(() =>
        Promise.resolve([
          {
            displayName: "Member",
            role: "member" as const,
            userId: "member-1",
          },
        ]),
      ),
      removeMembership: vi.fn(() => Promise.resolve(true)),
      setMembershipRole: vi.fn(() => Promise.resolve(false)),
    };
    const append = vi.fn(() => Promise.resolve({ id: "audit-1" }));

    await expect(
      manageGroupMember(
        {
          action: "promote",
          actorUserId: "owner-1",
          groupId: "group-1",
          now: new Date("2026-07-25T09:00:00.000Z"),
          targetUserId: "member-1",
        },
        {
          run: (operation) => operation({ access, auditEvents: { append } }),
        },
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This member action is not available.",
    });
    expect(access.setMembershipRole).toHaveBeenCalledWith(
      "group-1",
      "member-1",
      "member",
      "organizer",
    );
    expect(append).not.toHaveBeenCalled();
  });

  it("rejects acceptance when the authenticated user already has an active group", async () => {
    const access = {
      acceptInvitation: vi.fn(() => Promise.resolve(true)),
      addMembership: vi.fn(() => Promise.resolve({})),
      findInvitationByTokenHash: vi.fn(() =>
        Promise.resolve({
          acceptedAt: null,
          expiresAt: new Date("2026-07-26T08:00:00.000Z"),
          groupId: "group-2",
          id: "invitation-1",
        }),
      ),
      listActiveMemberships: vi.fn(() =>
        Promise.resolve([{ groupId: "group-1" }]),
      ),
    };
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: typeof access;
          auditEvents: { append: () => Promise<{ id: string }> };
        }) => Promise<Result>,
      ) =>
        operation({
          access,
          auditEvents: {
            append: () => Promise.resolve({ id: "audit-1" }),
          },
        }),
    };

    await expect(
      acceptGroupInvitation(
        {
          deploymentId: "preview.ordah-please.test",
          now: new Date("2026-07-25T08:00:00.000Z"),
          publicToken: "public-token",
          userId: "user-1",
        },
        transactionRunner,
        () => "persisted-hash",
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Your account already belongs to a group.",
    });
    expect(access.acceptInvitation).not.toHaveBeenCalled();
  });

  it("rejects a concurrently consumed invitation before creating membership", async () => {
    const access = {
      acceptInvitation: vi.fn(() => Promise.resolve(false)),
      addMembership: vi.fn(() => Promise.resolve({})),
      findInvitationByTokenHash: vi.fn(() =>
        Promise.resolve({
          acceptedAt: null,
          expiresAt: new Date("2026-07-26T08:00:00.000Z"),
          groupId: "group-1",
          id: "invitation-1",
        }),
      ),
      listActiveMemberships: vi.fn(() => Promise.resolve([])),
    };
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: typeof access;
          auditEvents: { append: () => Promise<{ id: string }> };
        }) => Promise<Result>,
      ) =>
        operation({
          access,
          auditEvents: {
            append: () => Promise.resolve({ id: "audit-1" }),
          },
        }),
    };

    await expect(
      acceptGroupInvitation(
        {
          deploymentId: "preview.ordah-please.test",
          now: new Date("2026-07-25T08:00:00.000Z"),
          publicToken: "public-token",
          userId: "user-1",
        },
        transactionRunner,
        () => "persisted-hash",
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This invitation link is no longer available.",
    });
    expect(access.addMembership).not.toHaveBeenCalled();
  });

  it.each([
    {
      action: "promote" as const,
      auditAction: "group.member_promoted",
      currentRole: "member" as const,
      expectedRole: "organizer" as const,
    },
    {
      action: "demote" as const,
      auditAction: "group.member_demoted",
      currentRole: "organizer" as const,
      expectedRole: "member" as const,
    },
    {
      action: "remove" as const,
      auditAction: "group.member_removed",
      currentRole: "member" as const,
      expectedRole: null,
    },
  ])(
    "audits an owner $action action for an active member",
    async ({ action, auditAction, currentRole, expectedRole }) => {
      const access = {
        listActiveMembers: vi.fn(() =>
          Promise.resolve([
            {
              displayName: "Member",
              role: currentRole,
              userId: "member-1",
            },
          ]),
        ),
        removeMembership: vi.fn(() => Promise.resolve(true)),
        setMembershipRole: vi.fn(() => Promise.resolve(true)),
      };
      const append = vi.fn(() => Promise.resolve({ id: "audit-1" }));
      const transactionRunner = {
        run: <Result>(
          operation: (repositories: {
            access: typeof access;
            auditEvents: { append: typeof append };
          }) => Promise<Result>,
        ) => operation({ access, auditEvents: { append } }),
      };

      await expect(
        manageGroupMember(
          {
            action,
            actorUserId: "owner-1",
            groupId: "group-1",
            now: new Date("2026-07-25T09:00:00.000Z"),
            targetUserId: "member-1",
          },
          transactionRunner,
        ),
      ).resolves.toEqual({
        role: expectedRole,
        userId: "member-1",
      });
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({ action: auditAction }),
      );
    },
  );

  it("creates and audits a group owner's pending platform-admin request", async () => {
    const access = {
      createAdminAccessRequest: vi.fn(() =>
        Promise.resolve({ id: "request-1", status: "pending" as const }),
      ),
      findPendingAdminAccessRequest: vi.fn(() => Promise.resolve(undefined)),
    };
    const append = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: typeof access;
          auditEvents: { append: typeof append };
        }) => Promise<Result>,
      ) => operation({ access, auditEvents: { append } }),
    };

    await expect(
      submitAdminAccessRequest(
        {
          actorUserId: "owner-1",
          groupId: "group-1",
        },
        transactionRunner,
      ),
    ).resolves.toEqual({ requestId: "request-1", status: "pending" });
    expect(access.createAdminAccessRequest).toHaveBeenCalledWith({
      groupId: "group-1",
      requesterUserId: "owner-1",
    });
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ action: "platform_admin.requested" }),
    );
  });

  it("rejects a second pending platform-admin request", async () => {
    const access = {
      createAdminAccessRequest: vi.fn(() =>
        Promise.resolve({ id: "request-2", status: "pending" as const }),
      ),
      findPendingAdminAccessRequest: vi.fn(() =>
        Promise.resolve({ id: "request-1", status: "pending" as const }),
      ),
    };
    const append = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: typeof access;
          auditEvents: { append: typeof append };
        }) => Promise<Result>,
      ) => operation({ access, auditEvents: { append } }),
    };

    await expect(
      submitAdminAccessRequest(
        {
          actorUserId: "owner-1",
          groupId: "group-1",
        },
        transactionRunner,
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A platform-admin request is already pending.",
    });
    expect(access.createAdminAccessRequest).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });
});
