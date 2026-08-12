import { describe, expect, it } from "vitest";

import {
  type BetterAuthSessionState,
  verifySession,
} from "./verify-session";

const AUTH_USER_ID = "10000000-0000-4000-8000-000000000001";
const now = new Date("2026-08-11T00:00:00.000Z");
const futureDate = new Date("2026-09-01T00:00:00.000Z");

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
            expiresAt: futureDate,
            id: "20000000-0000-4000-8000-000000000001",
          },
          user: {
            email: "private@example.test",
            id: AUTH_USER_ID,
            image: null,
            name: "Avery",
          },
        });
      }, now),
    ).resolves.toEqual({
      authUserId: AUTH_USER_ID,
      displayName: "Avery",
      email: "private@example.test",
      imageUrl: null,
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
              image: null,
              name: "Avery",
            },
          }),
        new Date("2026-07-29T00:00:00.000Z"),
      ),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("returns the auth user's email and image alongside the user id and name", async () => {
    const request = new Request("https://app.example.com/");
    const verify = () =>
      Promise.resolve<BetterAuthSessionState>({
        session: { expiresAt: futureDate, id: "session-1" },
        user: {
          email: "mia@example.com",
          id: "auth-1",
          image: "https://lh3.googleusercontent.com/mia.jpg",
          name: "Mia Tan",
        },
      });

    const session = await verifySession(request, verify, now);

    expect(session).toEqual({
      authUserId: "auth-1",
      displayName: "Mia Tan",
      email: "mia@example.com",
      imageUrl: "https://lh3.googleusercontent.com/mia.jpg",
    });
  });

  it("returns a null image url when the auth user has no picture", async () => {
    const request = new Request("https://app.example.com/");
    const verify = () =>
      Promise.resolve<BetterAuthSessionState>({
        session: { expiresAt: futureDate, id: "session-1" },
        user: {
          email: "mia@example.com",
          id: "auth-1",
          image: null,
          name: "Mia Tan",
        },
      });

    const session = await verifySession(request, verify, now);

    expect(session.imageUrl).toBeNull();
  });

  it("returns a null image url when the auth user omits a picture", async () => {
    const request = new Request("https://app.example.com/");
    const verify = () =>
      Promise.resolve<BetterAuthSessionState>({
        session: { expiresAt: futureDate, id: "session-1" },
        user: {
          email: "mia@example.com",
          id: "auth-1",
          name: "Mia Tan",
        },
      });

    const session = await verifySession(request, verify, now);

    expect(session.imageUrl).toBeNull();
  });
});
