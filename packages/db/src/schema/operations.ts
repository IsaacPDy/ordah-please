import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { jobStatusEnum, notificationStatusEnum } from "./enums.js";
import { users } from "./identity.js";
import { orders } from "./ordering.js";

/** Creates a timezone-aware PostgreSQL timestamp column so persisted instants stay in UTC. */
const utcTimestamp = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipientUserId: uuid("recipient_user_id")
    .notNull()
    .references(() => users.id),
  orderId: uuid("order_id").references(() => orders.id),
  eventType: text("event_type").notNull(),
  status: notificationStatusEnum("status").default("pending").notNull(),
  providerMessageId: text("provider_message_id"),
  lastErrorCode: text("last_error_code"),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  deliveredAt: utcTimestamp("delivered_at"),
  readAt: utcTimestamp("read_at"),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").references(() => orders.id),
    kind: text("kind").notNull(),
    status: jobStatusEnum("status").default("pending").notNull(),
    idempotencyKey: text("idempotency_key")
      .notNull()
      .unique("jobs_idempotency_key_unique"),
    payload: jsonb("payload").default({}).notNull(),
    scheduledFor: utcTimestamp("scheduled_for").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    completedAt: utcTimestamp("completed_at"),
  },
  (table) => [
    check(
      "jobs_attempt_bounds",
      sql`${table.attempts} >= 0 and ${table.maxAttempts} > 0 and ${table.attempts} <= ${table.maxAttempts}`,
    ),
  ],
);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  idempotencyKey: text("idempotency_key").unique(
    "audit_events_idempotency_key_unique",
  ),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  details: jsonb("details").default({}).notNull(),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
});
