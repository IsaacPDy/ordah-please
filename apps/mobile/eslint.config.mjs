import { defineConfig, globalIgnores } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import { sharedStrictConfig } from "../../eslint.shared.mjs";

export default defineConfig([
  globalIgnores([".expo/**", "dist/**"]),
  ...expoConfig,
  ...sharedStrictConfig,
]);
