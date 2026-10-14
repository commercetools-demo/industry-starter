import { describe, expect, it } from 'vitest';
import { checkBuildOutput, checkNavRoutes, checkRoutes, navHrefs, parseRoutes } from './check-routes.mjs';
import { tmp } from './test-utils.mjs';

const NAV_SRC = `export const NAV = { top: item('dashboard', '/', 'home', 'a'), groups: [{ items: [item('catalog', '/catalog', 'tag', 'b')] }] };
export const ROUTE_ALLOW_LIST: string[] = ['/sign-in', '/reset/[token]'];`;
const page = (route) => [`app/[locale]/(portal)${route === '/' ? '' : route}/page.tsx`, 'export default function P() { return null; }'];
const auth = (route) => [`app/[locale]/(auth)${route}/page.tsx`, 'export default function P() { return null; }'];
const files = (extra = []) => Object.fromEntries([['lib/portal/nav.ts', NAV_SRC], page('/'), page('/catalog'), auth('/sign-in'), auth('/reset/[token]'), ...extra]);

describe('Navigation route map (R-02)', () => {
  it('reads nav hrefs and the allow-list from nav.ts', () => {
    expect(navHrefs(NAV_SRC)).toEqual({ hrefs: ['/', '/catalog'], allow: ['/sign-in', '/reset/[token]'] });
  });
  it('passes when every nav item has a page and every page is in the nav or the allow-list', () => {
    expect(checkNavRoutes(tmp(files()))).toEqual([]);
  });
  it('fails for nav item without page', () => {
    const root = tmp({ 'lib/portal/nav.ts': NAV_SRC, ...Object.fromEntries([page('/'), auth('/sign-in'), auth('/reset/[token]')]) });
    expect(checkNavRoutes(root).join('\n')).toMatch(/nav item \/catalog has no page/);
  });
  it('fails for a page that is neither in the nav nor in the allow-list', () => {
    expect(checkNavRoutes(tmp(files([page('/secret')]))).join('\n')).toMatch(/\/secret is not in the navigation or the allow-list/);
  });
  it('fails for seller route without cross-store test', () => {
    const root = tmp(files([['app/api/seller/prices/route.ts', 'export const GET = 1;']]));
    expect(checkNavRoutes(root).join('\n')).toMatch(/app\/api\/seller\/prices\/route\.ts has no route\.cross-store\.test\.ts/);
    const ok = tmp(files([['app/api/seller/prices/route.ts', 'x'], ['app/api/seller/prices/route.cross-store.test.ts', 'x']]));
    expect(checkNavRoutes(ok)).toEqual([]);
  });
});

const TABLE = `Route (app)
┌ ○ /_not-found
├ ● /[locale]
└ ƒ /dev/tokens
`;

describe('Route gate', () => {
  it('parses the route table', () => {
    expect(parseRoutes(TABLE).map((r) => r.route)).toEqual(['/_not-found', '/[locale]', '/dev/tokens']);
  });
  it('fails on a /dev route in the build output', () => {
    expect(checkRoutes(TABLE).join('')).toMatch(/route \/dev\/tokens must not be part of a build/);
  });
  it('passes on a clean table', () => {
    expect(checkRoutes('┌ ○ /_not-found\n└ ● /[locale]\n')).toEqual([]);
  });
  it('X-13: build output with no route table (a failed `next build` piped through tee still exits 0) is a problem', () => {
    expect(checkBuildOutput('> Build error occurred\nError: boom\n')[0]).toMatch(/no route table/);
    expect(checkBuildOutput('')).toHaveLength(1);
    expect(checkBuildOutput('┌ ○ /_not-found\n└ ● /[locale]\n')).toEqual([]);
  });
});
