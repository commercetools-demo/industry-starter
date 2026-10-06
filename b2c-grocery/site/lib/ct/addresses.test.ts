import { beforeEach, describe, expect, it, vi } from 'vitest';

const getExecute = vi.fn();
const postCall = vi.fn();
const postExecute = vi.fn();
vi.mock('./client', () => ({
  getApiRoot: () => ({
    customers: () => ({
      withId: (id: unknown) => ({
        get: () => ({ execute: getExecute }),
        post: (args: unknown) => (postCall(id, args), { execute: postExecute }),
      }),
    }),
  }),
}));

import { addAddress, AddressCustomerNotFoundError, AddressNotFoundError, changeAddress, getAddresses, makeDefault, removeAddress } from './addresses';

const ct = (addresses: object[] = [], extra: object = {}) => ({ id: 'c1', version: 3, email: 'a@example.com', addresses, ...extra });
const addr = { id: 'a1', firstName: 'Ada', lastName: 'L', streetName: '1 Main', postalCode: '94105', city: 'SF', country: 'US' };
const input = { firstName: 'Ada', lastName: 'L', streetName: '1 Main', postalCode: '94105', city: 'SF', country: 'US' };
const actionsOf = (n = 0) => (postCall.mock.calls[n][1] as { body: { version: number; actions: { action: string }[] } }).body;
const conflict = () => Object.assign(new Error('conflict'), { statusCode: 409 });

beforeEach(() => {
  vi.clearAllMocks();
  getExecute.mockReset();
  postExecute.mockReset();
});

describe('getAddresses', () => {
  it('maps the book with default flags', async () => {
    getExecute.mockResolvedValue({ body: ct([addr, { ...addr, id: 'a2' }], { defaultShippingAddressId: 'a2' }) });
    const list = await getAddresses('c1');
    expect(list.map((a) => [a.id, a.isDefaultShipping])).toEqual([
      ['a1', false],
      ['a2', true],
    ]);
  });

  it('a missing customer is a typed error', async () => {
    getExecute.mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 }));
    await expect(getAddresses('x')).rejects.toBeInstanceOf(AddressCustomerNotFoundError);
  });
});

describe('addAddress', () => {
  it('the first address becomes the default shipping address (by key)', async () => {
    getExecute.mockResolvedValue({ body: ct([]) });
    postExecute.mockResolvedValue({ body: ct([{ ...addr, key: 'k' }], { defaultShippingAddressId: 'a1' }) });
    const list = await addAddress('c1', input);
    const { version, actions } = actionsOf();
    expect(version).toBe(3);
    expect(actions.map((a) => a.action)).toEqual(['addAddress', 'setDefaultShippingAddress']);
    const key = (actions[0] as unknown as { address: { key: string; streetName: string } }).address.key;
    expect(key).toMatch(/^address-/);
    expect((actions[1] as unknown as { addressKey: string }).addressKey).toBe(key);
    expect(list[0].isDefaultShipping).toBe(true);
  });

  it('a later address is only added (the default stays)', async () => {
    getExecute.mockResolvedValue({ body: ct([addr], { defaultShippingAddressId: 'a1' }) });
    postExecute.mockResolvedValue({ body: ct([addr, { ...addr, id: 'a2' }], { defaultShippingAddressId: 'a1' }) });
    await addAddress('c1', { ...input, additionalStreetInfo: 'Apt 2', phone: '+1 415 555 0100' });
    const { actions } = actionsOf();
    expect(actions.map((a) => a.action)).toEqual(['addAddress']);
    expect((actions[0] as unknown as { address: object }).address).toMatchObject({ additionalStreetInfo: 'Apt 2', phone: '+1 415 555 0100', country: 'US' });
  });

  it('retries once on 409 with a fresh version', async () => {
    getExecute.mockResolvedValueOnce({ body: ct([addr], { defaultShippingAddressId: 'a1' }) }).mockResolvedValueOnce({ body: { ...ct([addr, { ...addr, id: 'a0' }]), version: 4 } });
    postExecute.mockRejectedValueOnce(conflict()).mockResolvedValueOnce({ body: ct([addr]) });
    await addAddress('c1', input);
    expect(postCall).toHaveBeenCalledTimes(2);
    expect(actionsOf(0).version).toBe(3);
    expect(actionsOf(1).version).toBe(4);
  });

  it('a second 409 propagates', async () => {
    getExecute.mockResolvedValue({ body: ct([addr]) });
    postExecute.mockRejectedValue(conflict());
    await expect(addAddress('c1', input)).rejects.toThrow('conflict');
    expect(postCall).toHaveBeenCalledTimes(2);
  });
});

describe('changeAddress', () => {
  it('sends changeAddress for the id', async () => {
    getExecute.mockResolvedValue({ body: ct([addr]) });
    postExecute.mockResolvedValue({ body: ct([{ ...addr, city: 'Oakland' }]) });
    const list = await changeAddress('c1', 'a1', { ...input, city: 'Oakland' });
    expect(actionsOf().actions).toEqual([{ action: 'changeAddress', addressId: 'a1', address: expect.objectContaining({ city: 'Oakland', country: 'US' }) }]);
    expect(list[0].city).toBe('Oakland');
  });

  it('an address that is not in the book is refused without calling commercetools', async () => {
    getExecute.mockResolvedValue({ body: ct([addr]) });
    await expect(changeAddress('c1', 'foreign', input)).rejects.toBeInstanceOf(AddressNotFoundError);
    expect(postCall).not.toHaveBeenCalled();
  });
});

describe('removeAddress', () => {
  it('sends removeAddress; Delete default: the answer has no default flag', async () => {
    getExecute.mockResolvedValue({ body: ct([addr], { defaultShippingAddressId: 'a1' }) });
    postExecute.mockResolvedValue({ body: ct([]) });
    expect(await removeAddress('c1', 'a1')).toEqual([]);
    expect(actionsOf().actions).toEqual([{ action: 'removeAddress', addressId: 'a1' }]);
  });

  it('the remaining addresses carry no default when commercetools cleared it', async () => {
    getExecute.mockResolvedValue({ body: ct([addr, { ...addr, id: 'a2' }], { defaultShippingAddressId: 'a1' }) });
    postExecute.mockResolvedValue({ body: ct([{ ...addr, id: 'a2' }]) });
    const list = await removeAddress('c1', 'a1');
    expect(list).toHaveLength(1);
    expect(list.some((a) => a.isDefaultShipping || a.isDefaultBilling)).toBe(false);
  });

  it('unknown address: AddressNotFoundError', async () => {
    getExecute.mockResolvedValue({ body: ct([]) });
    await expect(removeAddress('c1', 'a9')).rejects.toBeInstanceOf(AddressNotFoundError);
  });
});

describe('makeDefault', () => {
  it('sets default shipping and billing, tag moves', async () => {
    getExecute.mockResolvedValue({ body: ct([addr, { ...addr, id: 'a2' }], { defaultShippingAddressId: 'a1', defaultBillingAddressId: 'a1' }) });
    postExecute.mockResolvedValue({ body: ct([addr, { ...addr, id: 'a2' }], { defaultShippingAddressId: 'a2', defaultBillingAddressId: 'a2' }) });
    const list = await makeDefault('c1', 'a2');
    expect(actionsOf().actions).toEqual([
      { action: 'setDefaultShippingAddress', addressId: 'a2' },
      { action: 'setDefaultBillingAddress', addressId: 'a2' },
    ]);
    expect(list.map((a) => a.isDefaultShipping)).toEqual([false, true]);
    expect(list.map((a) => a.isDefaultBilling)).toEqual([false, true]);
  });
});
