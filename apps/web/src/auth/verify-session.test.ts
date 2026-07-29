import { describe, expect, it } from "vitest";

import { verifySession } from "./verify-session";

const AUTH_USER_ID = "10000000-0000-4000-8000-000000000001";

describe("verifySession", () => {
  it("rejects a request without a valid Better Auth session", async () => {
    await expect(
      verifySession(new Request("https://example.test/api/example"), () =>
        Promise.resolve(null),
      ),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
    });
  });

  it("passes request headers to Better Auth and returns trusted identity only", async () => {
    const request = new Request("https://example.test/api/example", {
      headers: { cookie: "ordah-please.session_token=signed-value" },
    });

    await expect(
      verifySession(request, ({ headers }) => {
        expect(headers).toBe(request.headers);
        return Promise.resolve({
          session: {
            expiresAt: new Date("2026-08-05T00:00:00.000Z"),
            id: "20000000-0000-4000-8000-000000000001",
          },
          user: {
            email: "private@example.test",
            id: AUTH_USER_ID,
            name: "Avery",
          },
        });
      }),
    ).resolves.toEqual({
      authUserId: AUTH_USER_ID,
      displayName: "Avery",
    });
  });

  it("rejects an explicitly expired session", async () => {
    await expect(
      verifySession(
        new Request("https://example.test/api/example"),
        () =>
          Promise.resolve({
            session: {
              expiresAt: new Date("2026-07-28T00:00:00.000Z"),
              id: "20000000-0000-4000-8000-000000000001",
            },
            user: {
              email: "private@example.test",
              id: AUTH_USER_ID,
              name: "Avery",
            },
          }),
        new Date("2026-07-29T00:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
