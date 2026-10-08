// Architecture restrictions for the storefront (storefront-project-bootstrap: Directory layout).
// Shared by eslint.config.mjs and eslint/restrictions.test.ts.
//
// Note: ESLint replaces (does not merge) a rule's options when several config blocks match a file,
// so every file group below gets ONE complete option set for each restricted-* rule.
import tseslint from 'typescript-eslint';

const SERVER_ONLY_SOURCE = /(^|\/)lib\/(ct|session)(\/|\.|$)/;

/** (a) A file with a 'use client' directive must not import lib/ct/* or lib/session. */
const noServerImportInClient = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      serverImport:
        "'use client' files must not import server-only modules ({{source}}); import types from '@/lib/types' instead.",
    },
  },
  create(context) {
    let isClient = false;
    return {
      Program(node) {
        isClient = node.body.some(
          (statement) => statement.type === 'ExpressionStatement' && statement.directive === 'use client',
        );
      },
      ImportDeclaration(node) {
        if (isClient && node.importKind !== 'type' && SERVER_ONLY_SOURCE.test(String(node.source.value))) {
          context.report({ node, messageId: 'serverImport', data: { source: String(node.source.value) } });
        }
      },
    };
  },
};

export const localPlugin = { rules: { 'no-server-import-in-client': noServerImportInClient } };

const CODE_FILES = ['**/*.{ts,tsx,js,jsx,mjs}'];
const CLIENT_DIRS = ['components/**', 'hooks/**', 'context/**'];
const LOCALE_PAGES = ['app/[[]locale]/**'];
const SDK_ALLOWED = ['lib/ct/**', 'lib/mappers/**'];

const SDK_PATTERN = {
  group: ['@commercetools/platform-sdk', '@commercetools/platform-sdk/**'],
  message: '@commercetools/platform-sdk is allowed only in lib/ct/ and lib/mappers/ (types in lib/types.ts).',
};
const SDK_TYPES_PATTERN = {
  ...SDK_PATTERN,
  allowTypeImports: true,
  message: 'Only type-only imports of the SDK are allowed in lib/types.ts.',
};
const NAVIGATION_PATTERN = {
  group: ['next/navigation'],
  allowImportNames: ['notFound'],
  message: "Use the navigation helpers from '@/i18n/routing'; only notFound may come from next/navigation.",
};
const NEXT_LINK_PATH = { name: 'next/link', message: "Use Link from '@/i18n/routing' (locale-aware)." };
const SERVER_ONLY_PATTERN = {
  group: ['@/lib/ct', '@/lib/ct/**', '@/lib/session', '**/lib/ct', '**/lib/ct/**', '**/lib/session'],
  allowTypeImports: true,
  message: 'Server-only module; client code imports types from @/lib/types only.',
};

const restrictedImports = ({ paths = [], patterns }) => ({
  '@typescript-eslint/no-restricted-imports': ['error', { paths, patterns }],
});

const HOST_RE = '/commercetools\\.(com|co)/';
const API_RE = '/^\\/api\\//';
const firstArgIs = (re) =>
  `CallExpression[callee.name='fetch'][arguments.0.value=${re}], ` +
  `CallExpression[callee.name='fetch'][arguments.0.type='TemplateLiteral'][arguments.0.quasis.0.value.raw=${re}]`;

const SEL_CT_HOST = {
  selector: firstArgIs(HOST_RE),
  message: 'Never call a commercetools host with fetch; use lib/ct (server only).',
};
const SEL_API = {
  selector: firstArgIs(API_RE),
  message: "Components must not fetch('/api/...') directly; use a hook in hooks/.",
};
const SEL_CLIENT_BUILDER = {
  selector: "NewExpression[callee.name='ClientBuilder']",
  message: 'Create the commercetools client only in lib/ct/client.ts.',
};

export const restrictionConfigs = [
  {
    name: 'ws-A/plugins',
    plugins: { local: localPlugin, '@typescript-eslint': tseslint.plugin },
  },
  {
    name: "ws-A/(a) 'use client' files",
    files: CODE_FILES,
    rules: { 'local/no-server-import-in-client': 'error' },
  },
  {
    name: 'ws-A/(b) platform-sdk only in lib/ct and lib/mappers',
    files: CODE_FILES,
    ignores: SDK_ALLOWED,
    rules: restrictedImports({ patterns: [SDK_PATTERN] }),
  },
  {
    name: 'ws-A/(b) lib/types.ts may import SDK types',
    files: ['lib/types.ts'],
    rules: restrictedImports({ patterns: [SDK_TYPES_PATTERN] }),
  },
  {
    name: 'ws-A/(c) locale pages: locale-aware navigation',
    files: LOCALE_PAGES,
    rules: restrictedImports({ paths: [NEXT_LINK_PATH], patterns: [SDK_PATTERN, NAVIGATION_PATTERN] }),
  },
  {
    name: 'ws-A/(a,b,c) client dirs: no server-only modules, locale-aware navigation',
    files: CLIENT_DIRS,
    rules: restrictedImports({
      paths: [NEXT_LINK_PATH],
      patterns: [SDK_PATTERN, NAVIGATION_PATTERN, SERVER_ONLY_PATTERN],
    }),
  },
  {
    name: 'ws-A/(d,e) restricted syntax everywhere',
    files: CODE_FILES,
    ignores: ['lib/ct/client.ts'],
    rules: { 'no-restricted-syntax': ['error', SEL_CT_HOST, SEL_CLIENT_BUILDER] },
  },
  {
    name: 'ws-A/(d) lib/ct/client.ts may build the client',
    files: ['lib/ct/client.ts'],
    rules: { 'no-restricted-syntax': ['error', SEL_CT_HOST] },
  },
  {
    name: "ws-A/(d) no literal fetch('/api') in components",
    files: CLIENT_DIRS,
    rules: { 'no-restricted-syntax': ['error', SEL_CT_HOST, SEL_CLIENT_BUILDER, SEL_API] },
  },
];
