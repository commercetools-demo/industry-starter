import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Layering rules of the storefront (workstream B, spec storefront-code-structure).
//
// Pitfall: in flat config a later block REPLACES (does not merge) the same rule for the same file.
// Every file group below therefore lists its COMPLETE restriction set, built from the constants.

const SERVER_CODE = [
  {
    group: [
      '@/lib/ct/*',
      '@/lib/market/server',
      '@/lib/mappers/*',
      '**/lib/ct/*',
      '**/lib/mappers/*',
      '@commercetools/platform-sdk',
      '@commercetools/ts-client',
      'jose',
    ],
    message: 'Import app types from @/lib/types; reach the server through hooks and /api.',
  },
];

const SERVER_PATHS = [
  {
    name: 'next/headers',
    message: 'Server-only API: use it in app/ route handlers and server components, not in client layers.',
  },
];

const CLIENT_BUILDER = {
  name: '@commercetools/ts-client',
  message: 'Only lib/ct/client.ts may build a commercetools client; use getApiRoot().',
};

const NAV_PATHS = [
  { name: 'next/link', importNames: ['default'], message: 'Use Link from @/i18n/routing.' },
  {
    name: 'next/navigation',
    importNames: ['useRouter', 'usePathname', 'redirect', 'permanentRedirect'],
    message: 'Use Link/useRouter/redirect from @/i18n/routing.',
  },
];

const NAV_CONTROL_FLOW = {
  selector:
    'TryStatement[handler] > BlockStatement.block CallExpression[callee.name=/^(redirect|notFound|forbidden|unauthorized|permanentRedirect)$/]',
  message: 'Call outside try/catch or rethrow with unstable_rethrow.',
};

const RAW_CT_FETCH = [
  {
    selector: "CallExpression[callee.name='fetch'] > Literal[value=/commercetools\\.com/]",
    message: 'Never call commercetools with a raw fetch: use the SDK client from lib/ct/client.ts.',
  },
  {
    selector: "CallExpression[callee.name='fetch'] > TemplateLiteral[quasis.0.value.raw=/commercetools\\.com/]",
    message: 'Never call commercetools with a raw fetch: use the SDK client from lib/ct/client.ts.',
  },
];

const COMPONENT_API_FETCH = [
  {
    selector: "CallExpression[callee.name='fetch'] > Literal[value=/^\\/api\\//]",
    message: "Never fetch('/api/...') inline: use a SWR hook from hooks/ (server pages call lib/ct directly).",
  },
  {
    selector: "CallExpression[callee.name='fetch'] > TemplateLiteral[quasis.0.value.raw=/^\\/api\\//]",
    message: "Never fetch('/api/...') inline: use a SWR hook from hooks/ (server pages call lib/ct directly).",
  },
];

const PAGE_NO_CLIENT = {
  selector: "ExpressionStatement[directive='use client']",
  message:
    'Pages and layouts under app/[locale] are Server Components: move interactivity into a child component.',
};

const PURE_MODULE = [
  {
    group: ['server-only', 'next/*', 'react', 'react-dom', 'swr', '@/lib/ct/*', '@/hooks/*', '@/context/*', '@/components/*'],
    message: 'lib/offers and lib/pricing are pure TypeScript (no I/O, no framework): D-024.',
  },
];

const restrictImports = ({ paths = [], patterns = [] }) => ({
  'no-restricted-imports': ['error', { paths, patterns }],
});

const restrictSyntax = (selectors) => ({
  'no-restricted-syntax': ['error', ...selectors],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),

  // 1. Everything: one client builder, locale-aware navigation, redirect()/notFound() outside try/catch.
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    rules: {
      ...restrictImports({ paths: [CLIENT_BUILDER, ...NAV_PATHS] }),
      ...restrictSyntax([NAV_CONTROL_FLOW, ...RAW_CT_FETCH]),
    },
  },

  // 2. Client layers: no server modules, no platform types (type-only imports included), no next/headers.
  {
    files: ['components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}', 'context/**/*.{ts,tsx}'],
    rules: restrictImports({
      paths: [CLIENT_BUILDER, ...NAV_PATHS, ...SERVER_PATHS],
      patterns: SERVER_CODE,
    }),
  },

  // 5. i18n builds the locale-aware navigation: it may import next/link and next/navigation.
  {
    files: ['i18n/**/*.{ts,tsx}'],
    rules: restrictImports({ paths: [CLIENT_BUILDER] }),
  },

  // 6. The only builders of a commercetools client.
  {
    files: ['lib/ct/client.ts', 'scripts/seed/lib.ts'],
    rules: restrictImports({ paths: [...NAV_PATHS] }),
  },

  // 10. Tests may mock server modules. Keep this block last.
  {
    files: ['**/*.test.{ts,tsx}', 'test/**'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-globals': 'off',
    },
  },
]);

export default eslintConfig;
