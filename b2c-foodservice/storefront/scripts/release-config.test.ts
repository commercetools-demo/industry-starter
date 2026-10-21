// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = join(process.cwd(), '..');

describe('Deploy config', () => {
  it('Deploy config: netlify.toml exists, builds the storefront on Node 22, and no vercel.json exists', () => {
    const toml = readFileSync(join(appRoot, 'netlify.toml'), 'utf8');
    expect(toml).toMatch(/base\s*=\s*"storefront"/);
    expect(toml).toMatch(/command\s*=\s*"npm run build"/);
    expect(toml).toMatch(/NODE_VERSION\s*=\s*"22"/);
    expect(existsSync(join(appRoot, 'vercel.json'))).toBe(false);
    expect(existsSync(join(appRoot, 'storefront', 'vercel.json'))).toBe(false);
  });
});
