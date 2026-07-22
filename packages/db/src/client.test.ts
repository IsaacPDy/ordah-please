import { describe, expect, it } from "vitest";

import { createDatabaseClient, readRuntimeDatabaseConfig } from "./client.js";

describe("runtime database configuration", () => {
  it("requires the pooled runtime variable instead of accepting the migration variable", () => {
    expect(() => readRuntimeDatabaseConfig({})).toThrowError(
      "DATABASE_URL is required on the server.",
    );
    expect(() =>
      readRuntimeDatabaseConfig({
        DATABASE_MIGRATION_URL:
          "postgresql://user:secret@ep-example.us-east-2.aws.neon.tech/db",
      }),
    ).toThrowError("DATABASE_URL is required on the server.");
  });

  it("rejects malformed and direct Neon URLs without echoing credentials", () => {
    const secret = "do-not-print-this";

    expect(() =>
      readRuntimeDatabaseConfig({ DATABASE_URL: `not-a-url-${secret}` }),
    ).toThrowError("DATABASE_URL must be a valid PostgreSQL URL.");
    expect(() =>
      readRuntimeDatabaseConfig({
        DATABASE_URL: `postgresql://user:${secret}@ep-example.us-east-2.aws.neon.tech/db`,
      }),
    ).toThrowError("DATABASE_URL must use the pooled Neon host.");
    expect(() =>
      readRuntimeDatabaseConfig({
        DATABASE_URL: `postgresql://user:${secret}@fake-pooler.example.com/db`,
      }),
    ).toThrowError("DATABASE_URL must use the pooled Neon host.");

    try {
      readRuntimeDatabaseConfig({ DATABASE_URL: `not-a-url-${secret}` });
    } catch (error: unknown) {
      expect(String(error)).not.toContain(secret);
    }
  });

  it("accepts a pooled Neon URL and creates a lazy runtime client", async () => {
    const url =
      "postgresql://user:secret@ep-example-pooler.us-east-2.aws.neon.tech/db?sslmode=require";
    const config = readRuntimeDatabaseConfig({ DATABASE_URL: url });

    expect(config).toEqual({ connectionString: url });

    const client = createDatabaseClient(config);
    expect(client.database).toBeDefined();
    await client.close();
  });
});
