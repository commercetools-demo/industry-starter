// @vitest-environment node
import type { Customer } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({}) }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    customers: () => ({
      withId: () => ({
        get: () => ({ execute: () => sdk.get() }),
        post: (a: unknown) => ({ execute: () => sdk.post(a) }),
      }),
    }),
  },
}));

import { afterDeleteDefault } from '@/lib/account/address-policy';
import { addAddress, changeAddress, removeAddress, toCtAddress } from '@/lib/ct/addresses';
import { toAppCustomer } from '@/lib/mappers/customer';

const addr = (id: string, extra: Record<string, unknown> = {}) => ({
  id, key: `k-${id}`, country: 'US', firstName: 'Maya', lastName: 'O', streetName: `${id} Street`, city: 'New York', postalCode: '10012', ...extra,
});
const customer = (addresses: unknown[], extra: Record<string, unknown> = {}): Customer =>
  ({ id: 'c1', version: 4, email: 'a@example.com', firstName: 'Maya', lastName: 'O', addresses, shippingAddressIds: [], billingAddressIds: [], ...extra }) as unknown as Customer;
const INPUT = { firstName: 'Maya', lastName: 'O', streetName: '1 Main St', city: 'New York', postalCode: '10012', state: 'NY', country: 'US', label: 'Home' };

const lastBody = () => sdk.post.mock.calls.at(-1)?.[0].body;

beforeEach(() => {
  sdk.get.mockReset();
  sdk.post.mockReset();
  sdk.get.mockResolvedValue({ body: customer([addr('a1')], { defaultShippingAddressId: 'a1', defaultBillingAddressId: 'a1' }) });
  sdk.post.mockImplementation(async () => ({ body: customer([addr('a1'), addr('a2')], { defaultShippingAddressId: 'a2', defaultBillingAddressId: 'a2' }) }));
});

describe('addAddress', () => {
  it('Address added and defaulted: ONE update with the address, both id lists and both defaults by key', async () => {
    await addAddress('c1', INPUT, true);
    expect(sdk.post).toHaveBeenCalledTimes(1);
    const { version, actions } = lastBody();
    expect(version).toBe(4);
    const key = actions[0].address.key as string;
    expect(key).toMatch(/^addr-/);
    expect(actions.map((a: { action: string }) => a.action)).toEqual([
      'addAddress', 'addShippingAddressId', 'addBillingAddressId', 'setDefaultShippingAddress', 'setDefaultBillingAddress',
    ]);
    expect(actions[1].addressKey).toBe(key);
    expect(actions[3].addressKey).toBe(key);
    expect(actions[0].address).toMatchObject({ streetName: '1 Main St', additionalAddressInfo: 'Home', country: 'US', state: 'NY' });
  });

  it('a non-default address changes no default', async () => {
    await addAddress('c1', INPUT, false);
    expect(lastBody().actions.map((a: { action: string }) => a.action)).toEqual(['addAddress', 'addShippingAddressId', 'addBillingAddressId']);
  });

  it('the first address becomes the default by itself', async () => {
    sdk.get.mockResolvedValue({ body: customer([]) });
    await addAddress('c1', INPUT, false);
    expect(lastBody().actions.map((a: { action: string }) => a.action)).toContain('setDefaultShippingAddress');
  });

  it('Default preselected for a new order: the saved default is exposed as isDefaultShipping', async () => {
    const out = await addAddress('c1', INPUT, true);
    expect(out.find((a) => a.id === 'a2')).toMatchObject({ isDefaultShipping: true, isDefaultBilling: true });
    expect(out.find((a) => a.id === 'a1')?.isDefaultShipping).toBe(false);
    expect(toAppCustomer(customer([addr('a1'), addr('a2')], { defaultShippingAddressId: 'a2' })).defaultShippingAddressId).toBe('a2');
  });
});

describe('changeAddress', () => {
  it('keeps the address key and can make it the default', async () => {
    await changeAddress('c1', 'a1', INPUT, true);
    const { actions } = lastBody();
    expect(actions[0]).toMatchObject({ action: 'changeAddress', addressId: 'a1', address: { key: 'k-a1', streetName: '1 Main St' } });
    expect(actions.slice(1).map((a: { action: string }) => a.action)).toEqual(['setDefaultShippingAddress', 'setDefaultBillingAddress']);
  });

  it('Address of another customer is 404 and nothing is written', async () => {
    await expect(changeAddress('c1', 'someone-elses', INPUT, false)).rejects.toMatchObject({ code: 'not_found', status: 404 });
    expect(sdk.post).not.toHaveBeenCalled();
  });
});

describe('removeAddress', () => {
  const two = () =>
    sdk.get.mockResolvedValue({ body: customer([addr('a1'), addr('a2')], { defaultShippingAddressId: 'a1', defaultBillingAddressId: 'a1' }) });

  it('Default address removed: the next address becomes the default in the same update and promotedId is returned', async () => {
    two();
    sdk.post.mockResolvedValue({ body: customer([addr('a2')], { defaultShippingAddressId: 'a2', defaultBillingAddressId: 'a2' }) });
    const out = await removeAddress('c1', 'a1');
    expect(lastBody().actions).toEqual([
      { action: 'removeAddress', addressId: 'a1' },
      { action: 'setDefaultShippingAddress', addressId: 'a2' },
      { action: 'setDefaultBillingAddress', addressId: 'a2' },
    ]);
    expect(out.promotedId).toBe('a2');
    expect(out.addresses[0].isDefaultShipping).toBe(true);
  });

  it('Default address removed under policy none: no default remains', async () => {
    two();
    sdk.post.mockResolvedValue({ body: customer([addr('a2')]) });
    const out = await removeAddress('c1', 'a1', 'none');
    expect(lastBody().actions).toEqual([{ action: 'removeAddress', addressId: 'a1' }]);
    expect(out.promotedId).toBeNull();
    expect(out.addresses.some((a) => a.isDefaultShipping)).toBe(false);
  });

  it('removing a non-default address leaves the default alone', async () => {
    two();
    await removeAddress('c1', 'a2');
    expect(lastBody().actions).toEqual([{ action: 'removeAddress', addressId: 'a2' }]);
  });

  it('Last address removed: no default left, no error', async () => {
    sdk.get.mockResolvedValue({ body: customer([addr('a1')], { defaultShippingAddressId: 'a1', defaultBillingAddressId: 'a1' }) });
    sdk.post.mockResolvedValue({ body: customer([]) });
    const out = await removeAddress('c1', 'a1');
    expect(lastBody().actions).toEqual([{ action: 'removeAddress', addressId: 'a1' }]);
    expect(out).toEqual({ addresses: [], promotedId: null });
  });

  it('Address of another customer is 404', async () => {
    two();
    await expect(removeAddress('c1', 'zzz')).rejects.toMatchObject({ status: 404 });
    expect(sdk.post).not.toHaveBeenCalled();
  });

  it('retries once on a concurrent modification with the re-read version', async () => {
    two();
    sdk.get.mockResolvedValueOnce({ body: customer([addr('a1'), addr('a2')], { version: 4, defaultShippingAddressId: 'a1' }) });
    sdk.get.mockResolvedValueOnce({ body: customer([addr('a1'), addr('a2')], { version: 5, defaultShippingAddressId: 'a1' }) });
    sdk.post.mockRejectedValueOnce({ statusCode: 409 });
    await removeAddress('c1', 'a2');
    expect(sdk.post.mock.calls.map((c) => c[0].body.version)).toEqual([4, 5]);
  });
});

describe('policy and mapping', () => {
  it('afterDeleteDefault picks the first remaining address, or null', () => {
    expect(afterDeleteDefault([{ id: 'a' }, { id: 'b' }], 'a')).toBe('b');
    expect(afterDeleteDefault([{ id: 'a' }], 'a')).toBeNull();
    expect(afterDeleteDefault([{ id: 'a' }, { id: 'b' }], 'a', 'none')).toBeNull();
  });

  it('toCtAddress omits empty optional fields', () => {
    expect(toCtAddress({ firstName: 'A', lastName: 'B', streetName: 'S', city: 'C', postalCode: '10012', country: 'US' })).toEqual({
      country: 'US', firstName: 'A', lastName: 'B', streetName: 'S', city: 'C', postalCode: '10012',
    });
  });
});
