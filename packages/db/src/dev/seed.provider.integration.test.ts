import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../client.js";
import * as schema from "../schema/index.js";
import { developmentFixtures } from "./fixtures.js";
import {
  DEVELOPMENT_SEED_CONFIRMATION,
  readDevelopmentSeedGuard,
  seedDevelopmentData,
} from "./seed.js";

const migrationDirectory = fileURLToPath(
  new URL("../../drizzle/", import.meta.url),
);

let database: Database;
let pool: Pool;
let schemaCreated = false;
let testSchema = "";

/** Restricts and quotes the temporary schema identifier before it reaches SQL. */
function quoteTestSchema(identifier: string): string {
  if (!/^[a-z0-9_]+$/u.test(identifier)) {
    throw new TypeError("Test schema name contains unsupported characters.");
  }

  return `"${identifier}"`;
}

/** Enables full certificate verification without changing the stored pooled credential. */
function secureConnectionString(connectionString: string): string {
  const connectionUrl = new URL(connectionString);
  connectionUrl.searchParams.set("sslmode", "verify-full");
  return connectionUrl.toString();
}

/** Loads generated migration statements and redirects public references to the temporary schema. */
async function readMigrationStatements(schemaName: string): Promise<string[]> {
  const fileNames = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const quotedSchema = quoteTestSchema(schemaName);
  const statements: string[] = [];

  for (const fileName of fileNames) {
    const migration = await readFile(
      new URL(`../../drizzle/${fileName}`, import.meta.url),
      "utf8",
    );
    statements.push(
      ...migration
        .replaceAll('"public".', `${quotedSchema}.`)
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement !== ""),
    );
  }

  return statements;
}

/** Reads only fixture-table counts so two seed runs can be compared without depending on row order. */
async function readFixtureCounts(): Promise<Record<string, number>> {
  const tableNames = [
    "branches",
    "catalog_imports",
    "groups",
    "memberships",
    "menu_categories",
    "menu_item_modifier_groups",
    "menu_items",
    "menu_modifier_groups",
    "menu_modifier_options",
    "menu_variants",
    "menu_versions",
    "restaurants",
    "users",
  ] as const;
  const counts: Record<string, number> = {};

  for (const tableName of tableNames) {
    const result = await pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM ${tableName}`,
    );
    counts[tableName] = Number(result.rows[0]?.count ?? -1);
  }

  return counts;
}

beforeAll(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim() === "") {
    throw new Error("DATABASE_URL is required for seed provider tests.");
  }

  testSchema = `seed_test_${randomUUID().replaceAll("-", "")}`;
  pool = new Pool({
    connectionString: secureConnectionString(connectionString),
    max: 1,
  });
  const quotedSchema = quoteTestSchema(testSchema);
  await pool.query(`CREATE SCHEMA ${quotedSchema}`);
  schemaCreated = true;
  await pool.query(`SET search_path TO ${quotedSchema}`);

  for (const statement of await readMigrationStatements(testSchema)) {
    await pool.query(statement);
  }

  database = drizzle(pool, { schema });
}, 30_000);

afterAll(async () => {
  if (pool === undefined) {
    return;
  }

  if (schemaCreated) {
    await pool.query("SET search_path TO public");
    await pool.query(`DROP SCHEMA ${quoteTestSchema(testSchema)} CASCADE`);
  }
  await pool.end();
});

describe("deterministic development seed", () => {
  it("creates reviewed fictional fixtures once and remains unchanged on rerun", async () => {
    const guard = readDevelopmentSeedGuard({
      DATABASE_SEED_CONFIRMATION: DEVELOPMENT_SEED_CONFIRMATION,
      NODE_ENV: "development",
    });

    expect(await seedDevelopmentData(database, guard)).toEqual({
      branches: 1,
      groups: 1,
      menuItems: 2,
      restaurants: 1,
      users: 2,
    });
    const firstCounts = await readFixtureCounts();

    await pool.query(
      "UPDATE menu_items SET name = 'Locally Changed Name' WHERE id = $1",
      [developmentFixtures.catalog.items[0].id],
    );
    await seedDevelopmentData(database, guard);
    expect(await readFixtureCounts()).toEqual(firstCounts);
    expect(firstCounts).toMatchObject({
      branches: 1,
      groups: 1,
      memberships: 2,
      menu_items: 2,
      menu_modifier_options: 2,
      restaurants: 1,
      users: 2,
    });

    const restaurantNames = await pool.query<{ name: string }>(
      "SELECT name FROM restaurants ORDER BY name",
    );
    const itemNames = await pool.query<{ name: string }>(
      "SELECT name FROM menu_items ORDER BY sort_order",
    );
    expect(restaurantNames.rows.map(({ name }) => name)).toEqual([
      developmentFixtures.catalog.restaurant.name,
    ]);
    expect(itemNames.rows.map(({ name }) => name)).toEqual(
      developmentFixtures.catalog.items.map(({ name }) => name),
    );
  });
});
