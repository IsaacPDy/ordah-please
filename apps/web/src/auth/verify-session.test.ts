import { describe, expect, it } from "vitest";

import { verifySession } from "./verify-session";

describe("verifySession", () => {
  it("rejects a request without an authenticated Clerk user", async () => {
    await expect(
      verifySession(() =>
        Promise.resolve({
          isAuthenticated: false,
          userId: null,
        }),
      ),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Sign in is required.",
    });
  });

  it("returns the stable Clerk user ID from a verified session", async () => {
    await expect(
      verifySession(() =>
        Promise.resolve({
          isAuthenticated: true,
          userId: "user_clerk_123",
        }),
      ),
    ).resolves.toEqual({ clerkUserId: "user_clerk_123" });
  });
});
