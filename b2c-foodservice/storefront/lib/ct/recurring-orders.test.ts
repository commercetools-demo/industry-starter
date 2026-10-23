// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RO_ID, ctRecurringOrder } from '@/test/recurring';

const h = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  orders: vi.fn(),
  policies: vi.fn(),
}));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    recurringOrders: () => ({
      get: (a: unknown) => ({ execute: async () => h.list(a) }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => h.get(ID) }),
        post: (a: unknown) => ({ execute: async () => h.post(ID, a) }),
      }),
    }),
    orders: () => ({ get: (a: unknown) => ({ execute: async () => h.orders(a) }) }),
  },
}));
vi.mock('@/lib/ct/product-detail', () => ({ getRecurrencePolicies: (l: string) => h.policies(l) }));

import { applyRecurringAction, getRecurringOrder, listPendingSubscriptions, listRecurringOrders } from '@/lib/ct/recurring-orders';

const conflict = Object.assign(new Error('c'), { statusCode: 409 });

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  h.get.mockImplementation(async () => ({ body: ctRecurringOrder() }));
  h.post.mockImplementation(async () => ({ body: ctRecurringOrder({ version: 4 }) }));
  h.policies.mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }, { id: '22222222-2222-4222-8222-222222222222' }]);
});

describe('recurring orders (server module)', () => {
  it('list query is scoped with a predicate variable', async () => {
    h.list.mockResolvedValue({ body: { results: [] } });
    await listRecurringOrders("c1' or 1=1");
    const { queryArgs } = h.list.mock.calls[0][0] as { queryArgs: Record<string, unknown> };
    expect(queryArgs.where).toBe('customer(id=:customerId)');
    expect(queryArgs['var.customerId']).toBe("c1' or 1=1");
    expect(JSON.stringify(queryArgs.where)).not.toContain('c1');
    expect(queryArgs.expand).toEqual(['cart', 'originOrder']);
  });

  it('pending detection reads the last orders of the customer with a predicate variable', async () => {
    h.orders.mockResolvedValue({ body: { results: [] } });
    await listPendingSubscriptions('c1', [], 'en-US');
    const { queryArgs } = h.orders.mock.calls[0][0] as { queryArgs: Record<string, unknown> };
    expect(queryArgs).toMatchObject({ where: 'customerId=:customerId', 'var.customerId': 'c1', limit: 10 });
  });

  it('an unknown id and another customer are the same not_found', async () => {
    await expect(getRecurringOrder('someone-else', RO_ID, 'en-US')).rejects.toMatchObject({ code: 'not_found', status: 404 });
    h.get.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 404 }));
    await expect(getRecurringOrder('cust-1', RO_ID, 'en-US')).rejects.toMatchObject({ code: 'not_found' });
    await expect(getRecurringOrder('cust-1', '../x y', 'en-US')).rejects.toMatchObject({ code: 'not_found' });
    expect(h.get).toHaveBeenCalledTimes(2);
  });

  it('writes one action with the version just read and expands the result', async () => {
    const sub = await applyRecurringAction('cust-1', RO_ID, { action: 'pause' }, 'en-US');
    expect(h.post).toHaveBeenCalledWith(RO_ID, {
      body: { version: 3, actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } }] },
      queryArgs: { expand: ['cart', 'originOrder'] },
    });
    expect(sub.version).toBe(4);
  });

  it('a conflict is retried once with a fresh version, a second conflict is a conflict error', async () => {
    h.post.mockRejectedValueOnce(conflict);
    h.get.mockResolvedValueOnce({ body: ctRecurringOrder() }).mockResolvedValueOnce({ body: ctRecurringOrder({ version: 9 }) });
    await applyRecurringAction('cust-1', RO_ID, { action: 'pause' }, 'en-US');
    expect((h.post.mock.calls[1][1] as { body: { version: number } }).body.version).toBe(9);

    h.post.mockReset();
    h.post.mockRejectedValue(conflict);
    await expect(applyRecurringAction('cust-1', RO_ID, { action: 'pause' }, 'en-US')).rejects.toMatchObject({ code: 'conflict' });
  });

  it('setInterval rejects an unknown policy before any write', async () => {
    await expect(
      applyRecurringAction('cust-1', RO_ID, { action: 'setInterval', recurrencePolicyId: '99999999-9999-4999-8999-999999999999' }, 'en-US'),
    ).rejects.toMatchObject({ code: 'subscription_unavailable', status: 422 });
    expect(h.post).not.toHaveBeenCalled();
  });

  it('an order that is processing refuses the update as invalid_state', async () => {
    h.post.mockRejectedValueOnce(Object.assign(new Error('busy'), { statusCode: 400 }));
    await expect(applyRecurringAction('cust-1', RO_ID, { action: 'pause' }, 'en-US')).rejects.toMatchObject({ code: 'invalid_state' });
  });
});
