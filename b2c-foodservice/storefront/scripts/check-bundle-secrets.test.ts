import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SECRET_NAMES, checkBundleSecrets } from './check-bundle-secrets.mjs';

const VALUE = 'fake-secret-value-12345';

function build(chunk: string): string {
  const root = mkdtempSync(join(tmpdir(), 'bundle-'));
  mkdirSync(join(root, '.next', 'static', 'chunks'), { recursive: true });
  writeFileSync(join(root, '.next', 'static', 'chunks', 'a.js'), chunk);
  return root;
}

describe('Client bundle scan', () => {
  it('Client bundle scan finds a secret value in .next/static and reports only the name', () => {
    const problems = checkBundleSecrets(build(`var s="${VALUE}";`), { CTP_CLIENT_SECRET: VALUE });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('CTP_CLIENT_SECRET');
    expect(problems[0]).toContain('a.js');
    expect(problems[0]).not.toContain(VALUE);
  });

  it('Client bundle scan passes on a clean build output', () => {
    expect(checkBundleSecrets(build('var s="nothing here";'), { CTP_CLIENT_SECRET: VALUE })).toEqual([]);
  });

  it('Short or missing values are not scanned', () => {
    expect(checkBundleSecrets(build('var s="abc";'), { SESSION_SECRET: 'abc' })).toEqual([]);
    expect(checkBundleSecrets(build('x'), {})).toEqual([]);
  });

  it('Server-rendered HTML under .next/server/app is scanned', () => {
    const root = build('x');
    mkdirSync(join(root, '.next', 'server', 'app'), { recursive: true });
    writeFileSync(join(root, '.next', 'server', 'app', 'en-US.html'), `<p>${VALUE}</p>`);
    const problems = checkBundleSecrets(root, { SESSION_SECRET: VALUE });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('SESSION_SECRET');
  });
});

describe('Server component payloads', () => {
  it('the .rsc payloads under .next/server/app are scanned too (they are sent to the browser on navigation)', () => {
    const root = build('x');
    mkdirSync(join(root, '.next', 'server', 'app', 'en-US'), { recursive: true });
    writeFileSync(join(root, '.next', 'server', 'app', 'en-US', 'about.rsc'), `1:"${VALUE}"`);
    const problems = checkBundleSecrets(root, { CTP_CLIENT_ID: VALUE });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('CTP_CLIENT_ID');
    expect(problems[0]).toContain('about.rsc');
  });
});

describe('Secret list', () => {
  it('contact webhook token in the bundle is found', () => {
    const problems = checkBundleSecrets(build(`var t="${VALUE}";`), { CONTACT_WEBHOOK_TOKEN: VALUE });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('CONTACT_WEBHOOK_TOKEN');
    expect(problems[0]).not.toContain(VALUE);
  });

  it.each(['PB_RENDER_KEY', 'PB_PREVIEW_TOKEN', 'PB_ADMIN_SECRET'])('page builder secret %s in the bundle is found', (name) => {
    const problems = checkBundleSecrets(build(`var t="${VALUE}";`), { [name]: VALUE });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(name);
    expect(problems[0]).not.toContain(VALUE);
  });

  it('list covers every secret named in .env.example', () => {
    const example = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
    const names = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
    // Names that are settings, keys of public things or URLs of the project, not secrets.
    const notSecret = new Set([
      'CTP_PROJECT_KEY', 'EXPECTED_PROJECT_KEY', 'CTP_AUTH_URL', 'CTP_API_URL', 'CTP_SCOPES', 'CTP_REVIEWS_SCOPES', 'DEMO_LOGIN_ENABLED',
      'NEXT_PUBLIC_SITE_URL', 'CTP_CHECKOUT_APP_KEY', 'CTP_SESSION_URL', 'CSP_REPORT_ONLY',
      'PB_SERVICE_URL', 'PB_ORIGIN', 'PB_TIMEOUT_MS', 'PB_ALLOW_MC_FRAMING', 'PB_MC_ORIGIN',
    ]);
    const missing = names.filter((n) => !notSecret.has(n) && !SECRET_NAMES.includes(n));
    expect(missing).toEqual([]);
  });
});
