// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import malva from './eslint/malva-plugin.mjs';

const SDK_MESSAGE = 'The commercetools SDK is only allowed in lib/ct/** and lib/mappers/** (type imports from platform-sdk only in mappers).';
const SDK = [
  { name: '@commercetools/platform-sdk', message: SDK_MESSAGE },
  { name: '@commercetools/ts-client', message: SDK_MESSAGE },
];
const LOCALE_NAV = [
  { name: 'next/link', message: "Use Link from '@/i18n/routing' so the locale prefix is kept." },
  { name: 'next/navigation', importNames: ['redirect', 'permanentRedirect', 'useRouter', 'usePathname'], message: "Use redirect, useRouter and usePathname from '@/i18n/routing'." },
];
const restrict = (paths) => ({ 'no-restricted-imports': ['error', { paths }] });

const CLIENT_BUILDER = { selector: "NewExpression[callee.name='ClientBuilder']", message: 'new ClientBuilder() is only allowed in lib/ct/client.ts (one apiRoot singleton).' };
const FETCH_API = [
  { selector: "CallExpression[callee.name='fetch'] > Literal[value=/^\\/api\\//]", message: "Components must not call fetch('/api/...'); use a hook from hooks/ (SWR)." },
  { selector: "CallExpression[callee.name='fetch'] > TemplateLiteral > TemplateElement[value.raw=/^\\/api\\//]", message: "Components must not call fetch('/api/...'); use a hook from hooks/ (SWR)." },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'eslint/fixtures/**', 'coverage/**']),
  { plugins: { malva }, rules: { 'malva/no-puck-in-server': 'off' } },
  // Single client.
  { files: ['**/*.{ts,tsx,mjs}'], ignores: ['lib/ct/client.ts', '**/*.test.*', 'scripts/**', 'eslint/**'], rules: { 'no-restricted-syntax': ['error', CLIENT_BUILDER] } },
  // SDK only in lib/ct and lib/mappers (tests may build fixtures).
  { files: ['**/*.{ts,tsx}'], ignores: ['lib/ct/**', 'lib/mappers/**', '**/*.test.*'], rules: restrict(SDK) },
  {
    files: ['lib/mappers/**/*.ts'],
    ignores: ['**/*.test.*'],
    rules: { 'no-restricted-imports': ['error', { paths: [SDK[1], { ...SDK[0], allowTypeImports: true }] }] },
  },
  // Hook-only fetching: no fetch('/api/...') in components or app pages.
  { files: ['components/**/*.{ts,tsx}', 'app/**/*.tsx'], ignores: ['**/*.test.*'], rules: { 'no-restricted-syntax': ['error', CLIENT_BUILDER, ...FETCH_API] } },
  // Locale-aware navigation only.
  { files: ['app/\\[locale\\]/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'], ignores: ['**/*.test.*'], rules: restrict([...SDK, ...LOCALE_NAV]) },
  // createContext footgun: no Puck value imports in Server Components.
  { files: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'], ignores: ['**/*.test.*'], rules: { 'malva/no-puck-in-server': 'error' } },
]);
