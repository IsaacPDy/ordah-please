import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "../..");
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const providerTestsEnabled = process.env.RUN_PROVIDER_E2E === "1";
const providerTestPattern = "**/*.provider.spec.ts";

export default defineConfig({
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command:
            "npm run build:web && npm run start --workspace @ordah-please/web -- --hostname 127.0.0.1 --port 3100",
          cwd: repositoryRoot,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: baseURL,
        },
      }),
  expect: {
    timeout: 5_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: path.join(repositoryRoot, "test-results/playwright"),
  projects: [
    {
      name: "member-chromium",
      testIgnore: providerTestsEnabled ? [] : [providerTestPattern],
      testMatch: "member/**/*.spec.ts",
      use: devices["Desktop Chrome"],
    },
    {
      name: "admin-chromium",
      testIgnore: providerTestsEnabled ? [] : [providerTestPattern],
      testMatch: "admin/**/*.spec.ts",
      use: devices["Desktop Chrome"],
    },
  ],
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 2 : 0,
  testDir: __dirname,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
});
