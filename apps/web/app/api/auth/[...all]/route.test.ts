import { describe, expect, it, vi } from "vitest";

import { createAuthRouteHandlers } from "./route";

describe("Better Auth route", () => {
  it.each(["GET", "POST"] as const)(
    "lazily delegates %s requests to Better Auth",
    async (method) => {
      const handler = vi.fn(() =>
        Promise.resolve(new Response(null, { status: 204 })),
      );
      const getAuth = vi.fn(() => ({ handler }));
      const route = createAuthRouteHandlers(getAuth);
      const request = new Request("https://example.test/api/auth/session", {
        method,
      });

      const response = await route[method](request);

      expect(response.status).toBe(204);
      expect(getAuth).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(request);
    },
  );

  it("preserves Better Auth rejection responses for untrusted origins", async () => {
    const rejected = Response.json(
      { code: "INVALID_ORIGIN", message: "Invalid origin" },
      { status: 403 },
    );
    const route = createAuthRouteHandlers(() => ({
      handler: () => Promise.resolve(rejected),
    }));

    const response = await route.POST(
      new Request("https://example.test/api/auth/sign-in/social", {
        headers: { origin: "https://attacker.example" },
        method: "POST",
      }),
    );

    expect(response).toBe(rejected);
    expect(response.status).toBe(403);
  });

  it("returns a safe error when configuration or startup fails", async () => {
    const route = createAuthRouteHandlers(() => {
      throw new Error(
        "GOOGLE_CLIENT_SECRET contained forbidden-secret-example-value",
      );
    });

    const response = await route.GET(
      new Request("https://example.test/api/auth/get-session"),
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain("Authentication is temporarily unavailable.");
    expect(body).not.toContain("GOOGLE_CLIENT_SECRET");
    expect(body).not.toContain("forbidden-secret-example-value");
  });
});
