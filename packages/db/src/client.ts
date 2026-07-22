import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema/index.js";

export interface RuntimeDatabaseConfig {
  readonly connectionString: string;
}

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseClient {
  readonly database: Database;
  close(): Promise<void>;
}

/** Reads and validates the pooled server connection without exposing its credential in errors. */
export function readRuntimeDatabaseConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeDatabaseConfig {
  const connectionString = environment.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim() === "") {
    throw new Error("DATABASE_URL is required on the server.");
  }

  let connectionUrl: URL;
  try {
    connectionUrl = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (
    connectionUrl.protocol !== "postgres:" &&
    connectionUrl.protocol !== "postgresql:"
  ) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (
    !connectionUrl.hostname.includes("-pooler.") ||
    !connectionUrl.hostname.endsWith(".neon.tech")
  ) {
    throw new Error("DATABASE_URL must use the pooled Neon host.");
  }

  return { connectionString };
}

/** Creates the lazy pooled Drizzle client used by trusted server code at runtime. */
export function createDatabaseClient(
  config: RuntimeDatabaseConfig = readRuntimeDatabaseConfig(),
): DatabaseClient {
  const pool = new Pool({ connectionString: config.connectionString });
  const database = drizzle(pool, { schema });

  return {
    database,
    close: async () => pool.end(),
  };
}
