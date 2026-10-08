import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { restrictionConfigs } from "./eslint/restrictions.mjs";
import { designLintConfigs } from "./eslint/design-lint.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...restrictionConfigs,
  ...designLintConfigs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
