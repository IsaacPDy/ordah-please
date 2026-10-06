import { describe, expect, it, vi } from "vitest";
import {
  loadGroupMembersAsAdmin,
  setGroupMemberRoleAsAdmin,
} from "./group-members-admin-service";

function fixture() {
  const members = [
    {
      userId: "owner",
      displayName: "Owner",
      imageUrl: null,
      role: "owner" as const,
    },
    {
      userId: "person",
      displayName: "Person",
      imageUrl: null,
      role: "member" as const,
    },
  ];
  const repositories = {
    identityAccess: {
      findUserById: vi.fn((id: string) =>
        Promise.resolve({
          id,
          isPlatformAdmin: id === "admin",
          archivedAt: null as Date | null,
        }),
      ),
    },
    groupAccess: {
      findGroupSummary: vi.fn(() =>
        Promise.resolve({
          id: "group",
          name: "Friends",
          archivedAt: null as Date | null,
          ownerUserId: "owner",
        }),
      ),
      listActiveMembers: vi.fn(() => Promise.resolve(members)),
      setMembershipRole: vi.fn(() => Promise.resolve(true)),
    },
    auditEvents: { append: vi.fn(() => Promise.resolve({ id: "audit" })) },
  };
  return {
    repositories,
    runner: {
      run: <T>(operation: (r: typeof repositories) => Promise<T>) =>
        operation(repositories),
    },
  };
}
const command = {
  actorUserId: "admin",
  groupId: "group",
  userId: "person",
  expectedRole: "member" as const,
  role: "manager" as const,
};

describe("admin group members", () => {
  it("reads a group roster only for an active admin", async () => {
    const f = fixture();
    expect(
      await loadGroupMembersAsAdmin(
        { actorUserId: "admin", groupId: "group" },
        f.runner,
      ),
    ).toMatchObject({ name: "Friends" });
    await expect(
      loadGroupMembersAsAdmin(
        { actorUserId: "person", groupId: "group" },
        f.runner,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each([
    ["member", "manager"],
    ["manager", "member"],
  ] as const)("changes %s to %s and audits", async (expectedRole, role) => {
    const f = fixture();
    await setGroupMemberRoleAsAdmin(
      { ...command, expectedRole, role },
      f.runner,
    );
    expect(f.repositories.groupAccess.setMembershipRole).toHaveBeenCalledWith(
      "group",
      "person",
      expectedRole,
      role,
    );
    expect(f.repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.set_member_role",
        details: { previousRole: expectedRole, role },
      }),
    );
  });
  it.each(["owner", "manager", "member"])(
    "refuses a non-admin actor (%s)",
    async (actorUserId) => {
      const f = fixture();
      await expect(
        setGroupMemberRoleAsAdmin({ ...command, actorUserId }, f.runner),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        f.repositories.groupAccess.setMembershipRole,
      ).not.toHaveBeenCalled();
    },
  );
  it("refuses suspended admins and target users", async () => {
    for (const suspended of ["admin", "person"]) {
      const f = fixture();
      f.repositories.identityAccess.findUserById.mockImplementation((id) =>
        Promise.resolve({
          id,
          isPlatformAdmin: id === "admin",
          archivedAt: id === suspended ? new Date() : null,
        }),
      );
      await expect(
        setGroupMemberRoleAsAdmin(command, f.runner),
      ).rejects.toMatchObject({
        code: suspended === "admin" ? "FORBIDDEN" : "CONFLICT",
      });
      expect(
        f.repositories.groupAccess.setMembershipRole,
      ).not.toHaveBeenCalled();
    }
  });
  it("protects the owner and archived groups", async () => {
    const f = fixture();
    await expect(
      setGroupMemberRoleAsAdmin({ ...command, userId: "owner" }, f.runner),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    f.repositories.groupAccess.findGroupSummary.mockResolvedValue({
      id: "group",
      name: "Friends",
      archivedAt: new Date(),
      ownerUserId: "owner",
    });
    await expect(
      setGroupMemberRoleAsAdmin(command, f.runner),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.repositories.groupAccess.setMembershipRole).not.toHaveBeenCalled();
  });
  it("rejects removed, missing, or concurrently changed memberships without audit", async () => {
    const f = fixture();
    f.repositories.groupAccess.setMembershipRole.mockResolvedValue(false);
    await expect(
      setGroupMemberRoleAsAdmin(command, f.runner),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.repositories.auditEvents.append).not.toHaveBeenCalled();
  });
});
