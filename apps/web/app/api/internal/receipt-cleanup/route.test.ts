import { afterEach, describe, expect, it, vi } from "vitest";
const cleanup = vi.hoisted(() => vi.fn());
vi.mock("../../../../src/features/orders/receipt-service", () => ({
  cleanupReceiptObjects: cleanup,
}));
vi.mock("../../../../src/features/orders/receipt-route", () => ({
  receiptRunner: {},
  receiptStorage: () => ({}),
}));
import { GET } from "./route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("scheduled receipt cleanup", () => {
  it("fails closed without a configured secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(
      (await GET(new Request("https://app.test/api/internal/receipt-cleanup")))
        .status,
    ).toBe(503);
    expect(cleanup).not.toHaveBeenCalled();
  });
  it("rejects missing or incorrect credentials", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    for (const authorization of ["", "Bearer wrong", "Bearer test-secreu"]) {
      expect(
        (
          await GET(
            new Request("https://app.test/api/internal/receipt-cleanup", {
              headers: { authorization },
            }),
          )
        ).status,
      ).toBe(401);
    }
    expect(cleanup).not.toHaveBeenCalled();
  });
  it("runs cleanup only with the correct secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    cleanup.mockResolvedValue({ processed: 1 });
    const response = await GET(
      new Request("https://app.test/api/internal/receipt-cleanup", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
