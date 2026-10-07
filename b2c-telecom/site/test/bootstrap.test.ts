// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const siteDir = path.resolve(__dirname, '..');

type PackageJson = { scripts: Record<string, string>; engines?: { node?: string } };
const pkg = JSON.parse(readFileSync(path.join(siteDir, 'package.json'), 'utf8')) as PackageJson;

describe('bootstrap', () => {
  it('Clean clone to running storefront: dev/build/start scripts, node >=22 engine, .env.example and README install steps exist', () => {
    expect(pkg.scripts.dev).toMatch(/^next dev/);
    expect(pkg.scripts.build).toBe('next build');
    expect(pkg.scripts.start).toBe('next start');
    expect(pkg.engines?.node).toBe('>=22');
    expect(readFileSync(path.resolve(siteDir, '../.nvmrc'), 'utf8').trim()).toBe('22');
    expect(existsSync(path.join(siteDir, '.env.example'))).toBe(true);
    expect(existsSync(path.join(siteDir, 'package-lock.json'))).toBe(true);

    const readme = readFileSync(path.join(siteDir, 'README.md'), 'utf8');
    for (const step of ['nvm use', 'npm ci', 'cp .env.example .env.local', 'npm run dev', 'npm run verify']) {
      expect(readme, step).toContain(step);
    }
  });
});
