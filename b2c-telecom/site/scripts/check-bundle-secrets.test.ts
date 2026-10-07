// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSecretValues, scanBundle } from './check-bundle-secrets.mjs';

let site: string;
let statics: string;

function bundle(file: string, content: string) {
  const full = path.join(statics, file);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

beforeEach(() => {
  site = mkdtempSync(path.join(tmpdir(), 'bundle-'));
  statics = path.join(site, '.next', 'static');
  mkdirSync(statics, { recursive: true });
});

afterEach(() => {
  rmSync(site, { recursive: true, force: true });
});

describe('check-bundle-secrets', () => {
  it('passes for a clean bundle', () => {
    bundle('chunks/a.js', 'console.log("hello")');
    expect(scanBundle(statics, { CTP_CLIENT_SECRET: 'supersecretvalue-123456' })).toEqual([]);
  });

  it('Secret never reaches the browser: a planted secret name or value in .next/static fails the check', () => {
    bundle('chunks/a.js', 'var x = process.env.CLIENT_SECRET;');
    expect(scanBundle(statics, {}).join('\n')).toContain('chunks/a.js: contains the name CLIENT_SECRET');
    bundle('chunks/b.js', 'var y = "supersecretvalue-123456";');
    expect(scanBundle(statics, { CTP_CLIENT_SECRET: 'supersecretvalue-123456' }).join('\n')).toContain(
      'chunks/b.js: contains the value of CTP_CLIENT_SECRET',
    );
  });

  it('never echoes a value', () => {
    bundle('chunks/b.js', 'var y = "supersecretvalue-123456";');
    expect(scanBundle(statics, { SESSION_SECRET: 'supersecretvalue-123456' }).join('\n')).not.toContain('supersecretvalue');
  });

  it('reports the seed names and values from a temp .env.seed', () => {
    bundle('chunks/c.js', 'var z = "seed-client-id-abcdef";');
    writeFileSync(path.join(site, '.env.seed'), 'CTP_SEED_CLIENT_ID=seed-client-id-abcdef\n');
    const problems = scanBundle(statics, loadSecretValues(site, {}));
    expect(problems).toEqual(['static/chunks/c.js: contains the value of CTP_SEED_CLIENT_ID']);
    bundle('chunks/d.js', 'CTP_SEED_X');
    expect(scanBundle(statics, {}).join('\n')).toContain('contains the name CTP_SEED');
  });

  it('fails when the directory is missing', () => {
    expect(scanBundle(path.join(site, 'nope'), {})).toEqual(['bundle directory not found (run the build first)']);
  });
});
