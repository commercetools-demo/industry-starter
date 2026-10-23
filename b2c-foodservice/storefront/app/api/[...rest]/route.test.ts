// @vitest-environment node
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as catchAll from './route';

function routeDirs(dir: string, base = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) return name === 'route.ts' ? [base || '/'] : [];
    return routeDirs(p, `${base}/${name}`);
  });
}

describe('unknown /api paths', () => {
  it('unknown api path answers json 404 for every method', async () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const) {
      const res = await catchAll[method]();
      expect(res.status, method).toBe(404);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } });
    }
    const head = catchAll.HEAD();
    expect(head.status).toBe(404);
  });

  it('existing api routes are not shadowed', () => {
    const routes = routeDirs(join(process.cwd(), 'app/api'));
    // The catch-all is the only catch-all route; every more specific path (static or dynamic) is matched first.
    expect(routes.filter((r) => r.includes('[...'))).toEqual(['/[...rest]']);
    for (const known of ['/availability', '/channels', '/contact', '/faq-feedback', '/newsletter']) {
      expect(routes, known).toContain(known);
    }
  });
});
