/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it, vi } from "vitest";
import type { ReceiptsRepository } from "@ordah-please/db";
import type { ReceiptStorage } from "@ordah-please/storage";
import { executeReceiptAction, type ReceiptRunner } from "./receipt-service";
const actor = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const session = "33333333-3333-4333-8333-333333333333";
const uploadId = "44444444-4444-4444-8444-444444444444";
const context = {
  groupId: "group",
  state: "ordered",
  role: "member",
  userId: actor,
  participants: [
    { userId: actor, displayName: "Member" },
    { userId: other, displayName: "Other" },
  ],
  participantIds: [actor, other],
  activeMemberIds: [actor, other],
  sessionTotalCentavos: null,
  enabled: true,
  mode: "individual",
  submitterIds: [actor],
};
function setup(overrides: Record<string, unknown> = {}) {
  const repository = {
    loadContext: vi.fn(async () => ({ ...context, ...overrides })),
    list: vi.fn(async () => []),
    saveSessionTotal: vi.fn(async () => {}),
    saveSettings: vi.fn(async () => {}),
    createUpload: vi.fn(async (input: unknown) => input),
    findUpload: vi.fn(async () => ({
      id: uploadId,
      orderId: session,
      userId: actor,
      participantUserId: actor,
      mode: "individual",
      amountCentavos: 12000,
      note: "",
      contentType: "image/png",
      sizeBytes: 8,
      expiresAt: new Date(Date.now() + 300_000),
    })),
    findByUpload: vi.fn(async () => undefined),
    finalize: vi.fn(async () => ({ id: "receipt" })),
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
  const runner: ReceiptRunner = {
    run: async (operation) =>
      operation(repository as unknown as ReceiptsRepository),
  };
  const storage: ReceiptStorage = {
    uploadUrl: vi.fn(async () => "https://upload"),
    validateAndCopy: vi.fn(async () => {}),
    downloadUrl: vi.fn(async () => "https://download"),
    remove: vi.fn(async () => {}),
  };
  const execute = (action: string, input: unknown = {}) =>
    executeReceiptAction(
      { orderId: session, userId: actor, action, input },
      runner,
      () => storage,
    );
  return { repository, storage, execute };
}
describe("receipt service", () => {
  it("prepares an own-person upload with a server-generated key", async () => {
    const { execute, repository, storage } = setup();
    await execute("prepare", {
      contentType: "image/png",
      sizeBytes: 8,
      amountCentavos: 12000,
      note: "Meal",
      participantUserId: actor,
    });
    expect(repository.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actor,
        participantUserId: actor,
        mode: "individual",
        amountCentavos: 12000,
      }),
    );
    expect(storage.uploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^receipts\/pending\/[a-f0-9-]+$/),
      "image/png",
    );
  });
  it("rejects settings updates by a selected submitter", async () => {
    const { execute, repository } = setup();
    await expect(
      execute("settings", { enabled: true, mode: "group", submitterIds: [] }),
    ).rejects.toThrow();
    expect(repository.saveSettings).not.toHaveBeenCalled();
  });
  it("rechecks revoked permissions and disablement before finalizing", async () => {
    for (const overrides of [{ submitterIds: [] }, { enabled: false }]) {
      const { execute, storage, repository } = setup(overrides);
      await expect(execute("finalize", { uploadId })).rejects.toThrow();
      expect(storage.validateAndCopy).not.toHaveBeenCalled();
      expect(repository.finalize).not.toHaveBeenCalled();
    }
  });
  it("rejects finalization when the mode changed during upload", async () => {
    const { execute, storage } = setup({ mode: "group" });
    await expect(execute("finalize", { uploadId })).rejects.toThrow(
      "Receipt settings changed",
    );
    expect(storage.validateAndCopy).not.toHaveBeenCalled();
  });
  it("validates and copies before recording the receipt", async () => {
    const { execute, repository, storage } = setup();
    await execute("finalize", { uploadId });
    expect(storage.validateAndCopy).toHaveBeenCalledWith(
      `receipts/pending/${uploadId}`,
      `receipts/final/${uploadId}`,
      "image/png",
      8,
    );
    expect(repository.finalize).toHaveBeenCalledWith(
      expect.objectContaining({ id: uploadId }),
      "Member",
    );
  });
  it("does not publish invalid bytes", async () => {
    const { execute, storage, repository } = setup();
    vi.mocked(storage.validateAndCopy).mockRejectedValueOnce(
      new Error("Invalid file"),
    );
    await expect(execute("finalize", { uploadId })).rejects.toThrow(
      "Invalid file",
    );
    expect(repository.finalize).not.toHaveBeenCalled();
  });
  it("filters Individual receipts from a member's list", async () => {
    const { execute, repository } = setup();
    repository.list.mockResolvedValueOnce([
      {
        receipt: {
          id: "own",
          mode: "individual",
          participantUserId: actor,
          uploadedByUserId: actor,
          amountCentavos: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        file: { contentType: "image/png" },
        submitterName: "Member",
      },
      {
        receipt: {
          id: "other",
          mode: "individual",
          participantUserId: other,
          uploadedByUserId: other,
        },
        file: { contentType: "image/png" },
        submitterName: "Other",
      },
    ] as never);
    const result = (await execute("list")) as { receipts: { id: string }[] };
    expect(result.receipts.map((receipt) => receipt.id)).toEqual(["own"]);
  });
  it("owner can assign only valid current participants", async () => {
    const { execute } = setup({ role: "owner" });
    await expect(
      execute("prepare", {
        contentType: "image/png",
        sizeBytes: 8,
        amountCentavos: 1,
        participantUserId: "unknown",
      }),
    ).rejects.toThrow();
  });
});

describe("independent session total", () => {
  it.each(["owner", "manager"])(
    "allows %s to set and clear the total while receipts are disabled",
    async (role) => {
      const { execute, repository } = setup({ role, enabled: false });
      await execute("total", { sessionTotalCentavos: 45678 });
      expect(repository.saveSessionTotal).toHaveBeenCalledWith(session, 45678);
      await execute("total", { sessionTotalCentavos: null });
      expect(repository.saveSessionTotal).toHaveBeenLastCalledWith(
        session,
        null,
      );
      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.saveSettings).not.toHaveBeenCalled();
    },
  );
  it("denies members and removed managers", async () => {
    for (const role of ["member", null]) {
      const { execute, repository } = setup({ role });
      await expect(
        execute("total", { sessionTotalCentavos: 123 }),
      ).rejects.toThrow();
      expect(repository.saveSessionTotal).not.toHaveBeenCalled();
    }
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "123", undefined])(
    "rejects invalid totals %s",
    async (value) => {
      const { execute, repository } = setup({ role: "owner" });
      await expect(
        execute("total", { sessionTotalCentavos: value }),
      ).rejects.toThrow();
      expect(repository.saveSessionTotal).not.toHaveBeenCalled();
    },
  );
  it("exposes the independently saved total to participants", async () => {
    const { execute } = setup({ sessionTotalCentavos: 99900 });
    expect(await execute("list")).toMatchObject({
      sessionTotalCentavos: 99900,
      canSetSessionTotal: false,
    });
  });
});
