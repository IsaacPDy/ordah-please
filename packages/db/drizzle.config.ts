import { defineConfig } from "drizzle-kit";

const migrationUrl = process.env.DATABASE_MIGRATION_URL;

export default defineConfig({
  breakpoints: true,
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema/index.ts",
  ...(migrationUrl === undefined
    ? {}
    : { dbCredentials: { url: migrationUrl } }),
});
