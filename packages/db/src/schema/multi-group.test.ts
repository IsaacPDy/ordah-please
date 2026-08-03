import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  foodSelectionSourceEnum,
  memberships,
  membershipRoleEnum,
  orders,
  orderParticipantRoleEnum,
} from "./index.js";

const migrationDirectory = fileURLToPath(
  new URL("../../drizzle/", import.meta.url),
);

/** Reads the new migration without depending on Drizzle's generated adjective name. */
async function readMultiGroupMigration(): Promise<string> {
  const migrationFile = (await readdir(migrationDirectory)).find((name) =>
    name.startsWith("0003_"),
  );
  expect(migrationFile, "The ordered 0003 migration must exist.").toBeDefined();
  return readFile(
    new URL(`../../drizzle/${migrationFile}`, import.meta.url),
    "utf8",
  );
}

describe("multi-group schema", () => {
  it("uses Manager vocabulary and one active owner per group", () => {
    expect(membershipRoleEnum.enumValues).toEqual([
      "owner",
      "manager",
      "member",
    ]);
    expect(orderParticipantRoleEnum.enumValues).toEqual(["manager", "member"]);
    expect(foodSelectionSourceEnum.enumValues).toContain("manager_resolution");

    const membershipIndexes = getTableConfig(memberships).indexes.map(
      (index) => index.config.name,
    );
    expect(membershipIndexes).toContain(
      "memberships_one_active_owner_per_group",
    );
    expect(membershipIndexes).not.toContain(
      "memberships_one_active_group_per_user",
    );

    const orderColumns = getTableConfig(orders).columns.map(
      (column) => column.name,
    );
    expect(orderColumns).toContain("manager_user_id");
    expect(orderColumns).not.toContain("organizer_user_id");
  });

  it("preserves existing data through explicit Manager renames", async () => {
    const migration = await readMultiGroupMigration();

    expect(migration).toContain("RENAME VALUE 'organizer' TO 'manager'");
    expect(migration).toContain(
      'RENAME COLUMN "organizer_user_id" TO "manager_user_id"',
    );
    expect(migration).toContain(
      'DROP INDEX "public"."memberships_one_active_group_per_user"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "memberships_one_active_owner_per_group"',
    );
    expect(migration).not.toContain('DROP TABLE "memberships"');
    expect(migration).not.toContain('DROP TABLE "orders"');
  });
});
