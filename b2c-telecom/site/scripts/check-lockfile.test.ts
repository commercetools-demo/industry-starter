// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkLockfiles } from './check-lockfile.mjs';

let root: string;
let site: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'lockfile-'));
  site = path.join(root, 'site');
  mkdirSync(site);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('check-lockfile', () => {
  it('passes for a directory with only package-lock.json', () => {
    writeFileSync(path.join(site, 'package-lock.json'), '{}');
    expect(checkLockfiles(site)).toEqual([]);
  });

  it('fails and names pnpm-lock.yaml found in the directory', () => {
    writeFileSync(path.join(site, 'package-lock.json'), '{}');
    writeFileSync(path.join(site, 'pnpm-lock.yaml'), '');
    const problems = checkLockfiles(site);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('pnpm-lock.yaml');
    expect(problems[0]).toContain('use npm only');
  });

  it('fails for yarn.lock in the parent directory', () => {
    writeFileSync(path.join(site, 'package-lock.json'), '{}');
    writeFileSync(path.join(root, 'yarn.lock'), '');
    const problems = checkLockfiles(site);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('yarn.lock');
  });

  it('fails when package-lock.json is missing', () => {
    expect(checkLockfiles(site)).toEqual(['package-lock.json is missing']);
  });
});
