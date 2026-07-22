import { defineConfig, globalIgnores } from "eslint/config";
import { sharedStrictConfig } from "./eslint.shared.mjs";

export default defineConfig([
  globalIgnores([
    "**/.expo/**",
    "**/.next/**",
    "**/coverage/**",
    "**/dist/**",
    "**/node_modules/**",
  ]),
  ...sharedStrictConfig,
]);
