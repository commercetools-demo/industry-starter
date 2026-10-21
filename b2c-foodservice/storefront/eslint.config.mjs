import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import noServerInClient from './eslint/rules/no-server-in-client.mjs';

const TESTS = ['**/*.test.{ts,tsx,mjs}', 'test/**', 'eslint/**'];

const CLIENT_BUILDER = {
  selector: "NewExpression[callee.name='ClientBuilder']",
  message: 'new ClientBuilder() is allowed only in lib/ct/client.ts (one client singleton).',
};
const RAW_HEX = [
  {
    selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
    message: 'No raw hex colours in components; use design tokens.',
  },
  {
    selector: 'Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]',
    message: 'No arbitrary hex values in Tailwind classes; use design tokens.',
  },
  {
    selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
    message: 'No raw hex colours in components; use design tokens.',
  },
];

const SDK_PATTERN = {
  group: ['@commercetools/*'],
  message: 'No @commercetools/* import outside lib/ct and lib/mappers (BFF boundary).',
};
const NAV_RESTRICTIONS = {
  paths: [
    {
      name: 'next/link',
      message: "Use Link from '@/i18n/routing' so links keep the locale prefix.",
    },
    {
      name: 'next/navigation',
      importNames: ['redirect', 'permanentRedirect', 'useRouter', 'usePathname'],
      message: "Use the locale-aware helpers from '@/i18n/routing'.",
    },
  ],
  patterns: [SDK_PATTERN],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'eslint/fixtures/**']),
  {
    plugins: { local: { rules: { 'no-server-in-client': noServerInClient } } },
    files: ['**/*.{ts,tsx}'],
    rules: { 'local/no-server-in-client': 'error' },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', { patterns: [SDK_PATTERN] }],
      'no-restricted-syntax': ['error', CLIENT_BUILDER],
    },
  },
  {
    files: ['app/[[]locale[]]/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'context/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', NAV_RESTRICTIONS] },
  },
  {
    files: ['components/**/*.{ts,tsx}', 'app/**/*.tsx'],
    ignores: TESTS,
    rules: { 'no-restricted-syntax': ['error', CLIENT_BUILDER, ...RAW_HEX] },
  },
  {
    files: ['lib/ct/**', 'lib/mappers/**', ...TESTS],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['lib/ct/client.ts', 'lib/ct/review-client.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);

export default eslintConfig;
