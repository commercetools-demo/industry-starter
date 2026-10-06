// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('platform stack', () => {
  it('Version check passes: Next.js 16 and next-intl 4', () => {
    expect(pkg.dependencies.next).toMatch(/^\^16/);
    expect(pkg.dependencies['next-intl']).toMatch(/^\^4/);
  });

  it('Old framework rejected: no Next.js 15 range', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(all.next).not.toMatch(/15\./);
  });

  it('No Tailwind v3 artifacts', () => {
    const files = readdirSync(root);
    expect(files.filter((f) => f.startsWith('tailwind.config'))).toEqual([]);
    expect(pkg.dependencies.tailwindcss).toMatch(/^\^4/);
  });
});
