export const AUTH_IDENTITY_LINK_CONFIRMATION =
  "ordah-please-development-auth-link" as const;

export interface AuthIdentityLinkGuard {
  readonly confirmation: typeof AUTH_IDENTITY_LINK_CONFIRMATION;
  readonly environment: "development";
}

export interface AuthIdentityLinkInput {
  readonly authUserId: string;
  readonly productUserId: string;
}

export interface AuthIdentityLinkOperations {
  appendAudit(input: {
    readonly action: "identity.auth_linked";
    readonly resourceId: string;
    readonly resourceType: "user";
  }): Promise<void>;
  findAuthUser(
    authUserId: string,
  ): Promise<{ readonly id: string } | undefined>;
  findProductUser(productUserId: string): Promise<
    | {
        readonly archivedAt: Date | null;
        readonly authUserId: string | null;
        readonly id: string;
      }
    | undefined
  >;
  findProductUserByAuthUserId(
    authUserId: string,
  ): Promise<{ readonly id: string } | undefined>;
  linkProductUser(productUserId: string, authUserId: string): Promise<void>;
}

/** Validates the explicit development-only guard for controlled identity linking. */
export function readAuthIdentityLinkGuard(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthIdentityLinkGuard {
  if (
    environment.NODE_ENV !== "development" ||
    environment.VERCEL_ENV === "production"
  ) {
    throw new Error("Auth identity linking requires NODE_ENV=development.");
  }
  if (
    environment.DATABASE_IDENTITY_LINK_CONFIRMATION !==
    AUTH_IDENTITY_LINK_CONFIRMATION
  ) {
    throw new Error(
      "DATABASE_IDENTITY_LINK_CONFIRMATION must explicitly allow development linking.",
    );
  }

  return {
    confirmation: AUTH_IDENTITY_LINK_CONFIRMATION,
    environment: "development",
  };
}

/** Links one Better Auth identity to an existing product user without replacing product history. */
export async function linkAuthIdentity(
  input: AuthIdentityLinkInput,
  operations: AuthIdentityLinkOperations,
): Promise<{ readonly linked: true }> {
  const authUser = await operations.findAuthUser(input.authUserId);
  if (authUser === undefined) {
    throw new Error("The Better Auth user does not exist.");
  }

  const productUser = await operations.findProductUser(input.productUserId);
  if (productUser === undefined) {
    throw new Error("The product user does not exist.");
  }
  if (productUser.archivedAt !== null) {
    throw new Error("The product user is archived.");
  }
  if (productUser.authUserId !== null) {
    throw new Error("The product user already has an auth identity.");
  }

  const existingLink = await operations.findProductUserByAuthUserId(
    input.authUserId,
  );
  if (existingLink !== undefined) {
    throw new Error("The Better Auth user is already linked.");
  }

  await operations.linkProductUser(input.productUserId, input.authUserId);
  await operations.appendAudit({
    action: "identity.auth_linked",
    resourceId: input.productUserId,
    resourceType: "user",
  });

  return { linked: true };
}

/** Links and audits one development identity inside a single database transaction. */
export function linkAuthIdentityInDatabase(
  database: Database,
  input: AuthIdentityLinkInput,
  guard: AuthIdentityLinkGuard,
): Promise<{ readonly linked: true }> {
  if (
    guard.environment !== "development" ||
    guard.confirmation !== AUTH_IDENTITY_LINK_CONFIRMATION
  ) {
    throw new Error("Auth identity link guard is invalid.");
  }

  return withTransaction(database, (transaction) =>
    linkAuthIdentity(input, {
      appendAudit: async (auditInput) => {
        await transaction.insert(auditEvents).values(auditInput);
      },
      findAuthUser: async (authUserId) => {
        const [authUser] = await transaction
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.id, authUserId))
          .limit(1);
        return authUser;
      },
      findProductUser: async (productUserId) => {
        const [productUser] = await transaction
          .select({
            archivedAt: users.archivedAt,
            authUserId: users.authUserId,
            id: users.id,
          })
          .from(users)
          .where(eq(users.id, productUserId))
          .limit(1);
        return productUser;
      },
      findProductUserByAuthUserId: async (authUserId) => {
        const [productUser] = await transaction
          .select({ id: users.id })
          .from(users)
          .where(eq(users.authUserId, authUserId))
          .limit(1);
        return productUser;
      },
      linkProductUser: async (productUserId, authUserId) => {
        await transaction
          .update(users)
          .set({ authUserId, updatedAt: new Date() })
          .where(eq(users.id, productUserId));
      },
    }),
  );
}
import { eq } from "drizzle-orm";

import type { Database } from "../client.js";
import { auditEvents, authUsers, users } from "../schema/index.js";
import { withTransaction } from "../transaction.js";
