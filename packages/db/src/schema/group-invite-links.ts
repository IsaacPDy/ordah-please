import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamp } from "drizzle-orm/pg-core";

import { groups, users } from "./identity.js";

/** Creates a timezone-aware PostgreSQL timestamp column so persisted instants stay in UTC. */
const utcTimestamp = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

/**
 * Persistent, multi-use, deployment-bound invite links for group membership.
 *
 * The raw public link value is never stored — only its sha256 hash and a short
 * non-secret prefix used for display ("link ending in …abc"). One row per group
 * may be active at a time; rotating a link marks the prior row `rotated` and
 * inserts a new `active` row in the same transaction.
 */
export const groupInviteLinks = pgTable(
  "group_invite_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    rotatedAt: utcTimestamp("rotated_at"),
    status: text("status").notNull(),
  },
  (table) => [
    uniqueIndex("group_invite_links_one_active_per_group")
      .on(table.groupId)
      .where(sql`${table.status} = 'active'`),
    check(
      "group_invite_links_status_values",
      sql`${table.status} in ('active', 'rotated')`,
    ),
    check(
      "group_invite_links_rotated_fields_match",
      sql`(${table.status} = 'active' and ${table.rotatedAt} is null) or (${table.status} = 'rotated' and ${table.rotatedAt} is not null)`,
    ),
  ],
);
