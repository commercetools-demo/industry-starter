// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkRoutePolicy, parsePolicy } from './check-route-policy.mjs';
import { listRoutes, methodsOf, patternOf } from './list-routes.mjs';
import path from 'node:path';
import { tmpApp as tmp } from './test-utils.mjs';

const appRoot = path.resolve(import.meta.dirname, '..');

const POLICY = `export const ROUTE_POLICY = [\n  p('/api/a', { GET: 'public', POST: 'session' }),\n  p('/api/b/[id]', { DELETE: 'x.y' }),\n];`;
const route = (methods) => methods.map((m) => `export const ${m} = async () => new Response('ok');`).join('\n');

describe('route policy gate', () => {
  it('reads patterns and methods of a route file', () => {
    expect(patternOf('app/api/seller/orders/[number]/route.ts')).toBe('/api/seller/orders/[number]');
    expect(methodsOf('export const GET = h;\nexport async function POST() {}\nexport { h as DELETE };')).toEqual(['GET', 'POST', 'DELETE']);
    expect([...parsePolicy(POLICY).get('/api/a')]).toEqual(['GET', 'POST']);
  });
  it('a route without a policy line fails', () => {
    const root = tmp({ 'app/api/a/route.ts': route(['GET', 'POST']), 'app/api/new/route.ts': route(['POST']), 'app/api/b/[id]/route.ts': route(['DELETE']), 'lib/authz/route-policy.ts': POLICY });
    expect(checkRoutePolicy(root).join('\n')).toMatch(/app\/api\/new\/route\.ts has no line/);
  });
  it('an exported method without access, and a line without a route, fail', () => {
    const root = tmp({ 'app/api/a/route.ts': route(['GET', 'POST', 'PUT']), 'lib/authz/route-policy.ts': POLICY });
    const out = checkRoutePolicy(root).join('\n');
    expect(out).toMatch(/exports PUT but the policy line of \/api\/a gives it no access/);
    expect(out).toMatch(/policy line \/api\/b\/\[id\] has no route file/);
  });
  it('a complete policy passes; an app without app/api passes', () => {
    const root = tmp({ 'app/api/a/route.ts': route(['GET', 'POST']), 'app/api/b/[id]/route.ts': route(['DELETE']), 'lib/authz/route-policy.ts': POLICY });
    expect(checkRoutePolicy(root)).toEqual([]);
    expect(checkRoutePolicy(tmp({}))).toEqual([]);
  });
  it('a missing policy file fails when routes exist', () => {
    expect(checkRoutePolicy(tmp({ 'app/api/a/route.ts': route(['GET']) })).join('\n')).toMatch(/route-policy\.ts is missing/);
  });
  it('the real app has a policy line for every route', () => {
    expect(listRoutes(appRoot).length).toBeGreaterThan(5);
    expect(checkRoutePolicy(appRoot)).toEqual([]);
  });
});
