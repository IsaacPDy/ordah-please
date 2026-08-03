import { describe, expect, it, vi } from "vitest";

import {
  acceptGroupInvitation,
  decideAdminAccessRequest,
  issueGroupInvitation,
  listPendingAdminAccessRequests,
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

  it("returns a stable conflict when another invitation already created the membership", async () => {
    const access = {
      acceptInvitation: vi.fn(() => Promise.resolve(true)),
      addMembership: vi.fn(() => Promise.resolve(undefined)),
      findInvitationByTokenHash: vi.fn(() =>
        Promise.resolve({
          acceptedAt: null,
          expiresAt: new Date("2026-07-26T08:00:00.000Z"),
          groupId: "group-1",
          id: "invitation-2",
        }),
      ),
      listActiveMemberships: vi.fn(() => Promise.resolve([])),
    };
    const append = vi.fn(() => Promise.resolve({ id: "audit-1" }));

    await expect(
      acceptGroupInvitation(
        {
          deploymentId: "preview.ordah-please.test",
          now: new Date("2026-07-25T08:00:00.000Z"),
          publicToken: "second-token",
          userId: "user-1",
        },
        {
          run: (operation) => operation({ access, auditEvents: { append } }),
        },
        () => "persisted-hash",
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Your account already belongs to this group.",
    });
    expect(append).not.toHaveBeenCalled();
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
      "manager",
    );
    expect(append).not.toHaveBeenCalled();
  });

  it("rejects member actions against a Group Owner without writing an audit", async () => {
    const access = {
      listActiveMembers: vi.fn(() =>
        Promise.resolve([
          {
            displayName: "Owner",
            role: "owner" as const,
            userId: "owner-2",
          },
        ]),
      ),
      removeMembership: vi.fn(() => Promise.resolve(true)),
      setMembershipRole: vi.fn(() => Promise.resolve(true)),
    };
    const append = vi.fn(() => Promise.resolve({ id: "audit-1" }));

    await expect(
      manageGroupMember(
        {
          action: "remove",
          actorUserId: "owner-1",
          groupId: "group-1",
          now: new Date("2026-07-25T09:00:00.000Z"),
          targetUserId: "owner-2",
        },
        {
          run: (operation) => operation({ access, auditEvents: { append } }),
        },
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This member action is not available.",
    });
    expect(access.removeMembership).not.toHaveBeenCalled();
    expect(access.setMembershipRole).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it("accepts a second group when the authenticated user belongs to another group", async () => {
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
    ).resolves.toEqual({ groupId: "group-2", role: "member" });
    expect(access.acceptInvitation).toHaveBeenCalledWith(
      "invitation-1",
      "user-1",
      new Date("2026-07-25T08:00:00.000Z"),
    );
    expect(access.addMembership).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: "group-2", userId: "user-1" }),
    );
  });

  it("rejects a duplicate membership in the invitation group", async () => {
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
        Promise.resolve([{ groupId: "group-2" }]),
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
      message: "Your account already belongs to this group.",
    });
    expect(access.acceptInvitation).not.toHaveBeenCalled();
    expect(access.addMembership).not.toHaveBeenCalled();
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
      expectedRole: "manager" as const,
    },
    {
      action: "demote" as const,
      auditAction: "group.member_demoted",
      currentRole: "manager" as const,
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

const baseDecisionRequest = {
  decidedAt: null,
  decidedByUserId: null,
  createdAt: new Date("2026-07-28T08:00:00.000Z"),
  groupId: "group-1",
  id: "req-1",
  requesterUserId: "owner-1",
  status: "pending" as const,
  decisionReason: null,
};

describe("decideAdminAccessRequest", () => {
  it("approves a pending request, promotes the requester, and writes one idempotent audit row", async () => {
    const findAdminAccessRequestById = vi.fn(() =>
      Promise.resolve(baseDecisionRequest),
    );
    const decideAdminAccessRequestRepo = vi.fn(() =>
      Promise.resolve({
        ...baseDecisionRequest,
        decidedAt: new Date("2026-07-30T08:00:00.000Z"),
        decidedByUserId: "admin-1",
        status: "approved" as const,
      }),
    );
    const promoteToPlatformAdmin = vi.fn(() => Promise.resolve(true));
    const appendOnce = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: {
            findAdminAccessRequestById: typeof findAdminAccessRequestById;
            decideAdminAccessRequest: typeof decideAdminAccessRequestRepo;
            promoteToPlatformAdmin: typeof promoteToPlatformAdmin;
          };
          auditEvents: { appendOnce: typeof appendOnce };
        }) => Promise<Result>,
      ) =>
        operation({
          access: {
            decideAdminAccessRequest: decideAdminAccessRequestRepo,
            findAdminAccessRequestById,
            promoteToPlatformAdmin,
          },
          auditEvents: { appendOnce },
        }),
    };

    const result = await decideAdminAccessRequest(
      {
        actorUserId: "admin-1",
        decision: "approved",
        now: new Date("2026-07-30T08:00:00.000Z"),
        requestId: "req-1",
      },
      transactionRunner,
    );

    expect(result).toEqual({ requestId: "req-1", status: "approved" });
    expect(promoteToPlatformAdmin).toHaveBeenCalledWith("owner-1");
    expect(appendOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform_admin.approved",
        actorUserId: "admin-1",
        idempotencyKey: "platform_admin:decide:req-1:approved",
        resourceId: "req-1",
        resourceType: "admin_access_request",
      }),
    );
  });

  it("rejects a pending request without promoting and writes the rejected audit row", async () => {
    const findAdminAccessRequestById = vi.fn(() =>
      Promise.resolve(baseDecisionRequest),
    );
    const decideAdminAccessRequestRepo = vi.fn(() =>
      Promise.resolve({
        ...baseDecisionRequest,
        decidedAt: new Date("2026-07-30T08:00:00.000Z"),
        decidedByUserId: "admin-1",
        decisionReason: "Not yet.",
        status: "rejected" as const,
      }),
    );
    const promoteToPlatformAdmin = vi.fn(() => Promise.resolve(true));
    const appendOnce = vi.fn(() => Promise.resolve({ id: "audit-2" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: {
            findAdminAccessRequestById: typeof findAdminAccessRequestById;
            decideAdminAccessRequest: typeof decideAdminAccessRequestRepo;
            promoteToPlatformAdmin: typeof promoteToPlatformAdmin;
          };
          auditEvents: { appendOnce: typeof appendOnce };
        }) => Promise<Result>,
      ) =>
        operation({
          access: {
            decideAdminAccessRequest: decideAdminAccessRequestRepo,
            findAdminAccessRequestById,
            promoteToPlatformAdmin,
          },
          auditEvents: { appendOnce },
        }),
    };

    const result = await decideAdminAccessRequest(
      {
        actorUserId: "admin-1",
        decision: "rejected",
        now: new Date("2026-07-30T08:00:00.000Z"),
        reason: "Not yet.",
        requestId: "req-1",
      },
      transactionRunner,
    );

    expect(result).toEqual({ requestId: "req-1", status: "rejected" });
    expect(promoteToPlatformAdmin).not.toHaveBeenCalled();
    expect(appendOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform_admin.rejected",
        idempotencyKey: "platform_admin:decide:req-1:rejected",
      }),
    );
  });

  it("fails with NOT_FOUND when the request does not exist", async () => {
    const findAdminAccessRequestById = vi.fn(() => Promise.resolve(undefined));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: {
            findAdminAccessRequestById: typeof findAdminAccessRequestById;
            decideAdminAccessRequest: () => Promise<never>;
            promoteToPlatformAdmin: () => Promise<never>;
          };
          auditEvents: { appendOnce: () => Promise<never> };
        }) => Promise<Result>,
      ) =>
        operation({
          access: {
            decideAdminAccessRequest: vi.fn(() =>
              Promise.reject(new Error("decide should not be called")),
            ),
            findAdminAccessRequestById,
            promoteToPlatformAdmin: vi.fn(() =>
              Promise.reject(new Error("promote should not be called")),
            ),
          },
          auditEvents: {
            appendOnce: vi.fn(() =>
              Promise.reject(new Error("audit should not be called")),
            ),
          },
        }),
    };

    await expect(
      decideAdminAccessRequest(
        {
          actorUserId: "admin-1",
          decision: "approved",
          now: new Date("2026-07-30T08:00:00.000Z"),
          requestId: "missing",
        },
        transactionRunner,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("fails with CONFLICT when the request is no longer pending", async () => {
    const findAdminAccessRequestById = vi.fn(() =>
      Promise.resolve({
        ...baseDecisionRequest,
        status: "approved" as const,
      }),
    );
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: {
            findAdminAccessRequestById: typeof findAdminAccessRequestById;
            decideAdminAccessRequest: () => Promise<never>;
            promoteToPlatformAdmin: () => Promise<never>;
          };
          auditEvents: { appendOnce: () => Promise<never> };
        }) => Promise<Result>,
      ) =>
        operation({
          access: {
            decideAdminAccessRequest: vi.fn(() =>
              Promise.reject(new Error("decide should not be called")),
            ),
            findAdminAccessRequestById,
            promoteToPlatformAdmin: vi.fn(() =>
              Promise.reject(new Error("promote should not be called")),
            ),
          },
          auditEvents: {
            appendOnce: vi.fn(() =>
              Promise.reject(new Error("audit should not be called")),
            ),
          },
        }),
    };

    await expect(
      decideAdminAccessRequest(
        {
          actorUserId: "admin-1",
          decision: "approved",
          now: new Date("2026-07-30T08:00:00.000Z"),
          requestId: "req-1",
        },
        transactionRunner,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("fails with FORBIDDEN when the admin is the requester", async () => {
    const findAdminAccessRequestById = vi.fn(() =>
      Promise.resolve({
        ...baseDecisionRequest,
        requesterUserId: "admin-1",
      }),
    );
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: {
            findAdminAccessRequestById: typeof findAdminAccessRequestById;
            decideAdminAccessRequest: () => Promise<never>;
            promoteToPlatformAdmin: () => Promise<never>;
          };
          auditEvents: { appendOnce: () => Promise<never> };
        }) => Promise<Result>,
      ) =>
        operation({
          access: {
            decideAdminAccessRequest: vi.fn(() =>
              Promise.reject(new Error("decide should not be called")),
            ),
            findAdminAccessRequestById,
            promoteToPlatformAdmin: vi.fn(() =>
              Promise.reject(new Error("promote should not be called")),
            ),
          },
          auditEvents: {
            appendOnce: vi.fn(() =>
              Promise.reject(new Error("audit should not be called")),
            ),
          },
        }),
    };

    await expect(
      decideAdminAccessRequest(
        {
          actorUserId: "admin-1",
          decision: "approved",
          now: new Date("2026-07-30T08:00:00.000Z"),
          requestId: "req-1",
        },
        transactionRunner,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("listPendingAdminAccessRequests", () => {
  it("returns the repository rows untouched", async () => {
    const listPendingAdminAccessRequestsRepo = vi.fn(() =>
      Promise.resolve([
        {
          createdAt: new Date("2026-07-28T08:00:00.000Z"),
          groupId: "group-1",
          groupName: "Phoenix",
          id: "req-1",
          requesterDisplayName: "Owner Riley",
          requesterUserId: "owner-1",
          status: "pending" as const,
        },
      ]),
    );
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: {
            listPendingAdminAccessRequests: typeof listPendingAdminAccessRequestsRepo;
          };
        }) => Promise<Result>,
      ) =>
        operation({
          access: {
            listPendingAdminAccessRequests: listPendingAdminAccessRequestsRepo,
          },
        }),
    };

    const result = await listPendingAdminAccessRequests(transactionRunner);

    expect(result).toEqual({
      requests: [
        {
          createdAt: "2026-07-28T08:00:00.000Z",
          groupId: "group-1",
          groupName: "Phoenix",
          id: "req-1",
          requesterDisplayName: "Owner Riley",
          requesterUserId: "owner-1",
          status: "pending",
        },
      ],
    });
  });

  it("returns an empty list when no pending requests exist", async () => {
    const listPendingAdminAccessRequestsRepo = vi.fn(() => Promise.resolve([]));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          access: {
            listPendingAdminAccessRequests: typeof listPendingAdminAccessRequestsRepo;
          };
        }) => Promise<Result>,
      ) =>
        operation({
          access: {
            listPendingAdminAccessRequests: listPendingAdminAccessRequestsRepo,
          },
        }),
    };

    const result = await listPendingAdminAccessRequests(transactionRunner);

    expect(result).toEqual({ requests: [] });
  });
});
