import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_PROJECT_KEYS, assertEchoedKey, assertTarget, isOwnedKey, TargetError } from './config';
import { isDemoMode } from '@/lib/ct/env-core';
import { parseEnvText } from './lib';

const siteDir = path.resolve(__dirname, '../..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (['node_modules', '.next'].includes(name)) return [];
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('assertTarget', () => {
  it('Target not confirmed: refuses before any write and names the project key found', () => {
    expect(() => assertTarget({ envProjectKey: 'other-project', confirmProject: 'other-project', mode: 'write' })).toThrow(/"other-project".*allow-list/);
    expect(() => assertTarget({ envProjectKey: 'spec-test-b2c-telecom', mode: 'write' })).toThrow(/--confirm-project.*"spec-test-b2c-telecom"/);
    expect(() => assertTarget({ envProjectKey: 'spec-test-b2c-telecom', confirmProject: 'wrong-key', mode: 'write' })).toThrow(TargetError);
    expect(() => assertEchoedKey('spec-test-b2c-telecom', 'another-project')).toThrow(/credentials belong to project "another-project"/);
    expect(() => assertTarget({ envProjectKey: 'unknown', mode: 'read' })).toThrow(/"unknown"/);
    expect(() => assertTarget({ envProjectKey: 'spec-test-b2c-telecom', mode: 'read' })).not.toThrow();
    expect(() => assertTarget({ envProjectKey: 'spec-test-b2c-telecom', confirmProject: 'spec-test-b2c-telecom', mode: 'write' })).not.toThrow();
    expect(new TargetError('x').exitCode).toBe(2);
    expect(ALLOWED_PROJECT_KEYS).toEqual(['spec-test-b2c-telecom']);
  });

  it('owns only malva- keys and the four customer groups', () => {
    expect(isOwnedKey('product', 'malva-offer-x')).toBe(true);
    expect(isOwnedKey('customerGroup', 'consumer')).toBe(true);
    expect(isOwnedKey('category', 'consumer')).toBe(false);
    expect(isOwnedKey('category', 'furniture')).toBe(false);
  });
});

describe('DEMO_MODE', () => {
  it('defaults to false and reads true/1', () => {
    expect(isDemoMode({})).toBe(false);
    expect(isDemoMode({ DEMO_MODE: 'true' })).toBe(true);
    expect(isDemoMode({ DEMO_MODE: 'false' })).toBe(false);
  });
});

describe('env parsing', () => {
  it('parses KEY=value lines and ignores comments', () => {
    expect(parseEnvText('# c\nA=1\nB="two"\n\nC=')).toEqual({ A: '1', B: 'two', C: '' });
  });
});

describe('repository hygiene', () => {
  it('Credentials kept out of the repository: .env.seed ignored, site source never imports scripts/seed, example file has no values', () => {
    const ignored = execFileSync('git', ['check-ignore', '.env.seed', 'scripts/seed/.backup/x.json'], { cwd: siteDir, encoding: 'utf8' });
    expect(ignored).toContain('.env.seed');
    expect(readFileSync(path.join(siteDir, '.gitignore'), 'utf8')).toMatch(/^\.env\.seed$/m);

    const importing = ['app', 'components', 'lib', 'hooks', 'context']
      .flatMap((dir) => walk(path.join(siteDir, dir)))
      .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))
      .filter((file) => /from\s+['"][^'"]*scripts\/seed/.test(readFileSync(file, 'utf8')));
    expect(importing).toEqual([]);

    const example = readFileSync(path.join(siteDir, '.env.seed.example'), 'utf8');
    for (const line of example.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      expect(line).toMatch(/^[A-Z0-9_]+=$/);
    }
  });
});
