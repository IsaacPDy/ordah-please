import { describe, expect, it } from "vitest";
import {
  assertFileSignature,
  readR2Config,
  createReceiptStorage,
} from "./index.js";
describe("private receipt storage", () => {
  it("binds an upload URL to its declared content type", async () => {
    const storage = createReceiptStorage({
      bucket: "test",
      endpoint: "https://test.r2.cloudflarestorage.com",
      accessKeyId: "test",
      secretAccessKey: "test",
    });
    const url = new URL(
      await storage.uploadUrl("receipts/pending/test", "image/png"),
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toContain(
      "content-type",
    );
  });
  it("rejects missing configuration without revealing credentials", () => {
    expect(() => readR2Config({})).toThrow(
      "Private receipt storage is not configured.",
    );
  });
  it("validates file bytes instead of trusting the claimed type", () => {
    expect(() =>
      assertFileSignature(
        "image/png",
        Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
      ),
    ).not.toThrow();
    expect(() =>
      assertFileSignature(
        "application/pdf",
        new TextEncoder().encode("%PDF-1.7"),
      ),
    ).not.toThrow();
    expect(() =>
      assertFileSignature("image/jpeg", Uint8Array.from([255, 216, 255, 224])),
    ).not.toThrow();
    expect(() =>
      assertFileSignature(
        "image/webp",
        new TextEncoder().encode("RIFF1234WEBP"),
      ),
    ).not.toThrow();
    expect(() =>
      assertFileSignature(
        "image/png",
        new TextEncoder().encode("<script>alert(1)</script>"),
      ),
    ).toThrow();
    expect(() =>
      assertFileSignature("image/jpeg", new TextEncoder().encode("%PDF-1.7")),
    ).toThrow();
  });
});
