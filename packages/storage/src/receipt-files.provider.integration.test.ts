import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createReceiptStorage } from "./index.js";
describe("development private R2 receipts", () => {
  it("uploads, validates, copies, reads and removes only isolated test objects", async () => {
    const storage = createReceiptStorage();
    const prefix = `receipts/test/${randomUUID()}`;
    const staged = `${prefix}/pending`;
    const final = `${prefix}/final`;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
      "base64",
    );
    try {
      const upload = await fetch(await storage.uploadUrl(staged, "image/png"), {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: png,
      });
      expect(upload.status).toBe(200);
      await storage.validateAndCopy(staged, final, "image/png", png.length);
      const downloaded = await fetch(
        await storage.downloadUrl(final, "image/png"),
      );
      expect(downloaded.status).toBe(200);
      expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(png);
      const wrongSize = storage.validateAndCopy(
        staged,
        `${prefix}/bad`,
        "image/png",
        png.length + 1,
      );
      await expect(wrongSize).rejects.toThrow("declared type or size");
    } finally {
      await Promise.all([
        storage.remove(staged),
        storage.remove(final),
        storage.remove(`${prefix}/bad`),
      ]);
    }
  });
});
