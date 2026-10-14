// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ list: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    paymentMethods: () => ({
      get: (arg: unknown) => ({ execute: async () => ({ body: await h.list(arg) }) }),
      withId: () => ({ delete: (arg: unknown) => ({ execute: async () => ({ body: await h.del(arg) }) }) }),
    }),
  },
}));

import { deletePaymentMethod, listPaymentMethods } from './account-payment-methods';

const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const METHOD = '22222222-2222-4222-8222-222222222222';
const method = { id: METHOD, version: 4, default: false, paymentMethodStatus: 'Active', token: { value: 'tok_secret' }, name: { 'en-US': 'Visa' } };

beforeEach(() => {
  h.list.mockReset().mockResolvedValue({ results: [method] });
  h.del.mockReset().mockResolvedValue({});
});

describe('payment methods', () => {
  it('lists only own methods and never exposes the token', async () => {
    const list = await listPaymentMethods(CUSTOMER, 'en-US');
    expect((h.list.mock.calls[0][0] as { queryArgs: { where: string } }).queryArgs.where).toBe(`customer(id="${CUSTOMER}")`);
    expect(JSON.stringify(list)).not.toContain('tok_secret');
    expect(list).toEqual([{ id: METHOD, label: 'Visa', last4: null, expiry: null, isDefault: false }]);
  });
  it('delete refuses another customer (404, nothing deleted)', async () => {
    h.list.mockResolvedValue({ results: [] });
    await expect(deletePaymentMethod(CUSTOMER, METHOD)).rejects.toMatchObject({ status: 404 });
    expect(h.del).not.toHaveBeenCalled();
    expect((h.list.mock.calls[0][0] as { queryArgs: { where: string } }).queryArgs.where).toContain(`customer(id="${CUSTOMER}")`);
  });
  it('delete sends the version of the owned method', async () => {
    await deletePaymentMethod(CUSTOMER, METHOD);
    expect(h.del).toHaveBeenCalledWith({ queryArgs: { version: 4 } });
  });
  it('a malformed id never reaches the predicate', async () => {
    await expect(deletePaymentMethod(CUSTOMER, 'x" or 1=1')).rejects.toMatchObject({ status: 404 });
    expect(h.list).not.toHaveBeenCalled();
  });
});
