import { describe, expect, it, vi } from "vitest";
import {
  createMemberAsAdmin,
  linkMemberAsAdmin,
  type MemberLinkOperations,
} from "./member-link-service";

function operations(overrides = {}) {
  return {
    requireAdmin: vi.fn(() => Promise.resolve()),
    createMember: vi.fn(() => Promise.resolve({ id: "member" })),
    linkMember: vi.fn(() => Promise.resolve()),
    appendAudit: vi.fn(() => Promise.resolve()),
    ...overrides,
  } satisfies MemberLinkOperations;
}
describe("admin pre-added members", () => {
  it("creates a named member without asking for login or email", async () => {
    const ops = operations();
    expect(await createMemberAsAdmin("admin", "  Sam Friend  ", ops)).toEqual({
      userId: "member",
    });
    expect(ops.createMember).toHaveBeenCalledWith("Sam Friend");
    expect(ops.appendAudit).toHaveBeenCalledWith(
      "admin",
      "admin.create_member",
      "member",
      {},
    );
  });
  it.each(["", "   ", "x".repeat(121)])(
    "rejects invalid names",
    async (name) => {
      const ops = operations();
      await expect(
        createMemberAsAdmin("admin", name, ops),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(ops.createMember).not.toHaveBeenCalled();
    },
  );
  it("denies creation and linking before writes when the actor is not an admin", async () => {
    const ops = operations({
      requireAdmin: vi.fn(() => Promise.reject(new Error("denied"))),
    });
    await expect(createMemberAsAdmin("member", "Sam", ops)).rejects.toThrow(
      "denied",
    );
    await expect(
      linkMemberAsAdmin("member", "placeholder", "account", ops),
    ).rejects.toThrow("denied");
    expect(ops.createMember).not.toHaveBeenCalled();
    expect(ops.linkMember).not.toHaveBeenCalled();
  });
  it("links explicitly and audits both identities", async () => {
    const ops = operations();
    expect(
      await linkMemberAsAdmin("admin", "placeholder", "account", ops),
    ).toEqual({ userId: "account" });
    expect(ops.linkMember).toHaveBeenCalledWith("placeholder", "account");
    expect(ops.appendAudit).toHaveBeenCalledWith(
      "admin",
      "admin.link_member",
      "account",
      { memberUserId: "placeholder" },
    );
  });
  it("does not audit failed or self links", async () => {
    const ops = operations({
      linkMember: vi.fn(() => Promise.reject(new Error("conflict"))),
    });
    await expect(
      linkMemberAsAdmin("admin", "placeholder", "account", ops),
    ).rejects.toThrow("conflict");
    await expect(
      linkMemberAsAdmin("admin", "account", "account", ops),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(ops.appendAudit).not.toHaveBeenCalled();
  });
});
