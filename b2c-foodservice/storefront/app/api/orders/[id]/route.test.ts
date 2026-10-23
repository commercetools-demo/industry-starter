// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ jar: new Map<string, string>(), view: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name) } : undefined) }),
}));
vi.mock('@/lib/ct/orders', () => ({ getOrderView: h.view }));

import { GET } from './route';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';

const call = (id: string) => GET(new Request(`http://x/api/orders/${id}`), { params: Promise.resolve({ id }) });
const order = (customerId: string | null) => ({ id: 'o1', orderNumber: 'MC-ABCDEFGHJK', customerId, lines: [] });

beforeEach(() => {
  h.jar.clear();
  h.view.mockReset();
});

describe('GET /api/orders/[id]', () => {
  it('shows a guest order to whoever holds the id', async () => {
    h.view.mockResolvedValue(order(null));
    const res = await call('o1');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(((await res.json()) as { order: { id: string } }).order.id).toBe('o1');
  });
  it('Member order needs the owning session', async () => {
    h.view.mockResolvedValue(order('cust-1'));
    h.jar.set(SESSION_COOKIE, await createSessionToken({ customerId: 'cust-2' }));
    const other = await call('o1');
    h.view.mockResolvedValue(null);
    const unknown = await call('o2');
    expect(other.status).toBe(404);
    expect(await other.text()).toBe(await unknown.text());
    h.view.mockResolvedValue(order('cust-1'));
    h.jar.set(SESSION_COOKIE, await createSessionToken({ customerId: 'cust-1' }));
    expect((await call('o1')).status).toBe(200);
  });
  it('refuses an id that is not an id before any call', async () => {
    expect((await call('x/../y')).status).toBe(404);
    expect(h.view).not.toHaveBeenCalled();
  });
});
