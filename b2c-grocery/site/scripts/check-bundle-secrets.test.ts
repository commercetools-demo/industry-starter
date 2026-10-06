// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scanBundle } from './check-bundle-secrets.mjs';

function bundle(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'bun-'));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

describe('scanBundle', () => {
  const env = { CTP_CLIENT_SECRET: 'planted-client-secret-value', CTP_CLIENT_ID: 'planted-id', SESSION_SECRET: 'planted-session-secret-value-0123456789' };

  it('Secret in client bundle: a planted secret value fails (value not printed)', () => {
    const dir = bundle({ 'chunks/app.js': 'var x="planted-client-secret-value";' });
    const hits = scanBundle(dir, env);
    expect(hits).toEqual(['chunks/app.js: contains the value of CTP_CLIENT_SECRET']);
    expect(hits.join()).not.toContain('planted-client-secret-value');
  });

  it('fails on the variable names', () => {
    const dir = bundle({ 'a.js': 'process.env.SESSION_SECRET', 'b.js': 'CLIENT_SECRET' });
    expect(scanBundle(dir, {})).toHaveLength(2);
  });

  it('passes a clean bundle', () => {
    const dir = bundle({ 'chunks/app.js': 'console.log("hello");' });
    expect(scanBundle(dir, env)).toEqual([]);
  });

  it('empty or unset variables are not searched', () => {
    const dir = bundle({ 'chunks/app.js': 'console.log("hello");' });
    expect(scanBundle(dir, { CTP_CLIENT_ID: '', SESSION_SECRET: undefined })).toEqual([]);
  });

  it('reports a missing bundle directory as a failure', () => {
    expect(scanBundle(path.join(tmpdir(), 'does-not-exist-bundle'), env)).toHaveLength(1);
  });
});
