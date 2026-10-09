import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import malva from './eslint/malva-plugin.mjs';

const SDK = [
  { name: '@commercetools/platform-sdk', message: 'The commercetools SDK is only allowed in lib/ct/** and lib/mappers/**.' },
  { name: '@commercetools/ts-client', message: 'The commercetools SDK is only allowed in lib/ct/** and lib/mappers/**.' },
];
const LOCALE_NAV = [
  { name: 'next/link', message: "Use Link from '@/i18n/routing' so the locale prefix is kept." },
  { name: 'next/navigation', importNames: ['redirect', 'permanentRedirect', 'useRouter', 'usePathname'], message: "Use redirect, useRouter and usePathname from '@/i18n/routing'." },
];
const SERVER_IMPORTS = [{ group: ['@/lib/ct', '@/lib/ct/*', '@/lib/session', '@/lib/session*'], message: 'Server-only code must not be imported by components, hooks or context. Fetch through a Route Handler.' }];
const restrict = (paths, patterns = []) => ({ 'no-restricted-imports': ['error', { paths, patterns }] });

const FETCH_CT = [
  { selector: "CallExpression[callee.name='fetch'] > Literal[value=/commercetools\\.com/]", message: 'Never call a commercetools host with fetch; use the SDK from lib/ct.' },
  { selector: "CallExpression[callee.name='fetch'] > TemplateLiteral > TemplateElement[value.raw=/commercetools\\.com/]", message: 'Never call a commercetools host with fetch; use the SDK from lib/ct.' },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'eslint/fixtures/**', 'coverage/**']),
  { plugins: { malva }, rules: { 'malva/client-no-server-imports': 'error' } },
  // Everywhere except lib/ct and lib/mappers (and tests, which may build fixtures).
  { files: ['**/*.{ts,tsx,mjs}'], ignores: ['lib/ct/**', 'lib/mappers/**', '**/*.test.*', 'scripts/**'], rules: { ...restrict(SDK), 'no-restricted-syntax': ['error', ...FETCH_CT] } },
  // Locale UI: no bare next/link or next/navigation navigation.
  { files: ['app/\\[locale\\]/**/*.{ts,tsx}'], ignores: ['**/*.test.*'], rules: restrict([...SDK, ...LOCALE_NAV]) },
  // Client-side code: additionally no server-only modules.
  { files: ['components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}', 'context/**/*.{ts,tsx}'], ignores: ['**/*.test.*'], rules: restrict([...SDK, ...LOCALE_NAV], SERVER_IMPORTS) },
  // Root and locale layouts never read the session or request headers (D20): every page below stays cacheable.
  {
    files: ['app/layout.tsx', 'app/\\[locale\\]/layout.tsx'],
    ignores: ['**/*.test.*'],
    rules: {
      ...restrict([...SDK, ...LOCALE_NAV, { name: 'next/headers', message: 'Layouts must not read cookies() or headers() (D20).' }], [{ group: ['@/lib/session', '@/lib/session*'], message: 'Layouts must not read the session (D20).' }]),
      'no-restricted-syntax': ['error', ...FETCH_CT, { selector: "CallExpression[callee.name=/^(cookies|headers|getSession)$/]", message: 'Layouts must not call cookies(), headers() or getSession() (D20).' }],
    },
  },
]);
