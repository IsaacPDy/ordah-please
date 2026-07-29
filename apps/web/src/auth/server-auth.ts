import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
  createDatabaseClient,
  type Database,
  type DatabaseClient,
} from "@ordah-please/db";
import { betterAuth, type BetterAuthOptions } from "better-auth";

import { readAuthEnvironment, type AuthEnvironment } from "./auth-environment";

export const betterAuthSchema = {
  account: authAccounts,
  session: authSessions,
  user: authUsers,
  verification: authVerifications,
} as const;

/** Builds the provider configuration that Better Auth applies around the database adapter. */
export function buildServerAuthOptions(
  environment: AuthEnvironment,
): BetterAuthOptions {
  return {
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        enabled: true,
        trustedProviders: ["google"],
      },
    },
    advanced: {
      cookiePrefix: "ordah-please",
      database: { generateId: "uuid" },
      useSecureCookies: environment.isProduction,
    },
    appName: "ordah please",
    baseURL: environment.baseUrl,
    emailAndPassword: { enabled: false },
    plugins: [expo()],
    secret: environment.secret,
    socialProviders: {
      google: {
        clientId: environment.googleClientId,
        clientSecret: environment.googleClientSecret,
        scope: ["openid", "email", "profile"],
      },
    },
    trustedOrigins: [environment.baseUrl, "ordahplease://", "ordahplease://*"],
    user: {
      deleteUser: { enabled: false },
    },
  };
}

/** Creates the Better Auth server around the shared Drizzle database connection. */
export function createServerAuth(
  database: Database,
  environment: AuthEnvironment = readAuthEnvironment(),
) {
  return betterAuth({
    ...buildServerAuthOptions(environment),
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: betterAuthSchema,
      transaction: true,
    }),
  });
}

export type ServerAuth = ReturnType<typeof createServerAuth>;

let runtimeAuth: ServerAuth | undefined;
let runtimeDatabaseClient: DatabaseClient | undefined;

/** Returns one lazy server auth instance so builds do not require live credentials at import time. */
export function getServerAuth(): ServerAuth {
  runtimeDatabaseClient ??= createDatabaseClient();
  runtimeAuth ??= createServerAuth(runtimeDatabaseClient.database);
  return runtimeAuth;
}
