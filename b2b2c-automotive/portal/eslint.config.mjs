import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import noPuckInServer from './eslint/rules/no-puck-in-server.mjs';

const SDK_PACKAGES = ['@commercetools/platform-sdk', '@commercetools/ts-client'];
const ADMIN_GROUPS = ['@/lib/ct/admin-client', '**/ct/admin-client', './admin-client', '../admin-client'];
const PROVISIONING_GROUPS = ['@/lib/ct/provisioning-client', '**/ct/provisioning-client', './provisioning-client', '../provisioning-client'];

/** Builds a `no-restricted-imports` option. Later config blocks replace earlier ones, so each block lists everything it bans. */
function restrict({ sdk = true, admin = true, provisioning = true, navigation = false } = {}) {
  const paths = [];
  const patterns = [];
  if (sdk) {
    for (const name of SDK_PACKAGES) {
      paths.push({ name, message: 'The commercetools SDK is importable only in lib/ct/** and lib/mappers/** (BFF boundary).' });
    }
    patterns.push({ group: SDK_PACKAGES.map((p) => `${p}/*`), message: 'The commercetools SDK is importable only in lib/ct/** and lib/mappers/**.' });
  }
  if (admin) {
    patterns.push({
      group: ADMIN_GROUPS,
      message: 'The admin client is importable only from app/api/seller/**, lib/ct/seller/** and lib/contentools/jwt.ts (admin client fence).',
    });
  }
  if (provisioning) {
    patterns.push({ group: PROVISIONING_GROUPS, message: 'The provisioning client is importable only from app/api/auth/register/**.' });
  }
  if (navigation) {
    paths.push(
      { name: 'next/link', message: "Use Link from '@/i18n/routing' (locale-aware navigation only)." },
      {
        name: 'next/navigation',
        importNames: ['redirect', 'permanentRedirect', 'useRouter', 'usePathname'],
        message: "Use redirect, useRouter and usePathname from '@/i18n/routing' (locale-aware navigation only). notFound and useSearchParams stay allowed.",
      },
    );
  }
  return ['error', { paths, patterns }];
}

const noClientBuilder = {
  selector: "NewExpression[callee.name='ClientBuilder']",
  message: 'new ClientBuilder() is allowed only in lib/ct/client.ts (single client).',
};
const noFetchApiLiteral = {
  selector: "CallExpression[callee.name='fetch'] > Literal[value=/^\\/api\\//]",
  message: "Do not call fetch('/api/...') in components or pages; use a hook in hooks/ (hook-only fetching).",
};
const noFetchApiTemplate = {
  selector: "CallExpression[callee.name='fetch'] > TemplateLiteral[quasis.0.value.raw=/^\\/api\\//]",
  message: "Do not call fetch(`/api/...`) in components or pages; use a hook in hooks/ (hook-only fetching).",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'eslint/fixtures/**', 'coverage/**']),
  {
    plugins: { malva: { rules: { 'no-puck-in-server': noPuckInServer } } },
  },

  // Everywhere: single client, SDK boundary, admin and provisioning client fence.
  {
    files: ['**/*.{ts,tsx,mts,mjs}'],
    rules: {
      'no-restricted-syntax': ['error', noClientBuilder],
      'no-restricted-imports': restrict(),
    },
  },
  // The one place the ClientBuilder may live.
  { files: ['lib/ct/client.ts'], rules: { 'no-restricted-syntax': 'off' } },
  // SDK allowed in the server layer (admin and provisioning stay fenced).
  { files: ['lib/ct/**', 'lib/mappers/**'], rules: { 'no-restricted-imports': restrict({ sdk: false }) } },
  { files: ['lib/ct/seller/**'], rules: { 'no-restricted-imports': restrict({ sdk: false, admin: false }) } },
  { files: ['lib/ct/admin-client.ts', 'lib/ct/provisioning-client.ts'], rules: { 'no-restricted-imports': restrict({ sdk: false, admin: false, provisioning: false }) } },
  // Admin client allowed in the seller endpoints and the JWT module.
  { files: ['app/api/seller/**', 'lib/contentools/jwt.ts'], rules: { 'no-restricted-imports': restrict({ admin: false }) } },
  // Provisioning client allowed in registration only.
  { files: ['app/api/auth/register/**'], rules: { 'no-restricted-imports': restrict({ provisioning: false }) } },

  // Pages and components: no fetch('/api/...') (hooks only), locale-aware navigation only.
  {
    files: ['components/**/*.{ts,tsx}', 'app/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', noClientBuilder, noFetchApiLiteral, noFetchApiTemplate] },
  },
  {
    files: ['app/[[]locale]/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': restrict({ navigation: true }) },
  },

  // Puck value imports only behind 'use client'.
  {
    files: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
    rules: { 'malva/no-puck-in-server': 'error' },
  },
]);
