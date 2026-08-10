import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type GroupId, type UserId } from "@ordah-please/domain";

import {
  createGroup,
  loadGroupDetails,
  renameGroup,
  rotateInviteLink,
} from "./group-service";

describe("loadGroupDetails", () => {
  it("returns the group summary, owner, and members for a non-owner viewer", async () => {
    const groupAccess = {
      findGroupSummary: vi.fn(() =>
        Promise.resolve({
          id: "group-1",
          name: "Phoenix",
          ownerUserId: "owner-1",
        }),
      ),
      listActiveMembers: vi.fn(() =>
        Promise.resolve([
          {
            displayName: "Owner Riley",
            role: "owner" as const,
            userId: "owner-1",
          },
          {
            displayName: "Member Sam",
            role: "member" as const,
            userId: "member-1",
          },
        ]),
      ),
      findActiveInviteLinkForGroup: vi.fn(() => Promise.resolve(undefined)),
    };
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          groupAccess: typeof groupAccess;
        }) => Promise<Result>,
      ) => operation({ groupAccess }),
    };

    const result = await loadGroupDetails(
      {
        groupId: parseId<GroupId>("group-1"),
        viewerRole: "member",
      },
      transactionRunner,
    );

    expect(result).toEqual({
      groupId: "group-1",
      name: "Phoenix",
      viewerRole: "member",
      owner: { userId: "owner-1", displayName: "Owner Riley" },
      members: [
        {
          userId: "owner-1",
          displayName: "Owner Riley",
          role: "group-owner",
        },
        {
          userId: "member-1",
          displayName: "Member Sam",
          role: "member",
        },
      ],
    });
    expect(result.inviteLink).toBeUndefined();
    expect(
      groupAccess.findActiveInviteLinkForGroup,
    ).not.toHaveBeenCalled();
  });

  it("includes the active invite link when the viewer is the group owner", async () => {
    const groupAccess = {
      findGroupSummary: vi.fn(() =>
        Promise.resolve({
          id: "group-1",
          name: "Phoenix",
          ownerUserId: "owner-1",
        }),
      ),
      listActiveMembers: vi.fn(() =>
        Promise.resolve([
          {
            displayName: "Owner Riley",
            role: "owner" as const,
            userId: "owner-1",
          },
        ]),
      ),
      findActiveInviteLinkForGroup: vi.fn(() =>
        Promise.resolve({
          id: "link-1",
          groupId: "group-1",
          tokenHash: "stored-hash",
          tokenPrefix: "abcdef12",
          createdByUserId: "owner-1",
          createdAt: new Date("2026-08-01T08:00:00.000Z"),
          rotatedAt: null,
          status: "active",
        }),
      ),
    };
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          groupAccess: typeof groupAccess;
        }) => Promise<Result>,
      ) => operation({ groupAccess }),
    };

    const result = await loadGroupDetails(
      {
        groupId: parseId<GroupId>("group-1"),
        viewerRole: "group-owner",
      },
      transactionRunner,
    );

    expect(result.owner).toEqual({
      userId: "owner-1",
      displayName: "Owner Riley",
    });
    expect(result.inviteLink).toEqual({
      publicValue: "stored-hash",
      tokenPrefix: "abcdef12",
    });
    expect(
      groupAccess.findActiveInviteLinkForGroup,
    ).toHaveBeenCalledWith("group-1");
  });

  it("fails with NOT_FOUND when the group does not exist", async () => {
    const groupAccess = {
      findGroupSummary: vi.fn(() => Promise.resolve(undefined)),
      listActiveMembers: vi.fn(() => Promise.resolve([])),
      findActiveInviteLinkForGroup: vi.fn(() => Promise.resolve(undefined)),
    };
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          groupAccess: typeof groupAccess;
        }) => Promise<Result>,
      ) => operation({ groupAccess }),
    };

    await expect(
      loadGroupDetails(
        {
          groupId: parseId<GroupId>("missing"),
          viewerRole: "member",
        },
        transactionRunner,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(groupAccess.listActiveMembers).not.toHaveBeenCalled();
  });
});

describe("renameGroup", () => {
  it("trims, validates, updates the name, and audits the change in one transaction", async () => {
    const groupAccess = {
      renameGroup: vi.fn(() => Promise.resolve({ id: "group-1" })),
    };
    const appendAudit = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          groupAccess: typeof groupAccess;
          auditEvents: { append: typeof appendAudit };
        }) => Promise<Result>,
      ) =>
        operation({
          groupAccess,
          auditEvents: { append: appendAudit },
        }),
    };

    const result = await renameGroup(
      {
        actorUserId: parseId<UserId>("owner-1"),
        groupId: parseId<GroupId>("group-1"),
        name: "  Phoenix Reborn  ",
      },
      transactionRunner,
    );

    expect(result).toEqual({ groupId: "group-1", name: "Phoenix Reborn" });
    expect(groupAccess.renameGroup).toHaveBeenCalledWith({
      groupId: "group-1",
      name: "Phoenix Reborn",
    });
    expect(appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "group.renamed",
        actorUserId: "owner-1",
        resourceId: "group-1",
        resourceType: "group",
      }),
    );
  });

  it("rejects an empty name before touching the database", async () => {
    const groupAccess = {
      renameGroup: vi.fn(() => Promise.resolve({ id: "group-1" })),
    };
    const appendAudit = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          groupAccess: typeof groupAccess;
          auditEvents: { append: typeof appendAudit };
        }) => Promise<Result>,
      ) =>
        operation({
          groupAccess,
          auditEvents: { append: appendAudit },
        }),
    };

    await expect(
      renameGroup(
        {
          actorUserId: parseId<UserId>("owner-1"),
          groupId: parseId<GroupId>("group-1"),
          name: "   ",
        },
        transactionRunner,
      ),
    ).rejects.toThrow();
    expect(groupAccess.renameGroup).not.toHaveBeenCalled();
    expect(appendAudit).not.toHaveBeenCalled();
  });
});

describe("rotateInviteLink", () => {
  it("marks the prior link rotated, mints a new active link, audits the change, and returns the new value", async () => {
    const priorLink = {
      id: "link-1",
      groupId: "group-1",
      tokenHash: "old-hash",
      tokenPrefix: "oldpre01",
      createdByUserId: "owner-1",
      createdAt: new Date("2026-07-01T08:00:00.000Z"),
      rotatedAt: null,
      status: "active" as const,
    };
    const groupAccess = {
      findActiveInviteLinkForGroup: vi.fn(() => Promise.resolve(priorLink)),
      markInviteLinkRotated: vi.fn(() => Promise.resolve(true)),
      createInviteLink: vi.fn(() =>
        Promise.resolve({
          id: "link-2",
          groupId: "group-1",
          tokenHash: "new-hash",
          tokenPrefix: "newpre01",
          createdByUserId: "owner-1",
          createdAt: new Date("2026-08-04T08:00:00.000Z"),
          rotatedAt: null,
          status: "active" as const,
        }),
      ),
    };
    const appendAudit = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          groupAccess: typeof groupAccess;
          auditEvents: { append: typeof appendAudit };
        }) => Promise<Result>,
      ) =>
        operation({
          groupAccess,
          auditEvents: { append: appendAudit },
        }),
    };

    const result = await rotateInviteLink(
      {
        actorUserId: parseId<UserId>("owner-1"),
        groupId: parseId<GroupId>("group-1"),
        now: new Date("2026-08-04T08:00:00.000Z"),
      },
      transactionRunner,
      () => ({
        publicValue: "fresh.public.value",
        tokenHash: "fresh-hash",
        tokenPrefix: "freshpre",
      }),
    );

    expect(result).toEqual({
      publicValue: "fresh.public.value",
      tokenPrefix: "freshpre",
    });
    expect(groupAccess.findActiveInviteLinkForGroup).toHaveBeenCalledWith(
      "group-1",
    );
    expect(groupAccess.markInviteLinkRotated).toHaveBeenCalledWith(
      "link-1",
      new Date("2026-08-04T08:00:00.000Z"),
    );
    expect(groupAccess.createInviteLink).toHaveBeenCalledWith({
      groupId: "group-1",
      tokenHash: "fresh-hash",
      tokenPrefix: "freshpre",
      createdByUserId: "owner-1",
      status: "active",
    });
    expect(appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "group.invite_link_rotated",
        actorUserId: "owner-1",
        resourceId: "group-1",
        resourceType: "group",
      }),
    );
  });

  it("does not require a prior link when none exists yet", async () => {
    const groupAccess = {
      findActiveInviteLinkForGroup: vi.fn(() => Promise.resolve(undefined)),
      markInviteLinkRotated: vi.fn(() => Promise.resolve(false)),
      createInviteLink: vi.fn(() =>
        Promise.resolve({
          id: "link-1",
          groupId: "group-1",
          tokenHash: "fresh-hash",
          tokenPrefix: "freshpre",
          createdByUserId: "owner-1",
          createdAt: new Date("2026-08-04T08:00:00.000Z"),
          rotatedAt: null,
          status: "active" as const,
        }),
      ),
    };
    const appendAudit = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          groupAccess: typeof groupAccess;
          auditEvents: { append: typeof appendAudit };
        }) => Promise<Result>,
      ) =>
        operation({
          groupAccess,
          auditEvents: { append: appendAudit },
        }),
    };

    const result = await rotateInviteLink(
      {
        actorUserId: parseId<UserId>("owner-1"),
        groupId: parseId<GroupId>("group-1"),
        now: new Date("2026-08-04T08:00:00.000Z"),
      },
      transactionRunner,
      () => ({
        publicValue: "fresh.public.value",
        tokenHash: "fresh-hash",
        tokenPrefix: "freshpre",
      }),
    );

    expect(result).toEqual({
      publicValue: "fresh.public.value",
      tokenPrefix: "freshpre",
    });
    expect(groupAccess.markInviteLinkRotated).not.toHaveBeenCalled();
    expect(groupAccess.createInviteLink).toHaveBeenCalledTimes(1);
    expect(appendAudit).toHaveBeenCalledTimes(1);
  });
});

describe("createGroup", () => {
  it("creates the group, owner membership, invite link, and audit rows in one transaction", async () => {
    const groupAccess = {
      createGroup: vi.fn(() =>
        Promise.resolve({ id: "group-1", name: "Phoenix" }),
      ),
      createInviteLink: vi.fn(() =>
        Promise.resolve({
          id: "link-1",
          groupId: "group-1",
          tokenHash: "fresh-hash",
          tokenPrefix: "freshpre",
          createdByUserId: "admin-1",
          createdAt: new Date("2026-08-04T08:00:00.000Z"),
          rotatedAt: null,
          status: "active" as const,
        }),
      ),
    };
    const identityAccess = {
      addMembership: vi.fn(() => Promise.resolve({ groupId: "group-1" })),
    };
    const appendAudit = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          groupAccess: typeof groupAccess;
          identityAccess: typeof identityAccess;
          auditEvents: { append: typeof appendAudit };
        }) => Promise<Result>,
      ) =>
        operation({
          groupAccess,
          identityAccess,
          auditEvents: { append: appendAudit },
        }),
    };

    const result = await createGroup(
      {
        actorUserId: parseId<UserId>("admin-1"),
        name: "  Phoenix  ",
        ownerId: parseId<UserId>("owner-1"),
      },
      transactionRunner,
      () => ({
        publicValue: "fresh.public.value",
        tokenHash: "fresh-hash",
        tokenPrefix: "freshpre",
      }),
    );

    expect(result).toEqual({
      groupId: "group-1",
      name: "Phoenix",
      ownerId: "owner-1",
      inviteLink: {
        publicValue: "fresh.public.value",
        tokenPrefix: "freshpre",
      },
    });
    expect(groupAccess.createGroup).toHaveBeenCalledWith({
      name: "Phoenix",
      createdByUserId: "admin-1",
    });
    expect(identityAccess.addMembership).toHaveBeenCalledWith({
      groupId: "group-1",
      role: "owner",
      userId: "owner-1",
    });
    expect(groupAccess.createInviteLink).toHaveBeenCalledWith({
      groupId: "group-1",
      tokenHash: "fresh-hash",
      tokenPrefix: "freshpre",
      createdByUserId: "admin-1",
      status: "active",
    });
    expect(appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "group.created",
        resourceId: "group-1",
        resourceType: "group",
      }),
    );
    expect(appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "group.invite_link_issued",
        resourceId: "group-1",
        resourceType: "group",
      }),
    );
  });

  it("rejects an empty group name before any database write", async () => {
    const groupAccess = {
      createGroup: vi.fn(() => Promise.resolve({ id: "group-1", name: "x" })),
      createInviteLink: vi.fn(() =>
        Promise.resolve({
          id: "link-1",
          groupId: "group-1",
          tokenHash: "fresh-hash",
          tokenPrefix: "freshpre",
          createdByUserId: "admin-1",
          createdAt: new Date("2026-08-04T08:00:00.000Z"),
          rotatedAt: null,
          status: "active" as const,
        }),
      ),
    };
    const identityAccess = {
      addMembership: vi.fn(() => Promise.resolve({ groupId: "group-1" })),
    };
    const appendAudit = vi.fn(() => Promise.resolve({ id: "audit-1" }));
    const transactionRunner = {
      run: <Result>(
        operation: (repositories: {
          groupAccess: typeof groupAccess;
          identityAccess: typeof identityAccess;
          auditEvents: { append: typeof appendAudit };
        }) => Promise<Result>,
      ) =>
        operation({
          groupAccess,
          identityAccess,
          auditEvents: { append: appendAudit },
        }),
    };

    await expect(
      createGroup(
        {
          actorUserId: parseId<UserId>("admin-1"),
          name: "   ",
          ownerId: parseId<UserId>("owner-1"),
        },
        transactionRunner,
        () => ({
          publicValue: "fresh.public.value",
          tokenHash: "fresh-hash",
          tokenPrefix: "freshpre",
        }),
      ),
    ).rejects.toThrow();
    expect(groupAccess.createGroup).not.toHaveBeenCalled();
    expect(identityAccess.addMembership).not.toHaveBeenCalled();
    expect(appendAudit).not.toHaveBeenCalled();
  });

  it("exposes the safe NOT_FOUND error code when used through PublicApiError", () => {
    const error = new PublicApiError("NOT_FOUND", "missing");
    expect(error.code).toBe("NOT_FOUND");
  });
});
