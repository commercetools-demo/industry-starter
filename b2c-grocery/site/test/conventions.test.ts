// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

const isClientFile = (source: string): boolean => /^\s*(\/\*[\s\S]*?\*\/\s*|\/\/.*\n\s*)*['"]use client['"]/.test(source);

describe('Interactive control', () => {
  it('a file without "use client" never defines an inline event handler (extract a client child that receives plain data)', () => {
    const offenders = [...sources(path.join(root, 'app')), ...sources(path.join(root, 'components'))].filter((file) => {
      const source = readFileSync(file, 'utf8');
      return !isClientFile(source) && /\son[A-Z][A-Za-z]+=\{\s*(?:async\b|function\b|\(|[A-Za-z_]+\s*=>)/.test(source);
    });
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  it('the detector sees "use client" after a comment and flags a handler without it', () => {
    expect(isClientFile("// note\n'use client';\nexport {}")).toBe(true);
    expect(isClientFile('export const A = () => <button onClick={() => {}} />;')).toBe(false);
  });
});

describe('Failing typecheck', () => {
  const verify = (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts.verify.split('&&').map((s) => s.trim());

  it('npm run verify runs typecheck before the tests and the build, and stops at the first failure', () => {
    const index = (step: string) => verify.indexOf(step);
    expect(index('npm run typecheck')).toBeGreaterThan(-1);
    expect(index('npm run typecheck')).toBeLessThan(index('npm test'));
    expect(index('npm test')).toBeLessThan(index('npm run build'));
  });
});
