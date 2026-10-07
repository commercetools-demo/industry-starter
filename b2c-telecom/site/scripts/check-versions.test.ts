// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkVersions } from './check-versions.mjs';

const GOOD: Record<string, string> = {
  next: '16.2.6',
  'next-intl': '4.14.9',
  '@commercetools/platform-sdk': '8.27.0',
  '@commercetools/ts-client': '4.10.0',
  tailwindcss: '4.3.3',
};

let dir: string;

function without(versions: Record<string, string>, name: string): Record<string, string> {
  return Object.fromEntries(Object.entries(versions).filter(([key]) => key !== name));
}

function writeLock(versions: Record<string, string>) {
  const packages: Record<string, { version: string }> = {};
  for (const [name, version] of Object.entries(versions)) packages[`node_modules/${name}`] = { version };
  writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages }));
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'versions-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('check-versions', () => {
  it('Framework version below the gate: names the package, the resolved version and the required range', () => {
    writeLock({ ...GOOD, next: '15.5.4' });
    expect(checkVersions(dir)).toEqual(['next: resolved 15.5.4, required >=16.0.0 <17.0.0']);
  });

  it('fails for next-intl below 4 and names it', () => {
    writeLock({ ...GOOD, 'next-intl': '3.26.0' });
    const problems = checkVersions(dir);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toBe('next-intl: resolved 3.26.0, required >=4.0.0 <5.0.0');
  });

  it('passes when every version is in range', () => {
    writeLock(GOOD);
    expect(checkVersions(dir)).toEqual([]);
  });

  it('ignores a pre-release suffix when comparing', () => {
    writeLock({ ...GOOD, next: '16.0.0-canary.3' });
    expect(checkVersions(dir)).toEqual([]);
  });

  it('fails when a tailwind.config file exists', () => {
    writeLock(GOOD);
    writeFileSync(path.join(dir, 'tailwind.config.ts'), 'export default {};');
    const problems = checkVersions(dir);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('tailwind.config.ts');
  });

  it('fails with "not installed" when the package is missing everywhere', () => {
    const rest = without(GOOD, 'next');
    writeLock(rest);
    expect(checkVersions(dir)).toEqual(['next: not installed']);
  });

  it('falls back to node_modules when the lock lacks the package', async () => {
    const { mkdirSync } = await import('node:fs');
    const rest = without(GOOD, 'next');
    writeLock(rest);
    mkdirSync(path.join(dir, 'node_modules', 'next'), { recursive: true });
    writeFileSync(path.join(dir, 'node_modules', 'next', 'package.json'), JSON.stringify({ version: '15.0.1' }));
    expect(checkVersions(dir)).toEqual(['next: resolved 15.0.1, required >=16.0.0 <17.0.0']);
  });

  it('passes against the real project', () => {
    expect(checkVersions(path.resolve(__dirname, '..'))).toEqual([]);
  });
});
