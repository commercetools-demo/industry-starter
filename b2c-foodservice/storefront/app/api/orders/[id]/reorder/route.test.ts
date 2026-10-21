// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const ct = vi.hoisted(() => ({ getCustomerOrderById: vi.fn(), runReorder: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/orders', () => ({ getCustomerOrderById: ct.getCustomerOrderById }));
vi.mock('@/lib/ct/reorder', () => ({ runReorder: ct.runReorder }));

import { POST } from '@/app/api/orders/[id]/reorder/route';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from '@/lib/session';
import { ctOrder } from '@/test/orders';

const call = (id: string) => POST(new Request(`http://x/api/orders/${id}/reorder`, { method: 'POST' }), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  jar.store.clear();
  ct.getCustomerOrderById.mockReset();
  ct.runReorder.mockReset();
  jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1', cartId: 'old' }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/orders/[id]/reorder', () => {
  it('adds the lines and writes the new cart id into the session cookie', async () => {
    ct.getCustomerOrderById.mockResolvedValue(ctOrder());
    ct.runReorder.mockResolvedValue({
      result: { added: [{ sku: 'S', name: 'N', quantity: 1, fulfilment: 'delivery' }], skipped: [], cart: { id: 'new', version: 1, count: 1, lines: [] } },
      session: { customerId: 'c1', cartId: 'new' },
    });
    const res = await call('o1');
    expect(res.status).toBe(200);
    expect((await res.json()).added).toHaveLength(1);
    const cookie = res.headers.get('set-cookie') ?? '';
    const token = /malva-session=([^;]+)/.exec(cookie)?.[1];
    expect((await verifySessionToken(token)).cartId).toBe('new');
  });

  it("Reorder of another customer's order is 404 and adds nothing", async () => {
    ct.getCustomerOrderById.mockResolvedValue(null);
    const res = await call('o-foreign');
    expect(res.status).toBe(404);
    expect(ct.runReorder).not.toHaveBeenCalled();
  });

  it('401 without a session', async () => {
    jar.store.clear();
    expect((await call('o1')).status).toBe(401);
  });
});
