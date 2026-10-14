// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { checkVersions } from './check-versions.mjs';
import { tmpApp } from './test-utils.mjs';

const GOOD = { next: '16.4.0', 'next-intl': '^4.14.0', '@commercetools/platform-sdk': '^8.27.0', '@commercetools/ts-client': '^4.10.0', react: '19.2.4' };
const pkg = (deps) => JSON.stringify({ dependencies: deps });

describe('Scaffold with the pinned stack: Version gate', () => {
  it('Version gate passes on the pinned stack', () => {
    expect(checkVersions(tmpApp({ 'package.json': pkg(GOOD), '.nvmrc': '22\n' }))).toEqual([]);
  });
  it('Version gate fails on next 15', () => {
    const p = checkVersions(tmpApp({ 'package.json': pkg({ ...GOOD, next: '15.5.0' }), '.nvmrc': '22' }));
    expect(p.join('\n')).toMatch(/next 15\.5\.0 is below/);
  });
  it('Version gate fails on next-intl 3', () => {
    const p = checkVersions(tmpApp({ 'package.json': pkg({ ...GOOD, 'next-intl': '^3.26.0' }), '.nvmrc': '22' }));
    expect(p.join('\n')).toMatch(/next-intl 3\.26\.0 must stay on major 4/);
  });
  it('Version gate fails on platform-sdk 9', () => {
    const p = checkVersions(tmpApp({ 'package.json': pkg({ ...GOOD, '@commercetools/platform-sdk': '^9.7.0' }), '.nvmrc': '22' }));
    expect(p.join('\n')).toMatch(/platform-sdk 9\.7\.0 must stay on major 8/);
  });
  it('Version gate fails without .nvmrc', () => {
    expect(checkVersions(tmpApp({ 'package.json': pkg(GOOD) })).join('\n')).toMatch(/\.nvmrc is missing/);
  });
  it('Version gate fails on a wrong .nvmrc and prefers installed versions', () => {
    const root = tmpApp({ 'package.json': pkg(GOOD), '.nvmrc': '20', 'node_modules/react/package.json': JSON.stringify({ version: '18.3.1' }) });
    const p = checkVersions(root).join('\n');
    expect(p).toMatch(/\.nvmrc must start with 22/);
    expect(p).toMatch(/react 18\.3\.1 must stay on major 19/);
  });
});
