// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeAddress { id?: string; key?: string; [k: string]: unknown }
interface FakeCustomer {
  id: string;
  version: number;
  addresses: FakeAddress[];
  shippingAddressIds: string[];
  defaultShippingAddressId?: string;
}
type Action = { action: string; address?: FakeAddress; addressId?: string; addressKey?: string };

let customer: FakeCustomer | null;
let nextId = 0;
let conflictOnce = false;
const posts: Action[][] = [];

function apply(actions: Action[]) {
  const c = customer as FakeCustomer;
  const find = (a: Action) => c.addresses.find((x) => (a.addressId ? x.id === a.addressId : x.key === a.addressKey));
  for (const a of actions) {
    if (a.action === 'addAddress') c.addresses.push({ ...a.address, id: `id${(nextId += 1)}` });
    else if (a.action === 'addShippingAddressId') c.shippingAddressIds.push(find(a)?.id as string);
    else if (a.action === 'setDefaultShippingAddress') c.defaultShippingAddressId = a.addressId || a.addressKey ? find(a)?.id : undefined;
    else if (a.action === 'changeAddress') {
      const i = c.addresses.findIndex((x) => x.id === a.addressId);
      c.addresses[i] = { ...a.address, id: a.addressId };
    } else if (a.action === 'removeAddress') {
      c.addresses = c.addresses.filter((x) => x.id !== a.addressId);
      c.shippingAddressIds = c.shippingAddressIds.filter((x) => x !== a.addressId);
      if (c.defaultShippingAddressId === a.addressId) c.defaultShippingAddressId = undefined;
    } else throw new Error(`unexpected action ${a.action}`);
  }
  c.version += 1;
}

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    customers: () => ({
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({
          execute: async () => {
            if (!customer || customer.id !== ID) throw Object.assign(new Error('nf'), { statusCode: 404 });
            return { body: structuredClone(customer) };
          },
        }),
        post: ({ body }: { body: { version: number; actions: Action[] } }) => ({
          execute: async () => {
            if (conflictOnce) {
              conflictOnce = false;
              (customer as FakeCustomer).version += 1;
              throw Object.assign(new Error('conflict'), { statusCode: 409 });
            }
            if (body.version !== (customer as FakeCustomer).version) throw Object.assign(new Error('conflict'), { statusCode: 409 });
            posts.push(body.actions);
            apply(body.actions);
            return { body: structuredClone(customer) };
          },
        }),
      }),
    }),
  },
}));

import { AddressNotFoundError, addAddress, listAddresses, removeAddress, setDefault, updateAddress } from './addresses';
import { CustomerNotFoundError } from './customer-update';

const input = (over: Record<string, string> = {}) => ({
  firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'Austin', state: 'TX', zip: '78701', phone: '+15125550100', ...over,
});

beforeEach(() => {
  customer = { id: 'c1', version: 1, addresses: [], shippingAddressIds: [] };
  nextId = 0;
  conflictOnce = false;
  posts.length = 0;
});

describe('account-and-self-service: customer addresses', () => {
  it('Address added and defaulted: the first address becomes the default; the actions are the verified customer update actions', async () => {
    const list = await addAddress('c1', input());
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ street: '12 Elm St', state: 'TX', zip: '78701', phone: '+15125550100', country: 'US', isDefault: true });
    expect(posts[0].map((a) => a.action)).toEqual(['addAddress', 'addShippingAddressId', 'setDefaultShippingAddress']);
    expect(posts[0][0].address).toMatchObject({ streetName: '12 Elm St', postalCode: '78701', country: 'US' });
    expect(posts[0][0].address?.key).toMatch(/^addr-/);
  });

  it('a later address is not the default unless asked; asking moves the default (exactly one)', async () => {
    await addAddress('c1', input());
    let list = await addAddress('c1', input({ street: '9 Oak Ave' }));
    expect(list.filter((a) => a.isDefault).map((a) => a.street)).toEqual(['12 Elm St']);
    list = await addAddress('c1', input({ street: '5 Pine Rd' }), true);
    expect(list.filter((a) => a.isDefault).map((a) => a.street)).toEqual(['5 Pine Rd']);
    expect(list[0].street).toBe('5 Pine Rd'); // default listed first
    expect(list).toHaveLength(3);
  });

  it('the additional line is stored only when present', async () => {
    await addAddress('c1', input({ street2: 'Apt 4' }));
    expect(posts[0][0].address?.additionalStreetInfo).toBe('Apt 4');
    expect((await listAddresses('c1'))[0].street2).toBe('Apt 4');
  });

  it('Default address removed: no other address is promoted silently', async () => {
    await addAddress('c1', input());
    const second = (await addAddress('c1', input({ street: '9 Oak Ave' })))[1];
    const first = (await listAddresses('c1'))[0];
    expect(first.isDefault).toBe(true);
    const list = await removeAddress('c1', first.id);
    expect(list.map((a) => a.id)).toEqual([second.id]);
    expect(list.some((a) => a.isDefault)).toBe(false);
    expect(customer?.defaultShippingAddressId).toBeUndefined();
  });

  it('Last address removed: the book is empty and the next add becomes the default again', async () => {
    const [only] = await addAddress('c1', input());
    expect(await removeAddress('c1', only.id)).toEqual([]);
    expect(await listAddresses('c1')).toEqual([]);
    expect((await addAddress('c1', input()))[0].isDefault).toBe(true);
  });

  it('removing a non-default address leaves the default alone', async () => {
    await addAddress('c1', input());
    const list = await addAddress('c1', input({ street: '9 Oak Ave' }));
    const other = list.find((a) => !a.isDefault)!;
    const after = await removeAddress('c1', other.id);
    expect(after).toHaveLength(1);
    expect(after[0].isDefault).toBe(true);
    expect(posts.at(-1)?.map((a) => a.action)).toEqual(['removeAddress']);
  });

  it('setDefault switches the default; an already-default address makes no update call', async () => {
    await addAddress('c1', input());
    const list = await addAddress('c1', input({ street: '9 Oak Ave' }));
    const other = list.find((a) => !a.isDefault)!;
    const calls = posts.length;
    const after = await setDefault('c1', other.id);
    expect(after.filter((a) => a.isDefault).map((a) => a.id)).toEqual([other.id]);
    await setDefault('c1', other.id);
    expect(posts.length).toBe(calls + 1);
  });

  it('updateAddress changes the fields in place and keeps the key; makeDefault is optional', async () => {
    const [saved] = await addAddress('c1', input());
    const keyBefore = customer?.addresses[0].key;
    const list = await updateAddress('c1', saved.id, input({ street: '77 New Rd', city: 'Dallas' }));
    expect(list[0]).toMatchObject({ id: saved.id, street: '77 New Rd', city: 'Dallas', isDefault: true });
    expect(customer?.addresses[0].key).toBe(keyBefore);
    const second = (await addAddress('c1', input({ street: '9 Oak Ave' }))).find((a) => !a.isDefault)!;
    const moved = await updateAddress('c1', second.id, input({ street: '9 Oak Ave' }), true);
    expect(moved.find((a) => a.isDefault)?.id).toBe(second.id);
  });

  it('an address id that is not on this customer is not found (no update call)', async () => {
    await addAddress('c1', input());
    const calls = posts.length;
    await expect(removeAddress('c1', 'someone-elses')).rejects.toBeInstanceOf(AddressNotFoundError);
    await expect(updateAddress('c1', 'someone-elses', input())).rejects.toBeInstanceOf(AddressNotFoundError);
    await expect(setDefault('c1', 'someone-elses')).rejects.toBeInstanceOf(AddressNotFoundError);
    expect(posts.length).toBe(calls);
  });

  it('a version conflict is retried once against the current version', async () => {
    conflictOnce = true;
    const list = await addAddress('c1', input());
    expect(list).toHaveLength(1);
    expect(posts).toHaveLength(1);
  });

  it('a deleted customer is reported as such', async () => {
    await expect(listAddresses('gone')).rejects.toBeInstanceOf(CustomerNotFoundError);
  });

  it('addresses saved elsewhere (not in the shipping list) are still listed', async () => {
    customer = { id: 'c1', version: 1, addresses: [{ id: 'x', firstName: 'A', lastName: 'B', streetName: 's', city: 'c', state: 'CA', postalCode: '90001', mobile: '+15125550101', country: 'US' }], shippingAddressIds: [] };
    const [a] = await listAddresses('c1');
    expect(a).toMatchObject({ id: 'x', phone: '+15125550101', street2: '', isDefault: false });
  });
});
