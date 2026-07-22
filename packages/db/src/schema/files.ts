import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { filePurposeEnum, fileStatusEnum } from "./enums.js";
import { users } from "./identity.js";

/** Creates a timezone-aware PostgreSQL timestamp column so persisted instants stay in UTC. */
const utcTimestamp = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const fileRecords = pgTable(
  "file_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purpose: filePurposeEnum("purpose").notNull(),
    status: fileStatusEnum("status").default("pending").notNull(),
    objectKey: text("object_key")
      .notNull()
      .unique("file_records_object_key_unique"),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    finalizedAt: utcTimestamp("finalized_at"),
  },
  (table) => [
    check("file_records_non_negative_size", sql`${table.sizeBytes} >= 0`),
  ],
);
