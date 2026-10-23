// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({ unstable_rethrow: () => {} }));

import { GET, POST } from '@/app/api/dev/session/route';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

const ctx = { params: Promise.resolve({}) };
const post = (body: unknown) =>
  POST(new Request('http://x/api/dev/session', { method: 'POST', body: JSON.stringify(body) }), ctx);
const get = (qs = '') => GET(new Request(`http://x/api/dev/session${qs}`), ctx);

beforeEach(() => {
  jar.store.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe('dev session route', () => {
  it('Dev route is 404 in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await get()).status).toBe(404);
    expect((await post({ cartId: 'a' })).status).toBe(404);
  });

  it('Dev route simulate 503 returns the safe upstream_unavailable body', async () => {
    const r = await get('?simulate=503');
    expect(r.status).toBe(503);
    const json = await r.json();
    expect(json.error.code).toBe('upstream_unavailable');
    expect(Object.keys(json.error).sort()).toEqual(['code', 'message']);
    expect((await get('?simulate=409')).status).toBe(409);
    expect((await get('?simulate=404')).status).toBe(404);
    expect((await get('?simulate=429')).status).toBe(429);
  });

  it('initial GET has an empty session and the default market', async () => {
    expect(await (await get()).json()).toEqual({
      session: {}, market: { country: 'US', currency: 'USD', locale: 'en-US' },
    });
  });

  it('Dev route POST market sets both cookies and drops cartId', async () => {
    const first = await post({ cartId: 'abc', customerId: 'c1', ignored: 'x' });
    expect(await first.json()).toEqual({ ok: true });
    const token1 = first.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    jar.store.set(SESSION_COOKIE, token1.split(';')[0].split('=')[1]);
    expect((await (await get()).json()).session).toEqual({ cartId: 'abc', customerId: 'c1' });

    const second = await post({ market: 'en-CA' });
    const cookies = second.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('malva-locale=en-CA'))).toBe(true);
    const token2 = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(';')[0].split('=')[1];
    expect(await verifySessionToken(token2)).toEqual({
      customerId: 'c1', country: 'CA', currency: 'CAD', locale: 'en-CA',
    });
    const flags = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(flags).toMatch(/HttpOnly/i);
    expect(flags).toMatch(/SameSite=lax/i);
    expect(flags).toMatch(/Max-Age=2592000/);
  });

  it('Dev route never returns the token', async () => {
    const r = await post({ cartId: 'abc' });
    const token = r.headers.getSetCookie()[0].split(';')[0].split('=')[1];
    expect(await r.text()).not.toContain(token);
    jar.store.set(SESSION_COOKIE, token);
    expect(JSON.stringify(await (await get()).json())).not.toContain(token);
  });
});
