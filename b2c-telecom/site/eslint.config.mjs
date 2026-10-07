import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Design lint (workstream C): the three no-restricted-syntax selectors of design/source/_ds/_adherence.oxlintrc.json,
// plus the same patterns on template strings so class-name templates are covered. Workstream B's no-restricted-syntax
// blocks for the same files must spread this constant into their arrays (a later block replaces an earlier one).
const HEX = "#[0-9a-fA-F]{3,8}\\b";
const PX = "\\b\\d+px\\b";
const FONT = "font-family\\s*:\\s*(?!\\s|['\\\"]?(?:Exo|Inter|Roboto))"; // (?!\\s|...) deviates from the oxlint original: without it the regex backtracks to zero spaces and flags valid font-family: Exo
const HEX_MESSAGE = "Raw hex color — use a design-system color token via var().";
const PX_MESSAGE = "Raw px value — use a design-system spacing token via var().";
const FONT_MESSAGE = "Font not provided by the design system. Available: Exo, Inter, Roboto.";
const DESIGN_SYNTAX = [
  { selector: `Literal[value=/${HEX}/]`, message: HEX_MESSAGE },
  { selector: `Literal[value=/${PX}/]`, message: PX_MESSAGE },
  { selector: `Literal[value=/${FONT}/i]`, message: FONT_MESSAGE },
  { selector: `TemplateElement[value.raw=/${HEX}/]`, message: HEX_MESSAGE },
  { selector: `TemplateElement[value.raw=/${PX}/]`, message: PX_MESSAGE },
  { selector: `TemplateElement[value.raw=/${FONT}/i]`, message: FONT_MESSAGE },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // C: design lint. The Broadband Facts label is the only exempt component (D-053).
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.*",
      "components/label/**",
      "app/**/icon.*",
      "app/**/opengraph-image.*",
      "app/dev/**",
    ],
    rules: { "no-restricted-syntax": ["error", ...DESIGN_SYNTAX] },
  },
]);

export default eslintConfig;
