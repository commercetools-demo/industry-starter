// @vitest-environment node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repo = path.resolve(__dirname, '../..');
const ignored = (p: string) => spawnSync('git', ['check-ignore', '-q', p], { cwd: repo }).status === 0;

describe('gitignore', () => {
  it.each(['.envrc', 'site/.env.local', 'site/.env.seed'])('%s is ignored', (p) => {
    expect(ignored(p)).toBe(true);
  });

  it('site/.env.example is not ignored', () => {
    expect(ignored('site/.env.example')).toBe(false);
  });
});
