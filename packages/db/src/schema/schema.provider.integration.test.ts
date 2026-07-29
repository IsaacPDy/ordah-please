import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Client } from "pg";
import { describe, expect, it } from "vitest";

const expectedTables = [
  "admin_access_requests",
  "auth_accounts",
  "auth_sessions",
  "auth_users",
  "auth_verifications",
  "audit_events",
  "branches",
  "catalog_imports",
  "favorite_item_modifiers",
  "favorite_items",
  "favorites",
  "file_records",
  "food_selections",
  "group_addresses",
  "groups",
  "invitations",
  "jobs",
  "memberships",
  "menu_categories",
  "menu_item_modifier_groups",
  "menu_items",
  "menu_modifier_groups",
  "menu_modifier_options",
  "menu_variants",
  "menu_versions",
  "notifications",
  "order_line_modifiers",
  "order_lines",
  "order_participants",
  "orders",
  "receipts",
  "refresh_review_outcomes",
  "refresh_runs",
  "restaurant_votes",
  "restaurants",
  "users",
] as const;

const migrationDirectory = fileURLToPath(
  new URL("../../drizzle/", import.meta.url),
);

/** Lists generated SQL migrations and treats an uncreated migration directory as an empty RED state. */
async function readMigrationFiles(): Promise<string[]> {
  try {
    return (await readdir(migrationDirectory)).filter((name) =>
      name.endsWith(".sql"),
    );
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

/** Runs one invalid statement behind a savepoint so the surrounding verification transaction remains usable. */
async function expectConstraintFailure(
  client: Client,
  statement: string,
  values: readonly unknown[],
  constraintName: string,
): Promise<void> {
  await client.query("SAVEPOINT expected_constraint_failure");

  try {
    await expect(client.query(statement, [...values])).rejects.toMatchObject({
      constraint: constraintName,
    });
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expected_constraint_failure");
  }
}

/** Quotes a generated test-schema identifier after restricting it to letters, digits, and underscores. */
function quoteTestSchema(identifier: string): string {
  if (!/^[a-z0-9_]+$/u.test(identifier)) {
    throw new TypeError("Test schema name contains unsupported characters.");
  }

  return `"${identifier}"`;
}

/** Upgrades the in-memory test URL to explicit certificate verification without changing the stored secret. */
function secureTestConnectionString(connectionString: string): string {
  const connectionUrl = new URL(connectionString);
  connectionUrl.searchParams.set("sslmode", "verify-full");
  return connectionUrl.toString();
}

describe("initial Neon schema", () => {
  it("applies the generated migration and enforces V1 data invariants", async () => {
    const migrationFiles = await readMigrationFiles();

    expect(migrationFiles.length).toBeGreaterThan(0);
    if (migrationFiles.length === 0) {
      throw new Error("The initial generated migration is missing.");
    }

    const connectionString = process.env.DATABASE_MIGRATION_URL;
    if (connectionString === undefined || connectionString.length === 0) {
      throw new Error("DATABASE_MIGRATION_URL is required for provider tests.");
    }

    const migrationSql = (
      await Promise.all(
        migrationFiles
          .sort()
          .map((migrationFile) =>
            readFile(
              new URL(`../../drizzle/${migrationFile}`, import.meta.url),
              "utf8",
            ),
          ),
      )
    ).join("\n");
    const schemaName = `ordah_test_${randomUUID().replaceAll("-", "")}`;
    const quotedSchemaName = quoteTestSchema(schemaName);
    const client = new Client({
      connectionString: secureTestConnectionString(connectionString),
    });

    await client.connect();
    await client.query("BEGIN");

    try {
      await client.query(`CREATE SCHEMA ${quotedSchemaName}`);
      await client.query(
        `SET LOCAL search_path TO ${quotedSchemaName}, public`,
      );
      const isolatedMigrationSql = migrationSql
        .replaceAll('"public".', `${quotedSchemaName}.`)
        .replaceAll("--> statement-breakpoint", "");
      await client.query(isolatedMigrationSql);

      const tableResult = await client.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
        [schemaName],
      );
      expect(tableResult.rows.map((row) => row.table_name)).toEqual(
        [...expectedTables].sort(),
      );

      const platformAdminColumn = await client.query<{
        column_default: string | null;
        is_nullable: string;
      }>(
        "SELECT column_default, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'users' AND column_name = 'is_platform_admin'",
        [schemaName],
      );
      expect(platformAdminColumn.rows).toEqual([
        { column_default: "false", is_nullable: "NO" },
      ]);

      const userOne = randomUUID();
      const userTwo = randomUUID();
      const authUserOne = randomUUID();
      const authUserTwo = randomUUID();
      const groupOne = randomUUID();
      const groupTwo = randomUUID();
      await client.query(
        "INSERT INTO auth_users (id, name, email, email_verified) VALUES ($1, $2, $3, true), ($4, $5, $6, true)",
        [
          authUserOne,
          "Alex",
          "alex@example.test",
          authUserTwo,
          "Blair",
          "blair@example.test",
        ],
      );
      await client.query(
        "INSERT INTO auth_sessions (id, expires_at, token, user_id) VALUES ($1, now() + interval '1 day', $2, $3)",
        [randomUUID(), `session-${randomUUID()}`, authUserOne],
      );
      await client.query(
        "INSERT INTO auth_accounts (id, account_id, provider_id, user_id) VALUES ($1, $2, 'google', $3)",
        [randomUUID(), `google-${randomUUID()}`, authUserOne],
      );
      await client.query(
        "INSERT INTO users (id, auth_user_id, display_name) VALUES ($1, $2, $3), ($4, $5, $6)",
        [userOne, authUserOne, "Alex", userTwo, authUserTwo, "Blair"],
      );
      await client.query(
        "INSERT INTO groups (id, name, created_by_user_id) VALUES ($1, $2, $3), ($4, $5, $3)",
        [groupOne, "First Group", userOne, groupTwo, "Second Group"],
      );
      await client.query(
        "INSERT INTO memberships (group_id, user_id, role) VALUES ($1, $2, 'owner')",
        [groupOne, userOne],
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO memberships (group_id, user_id, role) VALUES ($1, $2, 'member')",
        [groupTwo, userOne],
        "memberships_one_active_group_per_user",
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO file_records (purpose, object_key, content_type, size_bytes, owner_user_id) VALUES ('receipt', $1, 'image/png', -1, $2)",
        ["receipts/invalid.png", userOne],
        "file_records_non_negative_size",
      );

      const restaurantId = randomUUID();
      const branchId = randomUUID();
      const otherRestaurantId = randomUUID();
      const otherBranchId = randomUUID();
      const importId = randomUUID();
      const menuVersionId = randomUUID();
      const otherMenuVersionId = randomUUID();
      const categoryId = randomUUID();
      const menuItemId = randomUUID();
      await client.query(
        "INSERT INTO restaurants (id, name) VALUES ($1, $2), ($3, $4)",
        [
          restaurantId,
          "Example Restaurant",
          otherRestaurantId,
          "Other Restaurant",
        ],
      );
      await client.query(
        "INSERT INTO branches (id, restaurant_id, name) VALUES ($1, $2, $3), ($4, $5, $6)",
        [
          branchId,
          restaurantId,
          "Central Branch",
          otherBranchId,
          otherRestaurantId,
          "Other Branch",
        ],
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO orders (group_id, organizer_user_id, state, choice_mode, initial_restaurant_id, initial_branch_id, delivery_address_snapshot, restaurant_deadline, food_deadline) VALUES ($1, $2, 'draft', 'shortlist', $3, $4, $5::jsonb, $6, $7)",
        [
          groupOne,
          userOne,
          restaurantId,
          otherBranchId,
          JSON.stringify({ line1: "Example", city: "Manila" }),
          "2026-07-23T11:00:00.000Z",
          "2026-07-23T12:00:00.000Z",
        ],
        "orders_initial_branch_matches_restaurant_fk",
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO orders (group_id, organizer_user_id, state, choice_mode, initial_restaurant_id, initial_branch_id, selected_restaurant_id, selected_branch_id, delivery_address_snapshot, restaurant_deadline, food_deadline) VALUES ($1, $2, 'food_confirmation', 'shortlist', $3, $4, $3, $4, $5::jsonb, $6, $7)",
        [
          groupOne,
          userOne,
          restaurantId,
          branchId,
          JSON.stringify({ line1: "Example", city: "Manila" }),
          "2026-07-23T11:00:00.000Z",
          "2026-07-23T12:00:00.000Z",
        ],
        "orders_selected_restaurant_snapshot_complete",
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO orders (group_id, organizer_user_id, state, choice_mode, initial_restaurant_id, initial_branch_id, selected_restaurant_id, selected_branch_id, selected_restaurant_name_snapshot, selected_branch_name_snapshot, delivery_address_snapshot, restaurant_deadline, food_deadline) VALUES ($1, $2, 'food_confirmation', 'shortlist', $3, $4, $3, $5, $6, $7, $8::jsonb, $9, $10)",
        [
          groupOne,
          userOne,
          restaurantId,
          branchId,
          otherBranchId,
          "Example Restaurant",
          "Other Branch",
          JSON.stringify({ line1: "Example", city: "Manila" }),
          "2026-07-23T11:00:00.000Z",
          "2026-07-23T12:00:00.000Z",
        ],
        "orders_selected_branch_matches_restaurant_fk",
      );
      await client.query(
        "INSERT INTO catalog_imports (id, created_by_user_id, status) VALUES ($1, $2, 'validated')",
        [importId, userOne],
      );
      await client.query(
        "INSERT INTO menu_versions (id, branch_id, source_import_id, version_number, status) VALUES ($1, $2, $3, 1, 'published'), ($4, $5, $3, 1, 'published')",
        [menuVersionId, branchId, importId, otherMenuVersionId, otherBranchId],
      );
      await client.query(
        "INSERT INTO menu_categories (id, menu_version_id, name, sort_order) VALUES ($1, $2, $3, 0)",
        [categoryId, menuVersionId, "Meals"],
      );
      await client.query(
        "INSERT INTO menu_items (id, category_id, source_key, name, base_price_centavos, sort_order) VALUES ($1, $2, $3, $4, 10000, 0)",
        [menuItemId, categoryId, "meal-1", "Chicken Meal"],
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO menu_items (category_id, source_key, name, base_price_centavos, sort_order) VALUES ($1, $2, $3, -1, 1)",
        [categoryId, "invalid-price", "Invalid Price"],
        "menu_items_non_negative_price",
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO favorites (user_id, branch_id, menu_version_id, rank, name) VALUES ($1, $2, $3, 4, $4)",
        [userOne, branchId, menuVersionId, "Invalid Rank"],
        "favorites_rank_between_1_and_3",
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO favorites (user_id, branch_id, menu_version_id, rank, name) VALUES ($1, $2, $3, 1, $4)",
        [userOne, branchId, otherMenuVersionId, "Wrong Branch"],
        "favorites_menu_version_matches_branch_fk",
      );
      await client.query(
        "INSERT INTO favorites (user_id, branch_id, menu_version_id, rank, name) VALUES ($1, $2, $3, 1, $4)",
        [userOne, branchId, menuVersionId, "Rank One"],
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO favorites (user_id, branch_id, menu_version_id, rank, name) VALUES ($1, $2, $3, 1, $4)",
        [userOne, branchId, menuVersionId, "Duplicate Rank"],
        "favorites_user_branch_rank_unique",
      );

      const orderId = randomUUID();
      await expectConstraintFailure(
        client,
        "INSERT INTO orders (group_id, organizer_user_id, state, choice_mode, initial_restaurant_id, initial_branch_id, delivery_address_snapshot, restaurant_deadline, food_deadline) VALUES ($1, $2, 'draft', 'shortlist', $3, $4, $5::jsonb, $6, $7)",
        [
          groupOne,
          userOne,
          restaurantId,
          branchId,
          JSON.stringify({ line1: "Example", city: "Manila" }),
          "2026-07-23T12:00:00.000Z",
          "2026-07-23T11:00:00.000Z",
        ],
        "orders_food_deadline_after_restaurant_deadline",
      );
      await client.query(
        "INSERT INTO orders (id, group_id, organizer_user_id, state, choice_mode, initial_restaurant_id, initial_branch_id, delivery_address_snapshot, restaurant_deadline, food_deadline) VALUES ($1, $2, $3, 'restaurant_voting', 'shortlist', $4, $5, $6::jsonb, $7, $8)",
        [
          orderId,
          groupOne,
          userOne,
          restaurantId,
          branchId,
          JSON.stringify({ line1: "Example", city: "Manila" }),
          "2026-07-23T11:00:00.000Z",
          "2026-07-23T12:00:00.000Z",
        ],
      );
      await client.query(
        "INSERT INTO order_participants (order_id, user_id, display_name_snapshot, role) VALUES ($1, $2, $3, 'organizer')",
        [orderId, userOne, "Alex"],
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO restaurant_votes (order_id, user_id, restaurant_id) VALUES ($1, $2, $3)",
        [orderId, userTwo, restaurantId],
        "restaurant_votes_selected_participant_fk",
      );

      await client.query(
        "INSERT INTO order_lines (order_id, user_id, source_menu_item_id, item_name_snapshot, quantity, unit_price_centavos, note_snapshot, line_subtotal_centavos, sort_order) VALUES ($1, $2, $3, $4, 1, 10000, $5, 10000, 0)",
        [orderId, userOne, menuItemId, "Chicken Meal", "No utensils"],
      );
      await client.query("DELETE FROM menu_items WHERE id = $1", [menuItemId]);
      const snapshotResult = await client.query<{
        item_name_snapshot: string;
        source_menu_item_id: string | null;
      }>(
        "SELECT source_menu_item_id, item_name_snapshot FROM order_lines WHERE order_id = $1",
        [orderId],
      );
      expect(snapshotResult.rows).toEqual([
        {
          item_name_snapshot: "Chicken Meal",
          source_menu_item_id: null,
        },
      ]);

      const idempotencyKey = `order-deadline:${orderId}`;
      await client.query(
        "INSERT INTO jobs (kind, status, idempotency_key, payload, scheduled_for) VALUES ('restaurant_deadline', 'pending', $1, '{}'::jsonb, now())",
        [idempotencyKey],
      );
      await expectConstraintFailure(
        client,
        "INSERT INTO jobs (kind, status, idempotency_key, payload, scheduled_for) VALUES ('restaurant_deadline', 'pending', $1, '{}'::jsonb, now())",
        [idempotencyKey],
        "jobs_idempotency_key_unique",
      );

      await client.query("DELETE FROM auth_users WHERE id = $1", [authUserOne]);
      const authDeletionResult = await client.query<{
        auth_user_id: string | null;
        product_user_count: string;
        order_count: string;
        session_count: string;
        account_count: string;
      }>(
        `SELECT
          (SELECT auth_user_id FROM users WHERE id = $1) AS auth_user_id,
          (SELECT count(*)::text FROM users WHERE id = $1) AS product_user_count,
          (SELECT count(*)::text FROM orders WHERE id = $2) AS order_count,
          (SELECT count(*)::text FROM auth_sessions WHERE user_id = $3) AS session_count,
          (SELECT count(*)::text FROM auth_accounts WHERE user_id = $3) AS account_count`,
        [userOne, orderId, authUserOne],
      );
      expect(authDeletionResult.rows).toEqual([
        {
          account_count: "0",
          auth_user_id: null,
          order_count: "1",
          product_user_count: "1",
          session_count: "0",
        },
      ]);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
});
