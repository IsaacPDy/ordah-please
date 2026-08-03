import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import {
  branches,
  menuItems,
  menuModifierOptions,
  menuVariants,
  menuVersions,
  restaurants,
} from "./catalog.js";
import {
  favoriteAvailabilityEnum,
  foodResponseStatusEnum,
  foodSelectionSourceEnum,
  orderParticipantRoleEnum,
  orderStateEnum,
  restaurantChoiceModeEnum,
  restaurantResponseStatusEnum,
} from "./enums.js";
import { fileRecords } from "./files.js";
import { groups, users } from "./identity.js";

/** Creates a timezone-aware PostgreSQL timestamp column so persisted instants stay in UTC. */
const utcTimestamp = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    menuVersionId: uuid("menu_version_id")
      .notNull()
      .references(() => menuVersions.id),
    rank: smallint("rank").notNull(),
    name: text("name").notNull(),
    availability: favoriteAvailabilityEnum("availability")
      .default("available")
      .notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.branchId, table.menuVersionId],
      foreignColumns: [menuVersions.branchId, menuVersions.id],
      name: "favorites_menu_version_matches_branch_fk",
    }),
    unique("favorites_user_branch_rank_unique").on(
      table.userId,
      table.branchId,
      table.rank,
    ),
    check("favorites_rank_between_1_and_3", sql`${table.rank} between 1 and 3`),
  ],
);

export const favoriteItems = pgTable(
  "favorite_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    favoriteId: uuid("favorite_id")
      .notNull()
      .references(() => favorites.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id),
    variantId: uuid("variant_id").references(() => menuVariants.id),
    quantity: integer("quantity").notNull(),
    note: text("note").default("").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    check("favorite_items_positive_quantity", sql`${table.quantity} > 0`),
    check("favorite_items_non_negative_sort", sql`${table.sortOrder} >= 0`),
  ],
);

export const favoriteItemModifiers = pgTable(
  "favorite_item_modifiers",
  {
    favoriteItemId: uuid("favorite_item_id")
      .notNull()
      .references(() => favoriteItems.id, { onDelete: "cascade" }),
    modifierOptionId: uuid("modifier_option_id")
      .notNull()
      .references(() => menuModifierOptions.id),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.favoriteItemId, table.modifierOptionId],
    }),
    check(
      "favorite_item_modifiers_positive_quantity",
      sql`${table.quantity} > 0`,
    ),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    managerUserId: uuid("manager_user_id")
      .notNull()
      .references(() => users.id),
    state: orderStateEnum("state").default("draft").notNull(),
    choiceMode: restaurantChoiceModeEnum("choice_mode").notNull(),
    initialRestaurantId: uuid("initial_restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    initialBranchId: uuid("initial_branch_id")
      .notNull()
      .references(() => branches.id),
    selectedRestaurantId: uuid("selected_restaurant_id").references(
      () => restaurants.id,
    ),
    selectedBranchId: uuid("selected_branch_id").references(() => branches.id),
    selectedRestaurantNameSnapshot: text("selected_restaurant_name_snapshot"),
    selectedBranchNameSnapshot: text("selected_branch_name_snapshot"),
    deliveryAddressSnapshot: jsonb("delivery_address_snapshot").notNull(),
    restaurantDeadline: utcTimestamp("restaurant_deadline").notNull(),
    foodDeadline: utcTimestamp("food_deadline").notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
    completedAt: utcTimestamp("completed_at"),
  },
  (table) => [
    foreignKey({
      columns: [table.initialRestaurantId, table.initialBranchId],
      foreignColumns: [branches.restaurantId, branches.id],
      name: "orders_initial_branch_matches_restaurant_fk",
    }),
    foreignKey({
      columns: [table.selectedRestaurantId, table.selectedBranchId],
      foreignColumns: [branches.restaurantId, branches.id],
      name: "orders_selected_branch_matches_restaurant_fk",
    }),
    check(
      "orders_food_deadline_after_restaurant_deadline",
      sql`${table.foodDeadline} > ${table.restaurantDeadline}`,
    ),
    check(
      "orders_selected_restaurant_snapshot_complete",
      sql`(${table.selectedRestaurantId} is null and ${table.selectedBranchId} is null and ${table.selectedRestaurantNameSnapshot} is null and ${table.selectedBranchNameSnapshot} is null) or (${table.selectedRestaurantId} is not null and ${table.selectedBranchId} is not null and ${table.selectedRestaurantNameSnapshot} is not null and ${table.selectedBranchNameSnapshot} is not null)`,
    ),
    check(
      "orders_completion_matches_terminal_state",
      sql`(${table.state} in ('ordered', 'cancelled') and ${table.completedAt} is not null) or (${table.state} not in ('ordered', 'cancelled') and ${table.completedAt} is null)`,
    ),
  ],
);

export const orderParticipants = pgTable(
  "order_participants",
  {
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    displayNameSnapshot: text("display_name_snapshot").notNull(),
    role: orderParticipantRoleEnum("role").notNull(),
    restaurantResponse: restaurantResponseStatusEnum("restaurant_response")
      .default("pending")
      .notNull(),
    foodResponse: foodResponseStatusEnum("food_response")
      .default("pending")
      .notNull(),
    selectedAt: utcTimestamp("selected_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.orderId, table.userId] })],
);

export const restaurantVotes = pgTable(
  "restaurant_votes",
  {
    orderId: uuid("order_id").notNull(),
    userId: uuid("user_id").notNull(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    submittedAt: utcTimestamp("submitted_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.orderId, table.userId] }),
    foreignKey({
      columns: [table.orderId, table.userId],
      foreignColumns: [orderParticipants.orderId, orderParticipants.userId],
      name: "restaurant_votes_selected_participant_fk",
    }),
  ],
);

export const foodSelections = pgTable(
  "food_selections",
  {
    orderId: uuid("order_id").notNull(),
    userId: uuid("user_id").notNull(),
    source: foodSelectionSourceEnum("source").notNull(),
    favoriteId: uuid("favorite_id").references(() => favorites.id),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    submittedAt: utcTimestamp("submitted_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.orderId, table.userId] }),
    foreignKey({
      columns: [table.orderId, table.userId],
      foreignColumns: [orderParticipants.orderId, orderParticipants.userId],
      name: "food_selections_selected_participant_fk",
    }),
    check(
      "food_selections_source_fields_match",
      sql`(${table.source} = 'saved_favorite' and ${table.favoriteId} is not null and ${table.resolvedByUserId} is null) or (${table.source} = 'manager_resolution' and ${table.resolvedByUserId} is not null) or (${table.source} in ('inline', 'declined') and ${table.favoriteId} is null and ${table.resolvedByUserId} is null)`,
    ),
  ],
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").notNull(),
    userId: uuid("user_id").notNull(),
    sourceMenuItemId: uuid("source_menu_item_id").references(
      () => menuItems.id,
      { onDelete: "set null" },
    ),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCentavos: bigint("unit_price_centavos", {
      mode: "number",
    }).notNull(),
    variantNameSnapshot: text("variant_name_snapshot"),
    noteSnapshot: text("note_snapshot").default("").notNull(),
    lineSubtotalCentavos: bigint("line_subtotal_centavos", {
      mode: "number",
    }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.orderId, table.userId],
      foreignColumns: [orderParticipants.orderId, orderParticipants.userId],
      name: "order_lines_selected_participant_fk",
    }),
    check("order_lines_positive_quantity", sql`${table.quantity} > 0`),
    check(
      "order_lines_non_negative_unit_price",
      sql`${table.unitPriceCentavos} >= 0`,
    ),
    check(
      "order_lines_non_negative_subtotal",
      sql`${table.lineSubtotalCentavos} >= 0`,
    ),
    check("order_lines_non_negative_sort", sql`${table.sortOrder} >= 0`),
  ],
);

export const orderLineModifiers = pgTable(
  "order_line_modifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => orderLines.id),
    modifierNameSnapshot: text("modifier_name_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    priceDeltaCentavos: bigint("price_delta_centavos", {
      mode: "number",
    }).notNull(),
  },
  (table) => [
    check("order_line_modifiers_positive_quantity", sql`${table.quantity} > 0`),
  ],
);

export const receipts = pgTable("receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .unique("receipts_order_id_unique")
    .references(() => orders.id),
  fileId: uuid("file_id")
    .notNull()
    .unique("receipts_file_id_unique")
    .references(() => fileRecords.id),
  uploadedByUserId: uuid("uploaded_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: utcTimestamp("created_at").defaultNow().notNull(),
});
