import { getTableConfig } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import * as schema from "@ordah-please/db";

import {
  betterAuthSchema,
  buildServerAuthOptions,
  createServerAuth,
} from "./server-auth";

const environment = {
  baseUrl: "https://preview.example.test",
  googleClientId: "google-client.apps.googleusercontent.com",
  googleClientSecret: "google-client-secret",
  isProduction: true,
  secret: "production-secret-with-at-least-32-characters",
} as const;

describe("Better Auth server configuration", () => {
  it("resolves a live session and its auth user in one database trip", async () => {
    const userId = "10000000-0000-4000-8000-000000000001";
    const now = new Date();
    const timestamp = now.toISOString();
    const expiresAt = new Date(now.getTime() + 60_000).toISOString();
    const sessionRow = [
      "20000000-0000-4000-8000-000000000001",
      expiresAt,
      "test-session-token",
      timestamp,
      timestamp,
      null,
      null,
      userId,
    ];
    const userRow = [
      userId,
      "Avery",
      "avery@example.test",
      true,
      null,
      timestamp,
      timestamp,
    ];
    const query = vi.fn((input: { readonly text: string }) =>
      Promise.resolve({
        rows: input.text.includes("json_build_array")
          ? [[...sessionRow, userRow]]
          : input.text.includes('"auth_sessions"')
            ? [sessionRow]
            : [userRow],
      }),
    );
    const database = drizzle({ client: { query } as unknown as Pool, schema });
    const auth = createServerAuth(database, environment);
    const context = await auth.$context;

    const result =
      await context.internalAdapter.findSession("test-session-token");

    expect(result?.user).toMatchObject({ id: userId, name: "Avery" });
    expect(result?.session.expiresAt).toEqual(new Date(expiresAt));
    expect(query).toHaveBeenCalledTimes(1);
  });

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
