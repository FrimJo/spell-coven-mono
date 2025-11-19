import { config as baseConfig } from "@repo/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  ...baseConfig,
  {
    ignores: [
      "dist/**",
      ".wrangler/**",
      "node_modules/**",
      "eslint.config.js",
      "vitest.config.ts",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
