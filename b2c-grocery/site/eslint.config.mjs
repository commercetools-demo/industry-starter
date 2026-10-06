import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Flat config: a later block REPLACES an earlier block's setting of the same rule for the same file,
// so each file group below lists the full set of restrictions that apply to it.

const SERVER_CODE = [
  { group: ['@/lib/ct/*', '@/lib/session', '@/lib/mappers/*', '@commercetools/platform-sdk', '@commercetools/ts-client'],
    message: 'Import app types from @/lib/types; talk to the server through hooks and /api.' },
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
    message: 'Call commercetools through lib/ct (getApiRoot()); raw fetch is only allowed in lib/ct/checkout-session.ts.',
  },
  {
    selector: "CallExpression[callee.name='fetch'] > TemplateLiteral[quasis.0.value.raw=/commercetools\\.com/]",
    message: 'Call commercetools through lib/ct (getApiRoot()); raw fetch is only allowed in lib/ct/checkout-session.ts.',
  },
];
const COMPONENT_API_FETCH = [
  {
    selector: "CallExpression[callee.name='fetch'] > Literal[value=/^\\/api\\//]",
    message: 'Components call hooks (hooks/*); hooks call fetchJson/sendJson (lib/fetcher.ts).',
  },
  {
    selector: "CallExpression[callee.name='fetch'] > TemplateLiteral[quasis.0.value.raw=/^\\/api\\//]",
    message: 'Components call hooks (hooks/*); hooks call fetchJson/sendJson (lib/fetcher.ts).',
  },
];

const imports = (paths, patterns = []) => ['error', { paths, patterns }];
const syntax = (...rules) => ['error', ...rules.flat()];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),

  // Everything: one ClientBuilder, locale-aware navigation, navigation control flow, no raw commercetools fetch.
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    rules: {
      'no-restricted-imports': imports([CLIENT_BUILDER, ...NAV_PATHS]),
      'no-restricted-syntax': syntax(NAV_CONTROL_FLOW, RAW_CT_FETCH),
    },
  },
  // Client layers: no server code, plus everything above; components also never fetch /api directly.
  {
    files: ['components/**', 'hooks/**', 'context/**'],
    rules: {
      'no-restricted-imports': imports([CLIENT_BUILDER, ...NAV_PATHS], SERVER_CODE),
    },
  },
  {
    files: ['components/**'],
    rules: { 'no-restricted-syntax': syntax(NAV_CONTROL_FLOW, RAW_CT_FETCH, COMPONENT_API_FETCH) },
  },
  // The i18n wrapper is where the locale-aware navigation is built.
  {
    files: ['i18n/**'],
    rules: { 'no-restricted-imports': imports([CLIENT_BUILDER]) },
  },
  // The two places that build a client: the storefront singleton and the seed script's admin client.
  {
    files: ['lib/ct/client.ts', 'scripts/seed/lib.ts'],
    rules: { 'no-restricted-imports': imports([...NAV_PATHS]) },
  },
  // The only place allowed to call commercetools with raw fetch.
  {
    files: ['lib/ct/checkout-session.ts'],
    rules: { 'no-restricted-syntax': syntax(NAV_CONTROL_FLOW) },
  },
]);
