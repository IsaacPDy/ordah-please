import { PublicApiError } from "@ordah-please/contracts";
import { parseId, type UserId } from "@ordah-please/domain";
import { describe, expect, it } from "vitest";

import type { AppIdentity } from "../auth/load-app-identity";
import { executeRoute } from "./execute-route";

const memberIdentity = {
  authUserId: "10000000-0000-4000-8000-000000000001",
  displayName: "Avery",
  email: "avery@example.com",
  imageUrl: null,
  isPlatformAdmin: false,
  memberships: [],
  userId: parseId<UserId>("internal-user-1"),
} as const satisfies AppIdentity;

describe("executeRoute", () => {
  it("runs the authenticated route sequence before serializing success", async () => {
    const sequence: string[] = [];
    const request = new Request("https://example.test/api/example", {
      method: "POST",
    });
    const identity = memberIdentity;

    const response = await executeRoute(
      request,
      {
        authorize: ({ input, identity: loadedIdentity }) => {
          sequence.push("authorize");
          return input.name === "Lunch" && loadedIdentity === identity;
        },
        execute: ({ input }) => {
          sequence.push("execute");
          return { name: input.name };
        },
        validate: () => {
          sequence.push("validate");
          return { name: "Lunch" };
        },
      },
      {
        loadIdentity: (session) => {
          sequence.push("load-identity");
          expect(session).toEqual({
            authUserId: "10000000-0000-4000-8000-000000000001",
            displayName: "Avery",
            email: "avery@example.com",
            imageUrl: null,
          });
          return identity;
        },
        verifySession: () => {
          sequence.push("authenticate");
          return {
            authUserId: "10000000-0000-4000-8000-000000000001",
            displayName: "Avery",
            email: "avery@example.com",
            imageUrl: null,
          };
        },
      },
    );

    expect(sequence).toEqual([
      "authenticate",
      "load-identity",
      "validate",
      "authorize",
      "execute",
    ]);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { name: "Lunch" },
      ok: true,
    });
  });

  it("returns a safe 401 and stops when session verification fails", async () => {
    let validationStarted = false;
    const response = await executeRoute(
      new Request("https://example.test/api/example"),
      {
        authorize: () => true,
        execute: () => ({ unreachable: true }),
        validate: () => {
          validationStarted = true;
          return {};
        },
      },
      {
        loadIdentity: () => memberIdentity,
        verifySession: () => {
          throw new PublicApiError("UNAUTHENTICATED", "Sign in is required.");
        },
      },
    );

    expect(validationStarted).toBe(false);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Sign in is required.",
      },
      ok: false,
    });
  });

  it("returns a safe 403 when the loaded identity fails authorization", async () => {
    const identity = memberIdentity;
    const response = await executeRoute(
      new Request("https://example.test/api/admin"),
      {
        authorize: () => false,
        execute: () => ({ unreachable: true }),
        validate: () => ({}),
      },
      {
        loadIdentity: () => identity,
        verifySession: () => ({
          authUserId: "10000000-0000-4000-8000-000000000001",
          displayName: "Avery",
          email: "avery@example.com",
          imageUrl: null,
        }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You do not have access to this action.",
      },
      ok: false,
    });
  });

  it("hides unexpected internal details behind the stable failure envelope", async () => {
    const identity = memberIdentity;
    const response = await executeRoute(
      new Request("https://example.test/api/example"),
      {
        authorize: () => true,
        execute: () => {
          throw new Error("database password and SQL details");
        },
        validate: () => ({}),
      },
      {
        loadIdentity: () => identity,
        verifySession: () => ({
          authUserId: "10000000-0000-4000-8000-000000000001",
          displayName: "Avery",
          email: "avery@example.com",
          imageUrl: null,
        }),
      },
    );

    expect(response.status).toBe(500);
    const body: unknown = await response.json();
    expect(body).toEqual({
      error: {
        code: "INTERNAL_FAILURE",
        message: "Something went wrong.",
      },
      ok: false,
    });
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it.each([
    ["INVALID_INPUT", 400],
    ["CONFLICT", 409],
    ["UNAVAILABLE", 503],
    ["INTERNAL_FAILURE", 500],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["UNAUTHENTICATED", 401],
  ] as const)("maps %s to HTTP %i", async (code, status) => {
    const response = await executeRoute(
      new Request("https://example.test/api/example"),
      {
        authorize: () => true,
        execute: () => ({ unreachable: true }),
        validate: () => {
          throw new PublicApiError(code, "Safe public message.");
        },
      },
      {
        loadIdentity: () => memberIdentity,
        verifySession: () => ({
          authUserId: "10000000-0000-4000-8000-000000000001",
          displayName: "Avery",
          email: "avery@example.com",
          imageUrl: null,
        }),
      },
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: { code, message: "Safe public message." },
      ok: false,
    });
  });
});
