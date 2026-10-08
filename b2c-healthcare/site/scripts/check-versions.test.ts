import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkVersions, compareVersions } from './check-versions.mjs';

const roots: string[] = [];

function fixture(versions: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'versions-'));
  roots.push(root);
  for (const [name, version] of Object.entries(versions)) {
    const dir = join(root, 'node_modules', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }));
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('storefront-project-bootstrap: Version gate', () => {
  it('Version gate: passes for next 16 and next-intl 4', () => {
    expect(checkVersions(fixture({ next: '16.4.0', 'next-intl': '4.14.9' }))).toEqual([]);
  });

  it('Version gate: fails when next is below 16.0.0', () => {
    const problems = checkVersions(fixture({ next: '15.5.9', 'next-intl': '4.0.0' }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('next@15.5.9');
  });

  it('Version gate: fails when next-intl is below 4', () => {
    const problems = checkVersions(fixture({ next: '16.0.0', 'next-intl': '3.26.5' }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('next-intl@3.26.5');
  });

  it('Version gate: fails when a package is not installed', () => {
    const problems = checkVersions(fixture({ next: '16.0.0' }));
    expect(problems).toEqual(['next-intl is not installed (need >= 4.0.0)']);
  });

  it('compares versions numerically, not lexically', () => {
    expect(compareVersions('16.10.0', '16.9.0')).toBe(1);
    expect(compareVersions('16.0.0', '16.0.0')).toBe(0);
    expect(compareVersions('15.99.99', '16.0.0')).toBe(-1);
  });

  it('Gate on a clean scaffold: the real installation satisfies the gate', () => {
    expect(checkVersions(resolve(__dirname, '..'))).toEqual([]);
  });
});
