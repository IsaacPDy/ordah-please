import { afterEach, describe, expect, it, vi } from "vitest";

const originalAppBaseUrl = process.env.APP_BASE_URL;

afterEach(() => {
  if (originalAppBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
  } else {
    process.env.APP_BASE_URL = originalAppBaseUrl;
  }
  vi.resetModules();
});

describe("invitation route modules", () => {
  it("loads issue and acceptance routes without build-time runtime configuration", async () => {
    delete process.env.APP_BASE_URL;
    vi.resetModules();

    const issueRoute = await import("./route");
    const acceptRoute = await import("./accept/route");

    expect(typeof issueRoute.POST).toBe("function");
    expect(typeof acceptRoute.POST).toBe("function");
  });
});
