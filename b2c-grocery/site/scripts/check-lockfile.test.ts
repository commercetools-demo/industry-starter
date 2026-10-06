// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkLockfiles } from './check-lockfile.mjs';

function makeProject(files: string[], rootFiles: string[] = []) {
  const root = mkdtempSync(path.join(tmpdir(), 'lock-'));
  const site = path.join(root, 'site');
  mkdirSync(site);
  for (const f of files) writeFileSync(path.join(site, f), '');
  for (const f of rootFiles) writeFileSync(path.join(root, f), '');
  return site;
}

describe('checkLockfiles', () => {
  it('passes with only package-lock.json', () => {
    expect(checkLockfiles(makeProject(['package-lock.json']))).toEqual([]);
  });

  it('Wrong lockfile: yarn.lock in site is rejected', () => {
    expect(checkLockfiles(makeProject(['package-lock.json', 'yarn.lock'])).join()).toContain('yarn.lock');
  });

  it('Wrong lockfile: pnpm-lock.yaml in repo root is rejected', () => {
    expect(checkLockfiles(makeProject(['package-lock.json'], ['pnpm-lock.yaml'])).join()).toContain('pnpm-lock.yaml');
  });

  it('Wrong lockfile: missing package-lock.json is rejected', () => {
    expect(checkLockfiles(makeProject([])).join()).toContain('package-lock.json is missing');
  });
});
