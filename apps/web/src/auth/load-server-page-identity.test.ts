import { describe, expect, it, vi } from "vitest";

import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type UserId } from "@ordah-please/domain";

import { loadServerPageIdentity } from "./load-server-page-identity";

const identity = {
  authUserId: "auth-user-1",
  isPlatformAdmin: false,
  memberships: [],
  userId: parseId<UserId>("user-1"),
} as const;

describe("loadServerPageIdentity", () => {
  it("verifies the page headers and loads the authenticated product identity", async () => {
    const verifySession = vi.fn((request: Request) => {
      expect(request.headers.get("cookie")).toBe("session=valid");
      return Promise.resolve({
        authUserId: "auth-user-1",
        displayName: "Avery",
      });
    });
    const loadIdentity = vi.fn(() => Promise.resolve(identity));

    await expect(
      loadServerPageIdentity(new Headers({ cookie: "session=valid" }), {
        loadIdentity,
        verifySession,
      }),
    ).resolves.toEqual({ identity, status: "authenticated" });
    expect(loadIdentity).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["UNAUTHENTICATED", "unauthenticated"],
    ["UNAVAILABLE", "unavailable"],
  ] as const)("maps %s into the safe %s page state", async (code, status) => {
    await expect(
      loadServerPageIdentity(new Headers(), {
        loadIdentity: () => Promise.resolve(identity),
        verifySession: () => {
          throw new PublicApiError(code, "Safe message.");
        },
      }),
    ).resolves.toEqual({ status });
  });

  it("does not hide unexpected implementation failures", async () => {
    await expect(
      loadServerPageIdentity(new Headers(), {
        loadIdentity: () => Promise.resolve(identity),
        verifySession: () => {
          throw new Error("unexpected failure");
        },
      }),
    ).rejects.toThrow("unexpected failure");
  });
});
