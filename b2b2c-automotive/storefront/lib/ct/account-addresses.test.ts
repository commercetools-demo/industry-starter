// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/ct/in-store', () => ({
  inStore: () => ({
    customers: () => ({
      withId: () => ({
        get: () => ({ execute: async () => ({ body: await h.get() }) }),
        post: (arg: unknown) => ({ execute: async () => ({ body: await h.post(arg) }) }),
      }),
    }),
  }),
}));

import { addAddress, changeAddress, getDefaultShippingAddressDraft, listAddresses, removeAddress, setDefaultAddress } from './account-addresses';

const ID = '11111111-1111-4111-8111-111111111111';
const input = { firstName: 'Anna', lastName: 'S', streetName: 'Hauptstr.', streetNumber: '1', postalCode: '10115', city: 'Berlin', country: 'DE' };
const customer = (addresses: Array<{ id: string }>, over: Record<string, unknown> = {}) => ({ id: ID, version: 1, email: 'a@example.com', addresses: addresses.map((a) => ({ country: 'DE', ...a })), ...over });
const actionsOf = (call: number) => (h.post.mock.calls[call][0] as { body: { actions: Array<Record<string, unknown>> } }).body.actions;

beforeEach(() => {
  h.get.mockReset().mockResolvedValue(customer([{ id: 'a1' }], { defaultShippingAddressId: 'a1' }));
  h.post.mockReset().mockResolvedValue(customer([{ id: 'a1' }, { id: 'a2' }], { defaultShippingAddressId: 'a1' }));
});

describe('addresses', () => {
  it('add sets shipping id after finding the new address by diffing ids', async () => {
    await addAddress('s1', ID, input, ['DE']);
    expect(actionsOf(0)).toEqual([{ action: 'addAddress', address: expect.objectContaining({ city: 'Berlin', postalCode: '10115' }) }]);
    expect(actionsOf(1)).toEqual([{ action: 'addShippingAddressId', addressId: 'a2' }]);
  });
  it('set default on add uses setDefaultShippingAddress with the new id', async () => {
    await addAddress('s1', ID, { ...input, makeDefault: true }, ['DE']);
    expect(actionsOf(1)).toContainEqual({ action: 'setDefaultShippingAddress', addressId: 'a2' });
  });
  it('the first address becomes the default', async () => {
    h.get.mockResolvedValue(customer([]));
    h.post.mockResolvedValue(customer([{ id: 'a9' }]));
    await addAddress('s1', ID, input, ['DE']);
    expect(actionsOf(1)).toContainEqual({ action: 'setDefaultShippingAddress', addressId: 'a9' });
  });
  it('set default uses setDefaultShippingAddress', async () => {
    const result = await setDefaultAddress('s1', ID, 'a1');
    expect(actionsOf(0)).toEqual([{ action: 'setDefaultShippingAddress', addressId: 'a1' }]);
    expect(result.addresses).toHaveLength(2);
  });
  it('another customer address id is a 404', async () => {
    await expect(setDefaultAddress('s1', ID, 'zzz')).rejects.toMatchObject({ status: 404 });
    await expect(removeAddress('s1', ID, 'zzz')).rejects.toMatchObject({ status: 404 });
    await expect(changeAddress('s1', ID, 'zzz', input, ['DE'])).rejects.toMatchObject({ status: 404 });
    expect(h.post).not.toHaveBeenCalled();
  });
  it('removing the default clears default', async () => {
    h.post.mockResolvedValue(customer([]));
    const result = await removeAddress('s1', ID, 'a1');
    expect(actionsOf(0)).toEqual([{ action: 'removeAddress', addressId: 'a1' }]);
    expect(result.defaultShippingAddressId).toBeNull();
  });
  it('limit 20', async () => {
    h.get.mockResolvedValue(customer(Array.from({ length: 20 }, (_, i) => ({ id: `a${i}` }))));
    await expect(addAddress('s1', ID, input, ['DE'])).rejects.toMatchObject({ code: 'address-limit' });
    expect(h.post).not.toHaveBeenCalled();
  });
  it('country outside store refused', async () => {
    await expect(addAddress('s1', ID, { ...input, country: 'US', postalCode: '10001' }, ['DE'])).rejects.toMatchObject({ code: 'country-not-served' });
    expect(h.get).not.toHaveBeenCalled();
  });
  it('postal validated', async () => {
    await expect(addAddress('s1', ID, { ...input, postalCode: '1011' }, ['DE'])).rejects.toMatchObject({ code: 'postal-invalid' });
  });
  it('change address sends changeAddress', async () => {
    await changeAddress('s1', ID, 'a1', input, ['DE']);
    expect(actionsOf(0)[0]).toMatchObject({ action: 'changeAddress', addressId: 'a1' });
  });
  it('the default draft (contract for the checkout) is the address without its id', async () => {
    const draftOf = await getDefaultShippingAddressDraft('s1', ID);
    expect(draftOf).toEqual({ country: 'DE' });
    h.get.mockResolvedValue(customer([{ id: 'a1' }]));
    expect(await getDefaultShippingAddressDraft('s1', ID)).toBeNull();
  });
  it('list marks the default', async () => {
    const book = await listAddresses('s1', ID);
    expect(book.addresses[0].isDefault).toBe(true);
    expect(book.defaultShippingAddressId).toBe('a1');
  });
});
