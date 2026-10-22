import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDebugRoutes, checkPredeploy, checkPredeployEnv, checkPredeployFiles } from './predeploy-check.mjs';

describe('deploy gate', () => {
  it('Deploy gate fails while app/api/health/route.ts exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    mkdirSync(join(root, 'app', 'api', 'health'), { recursive: true });
    writeFileSync(join(root, 'app', 'api', 'health', 'route.ts'), 'export {};\n');
    expect(checkPredeploy(root)).toEqual(['Remove app/api/health/route.ts before deploying']);
  });

  it('Deploy gate fails while app/api/dev exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    mkdirSync(join(root, 'app', 'api', 'dev', 'session'), { recursive: true });
    writeFileSync(join(root, 'app', 'api', 'dev', 'session', 'route.ts'), 'export {};\n');
    expect(checkPredeploy(root)).toEqual(['Remove app/api/dev before deploying']);
  });

  it('Deploy gate fails while app/[locale]/dev exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    mkdirSync(join(root, 'app', '[locale]', 'dev', 'design'), { recursive: true });
    expect(checkPredeploy(root)).toEqual(['Remove app/[locale]/dev (the design kitchen sink) before deploying']);
  });

  it('Deploy gate passes when the route is removed', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    mkdirSync(join(root, 'app', 'api'), { recursive: true });
    expect(checkPredeploy(root)).toEqual([]);
  });
});

const GOOD_ENV = {
  CTP_PROJECT_KEY: 'shop-key', EXPECTED_PROJECT_KEY: 'shop-key', CTP_AUTH_URL: 'https://auth.example', CTP_API_URL: 'https://api.example',
  CTP_CLIENT_ID: 'id-value-1234', CTP_CLIENT_SECRET: 'client-secret-value-1234', CTP_SCOPES: 'view_products:shop-key manage_recurring_orders:shop-key view_recurrence_policies:shop-key',
  SESSION_SECRET: 'q8Zx2kLm9Pw4Rt7Vb1Nc6Hd3Jf5Sg0Aa', NEXT_PUBLIC_SITE_URL: 'https://shop.example', CTP_CHECKOUT_APP_KEY: 'checkout-key',
};

describe('deploy gate: environment and files', () => {
  it('clean project passes', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    mkdirSync(join(root, 'app', 'api'), { recursive: true });
    writeFileSync(join(root, '.nvmrc'), '22\n');
    expect([...checkPredeploy(root), ...checkDebugRoutes(root), ...checkPredeployFiles(root, ['.env.example', 'app/page.tsx']), ...checkPredeployEnv(GOOD_ENV)]).toEqual([]);
  });

  it('short session secret fails without printing it', () => {
    const problems = checkPredeployEnv({ ...GOOD_ENV, SESSION_SECRET: 'tiny-secret-9' });
    expect(problems).toEqual(['SESSION_SECRET is shorter than 32 characters (length 13)']);
    expect(problems.join()).not.toContain('tiny-secret-9');
  });

  it('project key mismatch fails naming both keys', () => {
    expect(checkPredeployEnv({ ...GOOD_ENV, EXPECTED_PROJECT_KEY: 'other-key' })).toEqual([
      'EXPECTED_PROJECT_KEY (other-key) does not equal CTP_PROJECT_KEY (shop-key)',
    ]);
  });

  it('admin scope fails and a missing recurring scope fails', () => {
    expect(checkPredeployEnv({ ...GOOD_ENV, CTP_SCOPES: `${GOOD_ENV.CTP_SCOPES} manage_project:shop-key` })).toEqual([
      'CTP_SCOPES contains the admin scope manage_project; the storefront client must not hold it',
    ]);
    expect(checkPredeployEnv({ ...GOOD_ENV, CTP_SCOPES: 'view_products:shop-key' })).toEqual([
      'CTP_SCOPES is missing manage_recurring_orders', 'CTP_SCOPES is missing view_recurrence_policies',
    ]);
  });

  it('missing variables are listed by name only', () => {
    const rest: Record<string, string> = { ...GOOD_ENV };
    delete rest.CTP_CLIENT_SECRET;
    expect(checkPredeployEnv(rest)).toEqual(['CTP_CLIENT_SECRET is not set']);
  });

  it('a public variable named like a secret fails', () => {
    expect(checkPredeployEnv({ ...GOOD_ENV, NEXT_PUBLIC_CTP_CLIENT_SECRET: 'x' })).toHaveLength(1);
  });

  it('tracked env file fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    writeFileSync(join(root, '.nvmrc'), '22\n');
    expect(checkPredeployFiles(root, ['.env.local', '.env.example'])).toEqual(['.env.local is tracked by git; remove it from the index']);
  });

  it('dev script import fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    writeFileSync(join(root, '.nvmrc'), '22\n');
    mkdirSync(join(root, 'lib'), { recursive: true });
    writeFileSync(join(root, 'lib', 'x.ts'), "import x from '../scripts/dev/mock';\n");
    expect(checkPredeployFiles(root, [])).toEqual(['lib/x.ts references scripts/dev']);
  });

  it('a route folder named debug or test fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'predeploy-'));
    mkdirSync(join(root, 'app', 'api', 'debug'), { recursive: true });
    expect(checkDebugRoutes(root)).toEqual(['Remove app/api/debug: a route named debug must not ship']);
  });

  it('CTP_SESSION_URL set fails: it is for the local mock only and would send the payment-session token to another host', () => {
    expect(checkPredeployEnv({ ...GOOD_ENV, CTP_SESSION_URL: 'https://localhost:9443' })).toEqual([
      'CTP_SESSION_URL is set; it is for the local mock only (leave it empty)',
    ]);
  });

  it('a receiver URL that is not https fails (the contact token goes out as a bearer header)', () => {
    expect(checkPredeployEnv({ ...GOOD_ENV, CONTACT_WEBHOOK_URL: 'http://hooks.example/x' })).toEqual(['CONTACT_WEBHOOK_URL must start with https://']);
    expect(checkPredeployEnv({ ...GOOD_ENV, FEEDBACK_WEBHOOK_URL: 'http://hooks.example/y' })).toEqual(['FEEDBACK_WEBHOOK_URL must start with https://']);
    expect(checkPredeployEnv({ ...GOOD_ENV, CONTACT_WEBHOOK_URL: 'https://hooks.example/x', FEEDBACK_WEBHOOK_URL: 'https://hooks.example/y' })).toEqual([]);
  });

  it('the reviews client may hold manage_products and nothing else', () => {
    expect(checkPredeployEnv({ ...GOOD_ENV, CTP_REVIEWS_SCOPES: 'manage_products:shop-key' })).toEqual([]);
    expect(checkPredeployEnv({ ...GOOD_ENV, CTP_REVIEWS_SCOPES: 'manage_products:shop-key manage_orders:shop-key' })).toEqual([
      'CTP_REVIEWS_SCOPES holds manage_orders; the reviews client may hold manage_products only',
    ]);
  });
});
