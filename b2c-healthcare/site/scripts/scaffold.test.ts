import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('storefront-project-bootstrap: Tailwind v4 without a config file', () => {
  it('Tailwind v4 without a config file: runs through @tailwindcss/postcss', () => {
    const postcss = readFileSync(resolve(root, 'postcss.config.mjs'), 'utf8');
    expect(postcss).toContain('@tailwindcss/postcss');
    expect(pkg.devDependencies['@tailwindcss/postcss']).toBeDefined();
    expect(pkg.devDependencies.tailwindcss).toMatch(/^\^?4/);
  });

  it("Tailwind v4 without a config file: globals.css begins with @import 'tailwindcss';", () => {
    expect(readFileSync(resolve(root, 'app/globals.css'), 'utf8').trimStart()).toMatch(/^@import ['"]tailwindcss['"];/);
  });

  it('Tailwind v4 without a config file: no tailwind.config.* exists', () => {
    expect(readdirSync(root).filter((name) => name.startsWith('tailwind.config'))).toEqual([]);
  });
});

describe('storefront-project-bootstrap: Supported framework and dependency versions', () => {
  it('declares the pinned majors', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(all.next).toMatch(/^\^?16/);
    expect(all['next-intl']).toMatch(/^\^?4/);
    expect(all.react).toMatch(/^\^?19/);
    expect(all['@commercetools/platform-sdk']).toMatch(/^\^?8/);
    expect(all['@commercetools/ts-client']).toMatch(/^\^?4/);
    expect(all.swr).toBeDefined();
    expect(all.jose).toBeDefined();
  });

  it('Reproducible install: a lockfile is committed and only npm is used', () => {
    const files = readdirSync(root);
    expect(files).toContain('package-lock.json');
    expect(files).not.toContain('pnpm-lock.yaml');
    expect(files).not.toContain('yarn.lock');
  });
});

describe('storefront-project-bootstrap: Local quality gate', () => {
  const check = pkg.scripts.check;

  it('Gate on a clean scaffold: check runs type-check, lint, version gate, token parity and tests', () => {
    expect(check).toContain('npm run typecheck');
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
    expect(check).toContain('npm run lint');
    expect(check).toContain('check-versions.mjs');
    expect(check).toContain('npm run test');
  });

  it('Token parity wired: the parity check is part of npm run check', () => {
    expect(check).toContain('node scripts/check-token-parity.mjs');
  });

  it('verify:build is check, the release-only prune step (Y), then build', () => {
    expect(pkg.scripts['verify:build']).toMatch(/^npm run check && (node scripts\/prune-dev-routes\.mjs && )?npm run build/);
  });
});
