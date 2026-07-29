import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "./index.js";

/** Returns one expected table export and fails with a useful message while the schema is incomplete. */
function requireTable(exportName: string): AnyPgTable {
  const table = (schema as Readonly<Record<string, unknown>>)[exportName];
  expect(table, `${exportName} must be exported`).toBeDefined();
  return table as AnyPgTable;
}

describe("Better Auth persistence schema", () => {
  it("keeps four authentication tables separate from product users", () => {
    const tableNames = [
      "authUsers",
      "authSessions",
      "authAccounts",
      "authVerifications",
    ].map((exportName) => getTableConfig(requireTable(exportName)).name);

    expect(tableNames).toEqual([
      "auth_users",
      "auth_sessions",
      "auth_accounts",
      "auth_verifications",
    ]);
  });

  it("links product users through a nullable provider-neutral UUID", () => {
    const usersConfig = getTableConfig(schema.users);
    const columns = Object.fromEntries(
      usersConfig.columns.map((column) => [column.name, column]),
    );

    expect(columns).not.toHaveProperty("clerk_user_id");
    expect(columns.auth_user_id).toMatchObject({
      dataType: "string",
      notNull: false,
    });
    expect(columns.auth_user_id).toMatchObject({
      isUnique: true,
      uniqueName: "users_auth_user_id_unique",
    });
    expect(usersConfig.foreignKeys).toHaveLength(1);
    expect(usersConfig.foreignKeys[0]?.onDelete).toBe("set null");
  });

  it("cascades disposable auth records without cascading product history", () => {
    const sessionConfig = getTableConfig(requireTable("authSessions"));
    const accountConfig = getTableConfig(requireTable("authAccounts"));

    expect(sessionConfig.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(accountConfig.foreignKeys[0]?.onDelete).toBe("cascade");
    expect(
      sessionConfig.columns.find((column) => column.name === "token"),
    ).toMatchObject({
      isUnique: true,
      uniqueName: "auth_sessions_token_unique",
    });
    expect(
      accountConfig.uniqueConstraints.map((constraint) => constraint.name),
    ).toContain("auth_accounts_provider_account_unique");
  });
});
