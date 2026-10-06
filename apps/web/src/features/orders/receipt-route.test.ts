import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicApiError } from "@ordah-please/contracts";
const mocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
  loadIdentity: vi.fn(),
  execute: vi.fn(),
  after: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./orders-runtime", () => ({
  ordersRuntime: {
    verifySession: mocks.verifySession,
    loadIdentity: mocks.loadIdentity,
  },
}));
vi.mock("./receipt-service", () => ({
  executeReceiptAction: mocks.execute,
  cleanupReceiptObjects: vi.fn(),
}));
import { receiptRoute } from "./receipt-route";
afterEach(() => {
  vi.resetAllMocks();
});
describe("receipt request boundary", () => {
  it("rejects cross-site writes before loading a session", async () => {
    const response = await receiptRoute(
      new Request("https://app.test/api/receipts", {
        method: "PATCH",
        headers: {
          Origin: "https://other.test",
          "sec-fetch-site": "cross-site",
        },
        body: "{}",
      }),
      "session",
      "settings",
    );
    expect(response.status).toBe(403);
    expect(mocks.verifySession).not.toHaveBeenCalled();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects anonymous receipt reads", async () => {
    mocks.verifySession.mockRejectedValue(
      new PublicApiError("UNAUTHENTICATED", "Sign in."),
    );
    const response = await receiptRoute(
      new Request("https://app.test/api/receipts"),
      "session",
      "list",
    );
    expect(response.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("redirects an authorized file without caching its signed URL", async () => {
    mocks.verifySession.mockResolvedValue({});
    mocks.loadIdentity.mockResolvedValue({ userId: "user" });
    mocks.execute.mockResolvedValue({ url: "https://files.test/private" });
    const response = await receiptRoute(
      new Request("https://app.test/api/receipts/file"),
      "session",
      "file",
      "receipt",
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://files.test/private");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "file",
        receiptId: "receipt",
        userId: "user",
      }),
      expect.anything(),
      expect.anything(),
    );
  });
});
