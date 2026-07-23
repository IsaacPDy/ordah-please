import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const providerTestsEnabled = process.env.RUN_PROVIDER_TESTS === "1";
const providerTestPattern = "**/*.provider.integration.test.{ts,tsx}";
const repositoryRoot = import.meta.dirname;

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@ordah-please/domain": resolve(
              repositoryRoot,
              "packages/domain/src/index.ts",
            ),
          },
        },
        test: {
          environment: "node",
          exclude: providerTestsEnabled ? [] : [providerTestPattern],
          include: [
            "packages/{contracts,domain,jobs,notifications,storage,ui}/src/**/*.test.{ts,tsx}",
          ],
          name: "shared-packages",
          root: repositoryRoot,
        },
      },
      {
        test: {
          environment: "node",
          exclude: providerTestsEnabled ? [] : [providerTestPattern],
          fileParallelism: !providerTestsEnabled,
          include: [
            "apps/web/{app,src}/**/*.test.{ts,tsx}",
            "packages/db/src/**/*.test.{ts,tsx}",
          ],
          name: "server",
          root: repositoryRoot,
          testTimeout: providerTestsEnabled ? 30_000 : 5_000,
        },
      },
    ],
  },
});
