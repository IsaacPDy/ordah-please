import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { orders } from "./ordering.js";
import { users } from "./identity.js";
const utc = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });
export const receiptSettings = pgTable(
  "order_receipt_settings",
  {
    orderId: uuid("order_id")
      .primaryKey()
      .references(() => orders.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(false).notNull(),
    mode: text("mode").default("group").notNull(),
    submitterIds: jsonb("submitter_ids")
      .$type<string[]>()
      .default([])
      .notNull(),
  },
  (table) => [
    check(
      "receipt_settings_mode",
      sql`${table.mode} in ('group', 'individual')`,
    ),
  ],
);
export const receiptUploads = pgTable("receipt_uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  participantUserId: uuid("participant_user_id").references(() => users.id),
  mode: text("mode").notNull(),
  amountCentavos: bigint("amount_centavos", { mode: "number" }).notNull(),
  note: text("note").default("").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  expiresAt: utc("expires_at").notNull(),
  finalizedAt: utc("finalized_at"),
});
export const receiptObjectCleanup = pgTable("receipt_object_cleanup", {
  objectKey: text("object_key").primaryKey(),
  notBefore: utc("not_before").defaultNow().notNull(),
  attempts: bigint("attempts", { mode: "number" }).default(0).notNull(),
});
