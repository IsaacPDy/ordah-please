import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  catalogImportStatusEnum,
  menuVersionStatusEnum,
  refreshReviewOutcomeEnum,
  refreshStatusEnum,
} from "./enums.js";
import { fileRecords } from "./files.js";
import { users } from "./identity.js";

/** Creates a timezone-aware PostgreSQL timestamp column so persisted instants stay in UTC. */
const utcTimestamp = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const restaurants = pgTable("restaurants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  pausedAt: utcTimestamp("paused_at"),
  archivedAt: utcTimestamp("archived_at"),
});

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    sourceKey: text("source_key"),
    name: text("name").notNull(),
    address: text("address"),
    grabUrl: text("grab_url"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
    archivedAt: utcTimestamp("archived_at"),
  },
  (table) => [
    unique().on(table.restaurantId, table.sourceKey),
    unique("branches_restaurant_id_id_unique").on(table.restaurantId, table.id),
  ],
);

export const catalogImports = pgTable("catalog_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceFileId: uuid("source_file_id").references(() => fileRecords.id),
  validationReportFileId: uuid("validation_report_file_id").references(
    () => fileRecords.id,
  ),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  status: catalogImportStatusEnum("status").default("draft").notNull(),
  failureReason: text("failure_reason"),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  publishedAt: utcTimestamp("published_at"),
});

export const menuVersions = pgTable(
  "menu_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    sourceImportId: uuid("source_import_id")
      .notNull()
      .references(() => catalogImports.id),
    versionNumber: integer("version_number").notNull(),
    status: menuVersionStatusEnum("status").default("draft").notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    publishedAt: utcTimestamp("published_at"),
  },
  (table) => [
    unique("menu_versions_branch_version_unique").on(
      table.branchId,
      table.versionNumber,
    ),
    unique("menu_versions_branch_id_id_unique").on(table.branchId, table.id),
    uniqueIndex("menu_versions_one_published_per_branch")
      .on(table.branchId)
      .where(sql`${table.status} = 'published'`),
    check("menu_versions_positive_version", sql`${table.versionNumber} > 0`),
  ],
);

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuVersionId: uuid("menu_version_id")
      .notNull()
      .references(() => menuVersions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("menu_categories_version_sort_unique").on(
      table.menuVersionId,
      table.sortOrder,
    ),
    check("menu_categories_non_negative_sort", sql`${table.sortOrder} >= 0`),
  ],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => menuCategories.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    basePriceCentavos: bigint("base_price_centavos", {
      mode: "number",
    }).notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("menu_items_category_source_key_unique").on(
      table.categoryId,
      table.sourceKey,
    ),
    check(
      "menu_items_non_negative_price",
      sql`${table.basePriceCentavos} >= 0`,
    ),
    check("menu_items_non_negative_sort", sql`${table.sortOrder} >= 0`),
  ],
);

export const menuVariants = pgTable(
  "menu_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull(),
    priceDeltaCentavos: bigint("price_delta_centavos", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("menu_variants_item_source_key_unique").on(
      table.menuItemId,
      table.sourceKey,
    ),
    check("menu_variants_non_negative_sort", sql`${table.sortOrder} >= 0`),
  ],
);

export const menuModifierGroups = pgTable(
  "menu_modifier_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuVersionId: uuid("menu_version_id")
      .notNull()
      .references(() => menuVersions.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull(),
    minimumSelections: integer("minimum_selections").default(0).notNull(),
    maximumSelections: integer("maximum_selections").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("menu_modifier_groups_version_source_key_unique").on(
      table.menuVersionId,
      table.sourceKey,
    ),
    check(
      "menu_modifier_groups_selection_bounds",
      sql`${table.minimumSelections} >= 0 and ${table.maximumSelections} >= ${table.minimumSelections}`,
    ),
    check(
      "menu_modifier_groups_non_negative_sort",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const menuItemModifierGroups = pgTable(
  "menu_item_modifier_groups",
  {
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    modifierGroupId: uuid("modifier_group_id")
      .notNull()
      .references(() => menuModifierGroups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.menuItemId, table.modifierGroupId] }),
  ],
);

export const menuModifierOptions = pgTable(
  "menu_modifier_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modifierGroupId: uuid("modifier_group_id")
      .notNull()
      .references(() => menuModifierGroups.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull(),
    priceDeltaCentavos: bigint("price_delta_centavos", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("menu_modifier_options_group_source_key_unique").on(
      table.modifierGroupId,
      table.sourceKey,
    ),
    check(
      "menu_modifier_options_non_negative_sort",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const refreshRuns = pgTable("refresh_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  status: refreshStatusEnum("status").default("pending").notNull(),
  comparisonSummary: jsonb("comparison_summary").default({}).notNull(),
  startedAt: utcTimestamp("started_at"),
  completedAt: utcTimestamp("completed_at"),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
});

export const refreshReviewOutcomes = pgTable("refresh_review_outcomes", {
  id: uuid("id").defaultRandom().primaryKey(),
  refreshRunId: uuid("refresh_run_id")
    .notNull()
    .references(() => refreshRuns.id),
  outcome: refreshReviewOutcomeEnum("outcome").notNull(),
  decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
  reason: text("reason"),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
});
