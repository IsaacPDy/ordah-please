import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { adminRequestStatusEnum, membershipRoleEnum } from "./enums.js";

/** Creates a timezone-aware PostgreSQL timestamp column so persisted instants stay in UTC. */
const utcTimestamp = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id")
    .notNull()
    .unique("users_clerk_user_id_unique"),
  displayName: text("display_name").notNull(),
  isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  archivedAt: utcTimestamp("archived_at"),
});

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  archivedAt: utcTimestamp("archived_at"),
});

export const memberships = pgTable(
  "memberships",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: membershipRoleEnum("role").notNull(),
    joinedAt: utcTimestamp("joined_at").defaultNow().notNull(),
    removedAt: utcTimestamp("removed_at"),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    uniqueIndex("memberships_one_active_group_per_user")
      .on(table.userId)
      .where(sql`${table.removedAt} is null`),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    tokenHash: text("token_hash")
      .notNull()
      .unique("invitations_token_hash_unique"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id),
    expiresAt: utcTimestamp("expires_at").notNull(),
    acceptedAt: utcTimestamp("accepted_at"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "invitations_acceptance_fields_match",
      sql`(${table.acceptedAt} is null and ${table.acceptedByUserId} is null) or (${table.acceptedAt} is not null and ${table.acceptedByUserId} is not null)`,
    ),
  ],
);

export const adminAccessRequests = pgTable(
  "admin_access_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    status: adminRequestStatusEnum("status").default("pending").notNull(),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
    decisionReason: text("decision_reason"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    decidedAt: utcTimestamp("decided_at"),
  },
  (table) => [
    uniqueIndex("admin_access_requests_one_pending_per_user")
      .on(table.requesterUserId)
      .where(sql`${table.status} = 'pending'`),
    check(
      "admin_access_requests_decision_fields_match_status",
      sql`(${table.status} = 'pending' and ${table.decidedAt} is null and ${table.decidedByUserId} is null) or (${table.status} <> 'pending' and ${table.decidedAt} is not null and ${table.decidedByUserId} is not null)`,
    ),
  ],
);

export const groupAddresses = pgTable("group_addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .unique("group_addresses_group_id_unique")
    .references(() => groups.id),
  recipientName: text("recipient_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  lineOne: text("line_one").notNull(),
  lineTwo: text("line_two"),
  city: text("city").notNull(),
  postalCode: text("postal_code"),
  notes: text("notes"),
  updatedByUserId: uuid("updated_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
});
