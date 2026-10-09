// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanBundle, secretValues } from './check-bundle-secrets.mjs';

const dirs = [];
const bundle = (files) => { const d = mkdtempSync(path.join(tmpdir(), 'malva-bundle-')); dirs.push(d); for (const [f, c] of Object.entries(files)) { mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); writeFileSync(path.join(d, f), c); } return d; };
afterEach(() => { while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true }); });

describe('malva-project-bootstrap › Secrets stay out of the bundle', () => {
  it('a clean bundle passes', () => { expect(scanBundle(bundle({ 'chunks/a.js': 'console.log("hi")' }), ['s3cr3t-value-xyz'])).toEqual([]); });
  it('a seeded fake secret value is found', () => { expect(scanBundle(bundle({ 'chunks/a.js': 'x="s3cr3t-value-xyz"' }), ['s3cr3t-value-xyz'])).toEqual(['chunks/a.js contains a secret value']); });
  it('the word client_secret is found', () => { expect(scanBundle(bundle({ 'b.js': 'const client_secret = 1' }), [])).toEqual(['b.js contains "client_secret"']); });
  it('reads secrets from the environment and an env file, ignoring short values', () => {
    expect(secretValues({ SESSION_SECRET: 'abcdefghijkl' }, 'CTP_CLIENT_SECRET="longsecretvalue"\nCTP_CLIENT_ID=ab')).toEqual(['longsecretvalue', 'abcdefghijkl'].sort((a) => (a === 'longsecretvalue' ? -1 : 1)));
  });
});
