import { relations, sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Creates a timezone-aware PostgreSQL timestamp column so auth instants stay in UTC. */
const utcTimestamp = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const authUsers = pgTable(
  "auth_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("auth_users_normalized_email_unique").on(
      sql`lower(${table.email})`,
    ),
  ],
);

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  expiresAt: utcTimestamp("expires_at").notNull(),
  token: text("token").notNull().unique("auth_sessions_token_unique"),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
});

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: utcTimestamp("access_token_expires_at"),
    refreshTokenExpiresAt: utcTimestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("auth_accounts_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const authVerifications = pgTable("auth_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: utcTimestamp("expires_at").notNull(),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
});

/** Declares auth-only joins so Better Auth can resolve related records in a single read. */
export const authUsersRelations = relations(authUsers, ({ many }) => ({
  sessions: many(authSessions),
  accounts: many(authAccounts),
}));

/** Keeps each session's trusted auth user available to the relational adapter. */
export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(authUsers, {
    fields: [authSessions.userId],
    references: [authUsers.id],
  }),
}));

/** Keeps account joins within authentication tables, separate from product permissions. */
export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(authUsers, {
    fields: [authAccounts.userId],
    references: [authUsers.id],
  }),
}));
