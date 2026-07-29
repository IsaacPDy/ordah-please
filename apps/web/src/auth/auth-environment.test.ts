import { describe, expect, it } from "vitest";

import { readAuthEnvironment } from "./auth-environment";

const validEnvironment = {
  BETTER_AUTH_SECRET: "development-secret-with-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  NODE_ENV: "development",
} as const;

describe("readAuthEnvironment", () => {
  it("returns the explicit server-only authentication contract", () => {
    expect(readAuthEnvironment(validEnvironment)).toEqual({
      baseUrl: "http://localhost:3000",
      googleClientId: "google-client-id.apps.googleusercontent.com",
      googleClientSecret: "google-client-secret",
      isProduction: false,
      secret: "development-secret-with-at-least-32-characters",
    });
  });

  it.each([
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ] as const)("names missing %s without displaying another value", (name) => {
    const environment = { ...validEnvironment, [name]: undefined };

    expect(() => readAuthEnvironment(environment)).toThrowError(
      `${name} is required.`,
    );
    expect(() => readAuthEnvironment(environment)).not.toThrowError(
      /google-client-secret|development-secret/u,
    );
  });

  it("rejects an invalid or path-bearing Better Auth URL", () => {
    expect(() =>
      readAuthEnvironment({
        ...validEnvironment,
        BETTER_AUTH_URL: "not-a-url",
      }),
    ).toThrowError("BETTER_AUTH_URL must be an absolute HTTP(S) origin.");
    expect(() =>
      readAuthEnvironment({
        ...validEnvironment,
        BETTER_AUTH_URL: "https://example.test/auth/path",
      }),
    ).toThrowError("BETTER_AUTH_URL must not include a path.");
  });

  it("rejects a Better Auth secret shorter than 32 characters", () => {
    expect(() =>
      readAuthEnvironment({
        ...validEnvironment,
        BETTER_AUTH_SECRET: "too-short",
      }),
    ).toThrowError("BETTER_AUTH_SECRET must be at least 32 characters.");
  });
});
