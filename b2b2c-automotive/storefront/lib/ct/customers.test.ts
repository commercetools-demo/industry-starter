// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
const stores = vi.hoisted(() => [] as string[]);
vi.mock('./in-store', () => ({
  inStore: (storeKey: string) => {
    stores.push(storeKey);
    return {
      customers: () => ({
        post: (args: unknown) => ({ execute: () => post(args) }),
        withId: (args: unknown) => ({ delete: (a: unknown) => ({ execute: () => del(args, a) }) }),
      }),
    };
  },
}));

import { createStoreCustomer, DuplicateCustomerError, deleteCustomer } from './customers';

beforeEach(() => {
  post.mockReset();
  del.mockReset();
  stores.length = 0;
});

describe('createStoreCustomer', () => {
  it('creates the customer in the store of the order', async () => {
    post.mockResolvedValue({ body: { customer: { id: 'c-1', version: 1, email: 'qa-p1@example.com' } } });
    const customer = await createStoreCustomer('mau-reseller-north', { email: 'qa-p1@example.com', password: 'correct horse battery', firstName: 'Ada', lastName: 'Test' });
    expect(customer.id).toBe('c-1');
    expect(stores).toEqual(['mau-reseller-north']);
    expect(post.mock.calls[0][0].body).toMatchObject({ email: 'qa-p1@example.com', firstName: 'Ada', lastName: 'Test', custom: { type: { typeId: 'type', key: 'malva-customer' } } });
  });
  it('sets none of the malva-customer fields (an empty garage is written only by the garage code)', async () => {
    post.mockResolvedValue({ body: { customer: { id: 'c-1', version: 1 } } });
    await createStoreCustomer('mau-reseller-north', { email: 'a@example.com', password: 'correct horse battery' });
    expect(post.mock.calls[0][0].body.custom.fields).toEqual({});
    expect(post.mock.calls[0][0].body).not.toHaveProperty('firstName');
  });
  it('a duplicate email is its own error', async () => {
    post.mockRejectedValue({ statusCode: 400, body: { errors: [{ code: 'DuplicateField', field: 'email' }] } });
    await expect(createStoreCustomer('mau-reseller-north', { email: 'a@example.com', password: 'correct horse battery' })).rejects.toBeInstanceOf(DuplicateCustomerError);
  });
  it('other failures pass through', async () => {
    post.mockRejectedValue({ statusCode: 503 });
    await expect(createStoreCustomer('mau-reseller-north', { email: 'a@example.com', password: 'correct horse battery' })).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('deleteCustomer', () => {
  it('deletes by id and version in the store', async () => {
    del.mockResolvedValue({});
    await deleteCustomer('mau-reseller-north', 'c-1', 2);
    expect(del).toHaveBeenCalledWith({ ID: 'c-1' }, { queryArgs: { version: 2 } });
    expect(stores).toEqual(['mau-reseller-north']);
  });
});
