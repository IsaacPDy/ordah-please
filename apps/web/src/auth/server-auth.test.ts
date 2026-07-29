import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { betterAuthSchema, buildServerAuthOptions } from "./server-auth";

const environment = {
  baseUrl: "https://preview.example.test",
  googleClientId: "google-client.apps.googleusercontent.com",
  googleClientSecret: "google-client-secret",
  isProduction: true,
  secret: "production-secret-with-at-least-32-characters",
} as const;

describe("Better Auth server configuration", () => {
  it("maps Better Auth models to the separate auth tables", () => {
    expect(
      Object.fromEntries(
        Object.entries(betterAuthSchema).map(([model, table]) => [
          model,
          getTableConfig(table).name,
        ]),
      ),
    ).toEqual({
      account: "auth_accounts",
      session: "auth_sessions",
      user: "auth_users",
      verification: "auth_verifications",
    });
  });

  it("enables only the approved Google and Expo session flow", () => {
    const options = buildServerAuthOptions(environment);

    expect(options.baseURL).toBe("https://preview.example.test");
    expect(options.emailAndPassword).toEqual({ enabled: false });
    expect(options.socialProviders).toEqual({
      google: {
        clientId: "google-client.apps.googleusercontent.com",
        clientSecret: "google-client-secret",
        scope: ["openid", "email", "profile"],
      },
    });
    expect(options.trustedOrigins).toEqual([
      "https://preview.example.test",
      "ordahplease://",
      "ordahplease://*",
    ]);
    expect(options.plugins?.map((plugin) => plugin.id)).toEqual(["expo"]);
  });

  it("uses UUIDs, application cookies, verified Google linking, and no self-deletion", () => {
    const options = buildServerAuthOptions(environment);

    expect(options.advanced).toMatchObject({
      cookiePrefix: "ordah-please",
      database: { generateId: "uuid" },
      useSecureCookies: true,
    });
    expect(options.user?.deleteUser).toEqual({ enabled: false });
    expect(options.account?.accountLinking).toMatchObject({
      allowDifferentEmails: false,
      enabled: true,
      trustedProviders: ["google"],
    });
  });
});
