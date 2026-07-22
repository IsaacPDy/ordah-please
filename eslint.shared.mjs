import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Provides the strict typed lint rules that every application and shared package must follow. */
export const sharedStrictConfig = tseslint.config(
  eslint.configs.recommended,
  {
    extends: tseslint.configs.recommendedTypeChecked,
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["packages/db/drizzle.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  prettier,
);
