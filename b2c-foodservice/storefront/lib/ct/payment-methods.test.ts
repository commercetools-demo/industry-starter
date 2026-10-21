// @vitest-environment node
import type { PaymentMethod } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), post: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({}) }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    paymentMethods: () => ({
      get: (a: unknown) => ({ execute: () => sdk.list(a) }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: () => sdk.get(ID) }),
        post: (a: unknown) => ({ execute: () => sdk.post(ID, a) }),
        delete: () => ({ execute: () => sdk.del(ID) }),
      }),
    }),
  },
}));

import { listPaymentMethods, removePaymentMethod, setDefaultPaymentMethod } from '@/lib/ct/payment-methods';
import { toPaymentMethodView } from '@/lib/mappers/payment-method';

const pm = (id: string, over: Record<string, unknown> = {}): PaymentMethod =>
  ({
    id, version: 3, customer: { typeId: 'customer', id: 'c1' }, method: 'card', default: false, paymentMethodStatus: 'Active',
    token: { value: 'tok_SECRET_VALUE' }, paymentInterface: 'stripe', interfaceAccount: 'acct_SECRET', ...over,
  }) as unknown as PaymentMethod;

beforeEach(() => {
  for (const f of Object.values(sdk)) f.mockReset();
  sdk.get.mockImplementation(async (id: string) => ({ body: pm(id) }));
  sdk.post.mockResolvedValue({ body: pm('x') });
});

describe('payment methods', () => {
  it('lists only the customer active methods', async () => {
    sdk.list.mockResolvedValue({ body: { results: [pm('p1')] } });
    await listPaymentMethods('c1');
    const q = sdk.list.mock.calls[0][0].queryArgs;
    expect(q.where).toBe('customer(id=:c) and paymentMethodStatus="Active"');
    expect(q['var.c']).toBe('c1');
  });

  it('Card tokenized then listed: the view carries a label and the default flag, never the token', () => {
    const view = toPaymentMethodView(pm('p1', { name: { 'en-US': 'Visa ending 4242' }, default: true }), 'en-US');
    expect(view).toEqual({ id: 'p1', version: 3, label: 'Visa ending 4242', method: 'card', isDefault: true });
    expect(JSON.stringify(view)).not.toContain('SECRET');
    expect(JSON.stringify(view)).not.toContain('stripe');
    expect(toPaymentMethodView(pm('p2'), 'en-US').label).toBe('');
  });

  it('Remove sets Inactive and does not delete', async () => {
    await removePaymentMethod('c1', 'p1');
    expect(sdk.del).not.toHaveBeenCalled();
    expect(sdk.post).toHaveBeenCalledWith('p1', { body: { version: 3, actions: [{ action: 'setPaymentMethodStatus', paymentMethodStatus: 'Inactive' }] } });
  });

  it('Default method removed: made non-default in the same update, and nothing else is promoted', async () => {
    sdk.get.mockImplementation(async (id: string) => ({ body: pm(id, { default: true }) }));
    await removePaymentMethod('c1', 'p1');
    expect(sdk.post).toHaveBeenCalledTimes(1);
    expect(sdk.post.mock.calls[0][1].body.actions).toEqual([
      { action: 'setDefault', default: false },
      { action: 'setPaymentMethodStatus', paymentMethodStatus: 'Inactive' },
    ]);
  });

  it('a foreign, unknown or already inactive method is 404 and nothing is written', async () => {
    sdk.get.mockResolvedValueOnce({ body: pm('p1', { customer: { typeId: 'customer', id: 'someone-else' } }) });
    await expect(removePaymentMethod('c1', 'p1')).rejects.toMatchObject({ status: 404 });
    sdk.get.mockResolvedValueOnce({ body: pm('p1', { paymentMethodStatus: 'Inactive' }) });
    await expect(removePaymentMethod('c1', 'p1')).rejects.toMatchObject({ status: 404 });
    sdk.get.mockRejectedValueOnce({ statusCode: 404 });
    await expect(removePaymentMethod('c1', 'nope')).rejects.toMatchObject({ status: 404 });
    expect(sdk.post).not.toHaveBeenCalled();
  });

  it('Set default clears the current default first, then sets the chosen one', async () => {
    sdk.list.mockResolvedValue({ body: { results: [pm('old', { default: true }), pm('new')] } });
    sdk.get.mockImplementation(async (id: string) => ({ body: pm(id, { default: id === 'old' }) }));
    await setDefaultPaymentMethod('c1', 'new');
    expect(sdk.post.mock.calls.map((c) => [c[0], c[1].body.actions])).toEqual([
      ['old', [{ action: 'setDefault', default: false }]],
      ['new', [{ action: 'setDefault', default: true }]],
    ]);
  });
});
