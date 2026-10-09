// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';

/**
 * R-09: two guards for the account area.
 *  - Caching: every route under /api/account answers `Cache-Control: no-store` (signed out, failing, signed in).
 *  - Logging: lab values and reasons never reach the logger, on the happy path or when a read fails.
 */

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession(), updateSession: vi.fn(), clearCustomer: vi.fn() }));
// Every commercetools call fails with an error that echoes health data, as a platform error body can.
const SECRET = 'LDL cholesterol 148 mg/dL; reason: chest pain';
const down = () => {
  throw Object.assign(new Error(SECRET), { statusCode: 500, body: { message: SECRET } });
};
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: () => down }) }));

const routes = import.meta.glob('./**/route.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;
type Handler = (request: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const ctx = { params: Promise.resolve({ id: 'x', ref: 'BK-ABCDEFGHJK' }) };

function* handlers(): Generator<[string, Handler]> {
  for (const [file, mod] of Object.entries(routes)) {
    for (const method of METHODS) if (typeof mod[method] === 'function') yield [`${method} ${file}`, mod[method] as Handler];
  }
}
const call = (handler: Handler) =>
  handler(makeRequest('/api/account/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ firstName: 'Sam', lastName: 'Rivera' }) }), ctx);

const all = [...handlers()];
const sink: string[] = [];
beforeEach(() => {
  sink.length = 0;
  for (const level of ['error', 'warn', 'info', 'log', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void sink.push(JSON.stringify(args)));
  }
});

describe('design-account-area: Account data is scoped, minimized and not cached', () => {
  it('the glob found the account routes', () => {
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(all.map(([name]) => name).join('\n')).toContain('labs/[id]/pdf/route.ts');
  });

  it.each(all)('Caching: %s answers no-store when signed out', async (_name, handler) => {
    getSession.mockResolvedValue({});
    const response = await call(handler);
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each(all)('Caching: %s answers no-store when a read fails', async (_name, handler) => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    const response = await call(handler);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.clone().text()).not.toContain('chest pain');
  });

  it('Caching: pages of the account area and its API are marked non-cacheable in next.config', () => {
    const config = readFileSync(join(import.meta.dirname, '..', '..', '..', 'next.config.ts'), 'utf8');
    expect(config).toContain('"/:locale/account/:path*"');
    expect(config).toContain('"/api/account/:path*"');
    expect(config).toContain('"no-store"');
  });

  it('Caching: no account route bypasses handle() (which stamps no-store on every answer)', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (entry === 'route.ts') files.push(path);
      }
    };
    walk(import.meta.dirname);
    expect(files.length).toBe(Object.keys(routes).length);
    for (const file of files) expect(readFileSync(file, 'utf8'), file).toContain('handle(');
  });
});

describe('health-data-minimization: lab values and reasons never reach the logger', () => {
  it('a failing read logs nothing that contains the value or the reason, on any account route', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    for (const [, handler] of all) await call(handler);
    const logged = sink.join('\n');
    expect(logged).not.toContain('148');
    expect(logged).not.toContain('chest pain');
    expect(logged).not.toContain('LDL');
  });
});
