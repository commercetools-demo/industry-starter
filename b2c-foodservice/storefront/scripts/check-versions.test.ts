import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkVersions } from './check-versions.mjs';

const GOOD: Record<string, string> = {
  next: '16.4.2',
  'next-intl': '4.14.9',
  '@commercetools/platform-sdk': '8.27.0',
  '@commercetools/ts-client': '4.10.0',
  react: '19.2.4',
  tailwindcss: '4.3.3',
};

function fixture(overrides: Record<string, string | null> = {}, nvmrc: string | null = '22\n'): string {
  const root = mkdtempSync(join(tmpdir(), 'versions-'));
  const versions = { ...GOOD, ...overrides };
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies: { next: `^${versions.next ?? '16.0.1'}` } }),
  );
  for (const [name, version] of Object.entries(versions)) {
    if (version === null) continue;
    const dir = join(root, 'node_modules', ...name.split('/'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }));
  }
  if (nvmrc !== null) writeFileSync(join(root, '.nvmrc'), nvmrc);
  return root;
}

describe('version gate', () => {
  it('Forbidden version: next 15.x fails with the version rule', () => {
    const problems: string[] = checkVersions(fixture({ next: '15.1.0' }));
    expect(problems.join('\n')).toContain('next 15.1.0 installed, the rule is next major 16');
  });

  it('Forbidden version: next-intl 3 fails', () => {
    const problems: string[] = checkVersions(fixture({ 'next-intl': '3.26.0' }));
    expect(problems.join('\n')).toContain('next-intl 3.26.0 installed');
  });

  it('Forbidden version: platform-sdk 9 fails', () => {
    const problems: string[] = checkVersions(fixture({ '@commercetools/platform-sdk': '9.0.0' }));
    expect(problems.join('\n')).toContain('@commercetools/platform-sdk 9.0.0 installed');
  });

  it('Forbidden version: missing .nvmrc fails', () => {
    const problems: string[] = checkVersions(fixture({}, null));
    expect(problems.join('\n')).toContain('.nvmrc is missing');
  });

  it('Forbidden version: next 16.0.0 exactly fails the lower bound', () => {
    const problems: string[] = checkVersions(fixture({ next: '16.0.0' }));
    expect(problems.join('\n')).toContain('next >16.0.0');
  });

  it('A passing fixture reports no problems', () => {
    expect(checkVersions(fixture())).toEqual([]);
  });

  it('Stack and version gates pass on the real repository', () => {
    const root = process.cwd();
    expect(checkVersions(root)).toEqual([]);
  });
});
