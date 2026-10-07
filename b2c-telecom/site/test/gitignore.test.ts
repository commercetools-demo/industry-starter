// @vitest-environment node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const siteDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(siteDir, '..');

function isIgnored(file: string): boolean {
  const result = spawnSync('git', ['check-ignore', '-q', file], { cwd: repoRoot });
  return result.status === 0;
}

describe('gitignore', () => {
  it('ignores secret-bearing env files', () => {
    expect(isIgnored('.envrc')).toBe(true);
    expect(isIgnored('site/.env.local')).toBe(true);
    expect(isIgnored('site/.env.seed')).toBe(true);
  });

  it('does not ignore .env.example', () => {
    expect(isIgnored('site/.env.example')).toBe(false);
  });
});
