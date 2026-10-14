import { describe, expect, it } from 'vitest';
import { checkVersions, parseVersion } from './check-versions.mjs';
import { tmp } from './test-utils.mjs';

const pkg = (deps) => JSON.stringify({ dependencies: deps });
const GOOD = {
  next: '16.4.0',
  'next-intl': '^4.14.0',
  '@commercetools/platform-sdk': '^8.27.0',
  '@commercetools/ts-client': '^4.10.0',
  react: '19.2.4',
};
const base = (deps = GOOD) => ({ 'package.json': pkg(deps), '.nvmrc': '22\n' });

describe('Version gate', () => {
  it('Version gate passes on the pinned stack', () => {
    expect(checkVersions(tmp(base()))).toEqual([]);
  });
  it('Version gate fails on next 15', () => {
    expect(checkVersions(tmp(base({ ...GOOD, next: '15.5.0' }))).join('\n')).toMatch(/next 15\.5\.0 must be above/);
  });
  it('Version gate fails on next-intl 3', () => {
    expect(checkVersions(tmp(base({ ...GOOD, 'next-intl': '^3.26.0' }))).join('\n')).toMatch(/next-intl 3\.26\.0 must stay on major 4/);
  });
  it('Version gate fails on platform-sdk 9', () => {
    expect(checkVersions(tmp(base({ ...GOOD, '@commercetools/platform-sdk': '^9.6.0' }))).join('\n')).toMatch(/platform-sdk 9\.6\.0 must stay on major 8/);
  });
  it('Version gate fails on react 18', () => {
    expect(checkVersions(tmp(base({ ...GOOD, react: '18.3.1' }))).join('\n')).toMatch(/react 18\.3\.1 must stay on major 19/);
  });
  it('Version gate fails without .nvmrc', () => {
    expect(checkVersions(tmp({ 'package.json': pkg(GOOD) })).join('\n')).toMatch(/\.nvmrc is missing/);
  });
  it('Version gate fails on a wrong .nvmrc and reads installed versions first', () => {
    const root = tmp({ ...base(), '.nvmrc': '20', 'node_modules/next/package.json': JSON.stringify({ version: '15.0.0' }) });
    const problems = checkVersions(root).join('\n');
    expect(problems).toMatch(/\.nvmrc must start with 22/);
    expect(problems).toMatch(/next 15\.0\.0/);
  });
  it('parses versions', () => {
    expect(parseVersion('^16.2.6')).toEqual([16, 2, 6]);
    expect(parseVersion('latest')).toBeNull();
  });
});
