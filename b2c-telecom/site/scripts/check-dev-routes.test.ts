// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkDevRoutes } from './check-dev-routes.mjs';

let site: string;

function app(...segments: string[]) {
  mkdirSync(path.join(site, '.next', 'server', 'app', ...segments), { recursive: true });
}

function manifest(entries: Record<string, string>) {
  writeFileSync(path.join(site, '.next', 'server', 'app-paths-manifest.json'), JSON.stringify(entries));
}

beforeEach(() => {
  site = mkdtempSync(path.join(tmpdir(), 'devroutes-'));
  app('api', 'auth', 'session');
});

afterEach(() => {
  rmSync(site, { recursive: true, force: true });
});

describe('check-dev-routes', () => {
  it('passes for a clean build', () => {
    manifest({ '/api/auth/session/route': 'app/api/auth/session/route.js', '/_not-found/page': 'app/_not-found/page.js' });
    expect(checkDevRoutes(site)).toEqual([]);
  });

  it('Connection check available in development only: a production build containing api/health fails the check', () => {
    app('api', 'health');
    const problems = checkDevRoutes(site);
    expect(problems.join('\n')).toContain('.next/server/app/api/health');
  });

  it('fails for api/dev and dev directories', () => {
    app('api', 'dev', 'session');
    app('dev', 'tokens');
    const text = checkDevRoutes(site).join('\n');
    expect(text).toContain('app/api/dev');
    expect(text).toContain('app/dev ');
  });

  it('fails when the manifest lists a health route', () => {
    manifest({ '/api/health/route': 'app/api/health/route.js' });
    expect(checkDevRoutes(site).join('\n')).toContain('/api/health/route');
  });

  it('fails when the manifest lists a .dev file', () => {
    manifest({ '/x/route': 'app/x/route.dev.js' });
    expect(checkDevRoutes(site)).not.toEqual([]);
  });

  it('fails when there is no build', () => {
    rmSync(path.join(site, '.next'), { recursive: true });
    expect(checkDevRoutes(site)).toEqual(['.next/server not found (run the build first)']);
  });
});
