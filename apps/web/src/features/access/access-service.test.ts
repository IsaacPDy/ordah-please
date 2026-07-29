import { describe, expect, it, vi } from "vitest";

import { acceptGroupInvitation, issueGroupInvitation } from "./access-service";

describe("access service", () => {
  it("persists only the invitation hash and audits owner issuance", async () => {
    const createInvitation = vi.fn(
      (_input: {
        createdByUserId: string;
        expiresAt: Date;
        groupId: string;
        tokenHash: string;
      }) => Promise.resolve({ id: "invitation-1" }),
    );
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
    const persistedInput = createInvitation.mock.calls[0]?.[0];
    expect(persistedInput).toBeDefined();
    expect(Object.hasOwn(persistedInput ?? {}, "publicToken")).toBe(false);
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
});
