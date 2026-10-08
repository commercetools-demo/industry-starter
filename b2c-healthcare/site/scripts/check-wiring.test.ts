import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('storefront-project-bootstrap: Local quality gate', () => {
  it('Token parity wired: npm run check runs the parity script and the allow-list check', () => {
    const steps = pkg.scripts.check.split('&&').map((s) => s.trim());
    expect(steps).toContain('node scripts/check-token-parity.mjs');
    expect(steps).toContain('node scripts/gen-lint-allowlist.mjs --check');
  });

  it('Token parity wired: lint runs eslint (design lint rule included) and oxlint', () => {
    expect(pkg.scripts.lint).toMatch(/^eslint && oxlint/);
    const eslintConfig = readFileSync(resolve(__dirname, '../eslint.config.mjs'), 'utf8');
    expect(eslintConfig).toContain('designLintConfigs');
  });

  it('Gate on a clean scaffold: check chains typecheck, lint, version gate, tracked files and tests', () => {
    const check = pkg.scripts.check;
    for (const part of ['npm run typecheck', 'npm run lint', 'check-versions.mjs', 'check-tracked-files.mjs', 'npm run test']) {
      expect(check).toContain(part);
    }
  });
});
