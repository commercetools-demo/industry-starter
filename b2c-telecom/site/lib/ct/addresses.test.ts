// @vitest-environment node
import type { Customer } from '@commercetools/platform-sdk';

type Post = { id: string; version: number; actions: Array<Record<string, unknown>> };
const world = {
  customer: undefined as unknown as Customer,
  posts: [] as Post[],
  reads: 0,
  failStatus: undefined as number | undefined,
  failCount: 0,
};

vi.mock('./customer', () => ({
  getCustomerById: async () => {
    world.reads += 1;
    return world.customer;
  },
}));
vi.mock('./client', () => ({
  getApiRoot: () => ({
    customers: () => ({
      withId: ({ ID }: { ID: string }) => ({
        post: ({ body }: { body: { version: number; actions: Array<Record<string, unknown>> } }) => ({
          execute: async () => {
            world.posts.push({ id: ID, version: body.version, actions: body.actions });
            if (world.failStatus && world.failCount > 0) {
              const statusCode = world.failStatus;
              world.failCount -= 1;
              world.customer = { ...world.customer, version: world.customer.version + 1 };
              throw Object.assign(new Error('failed'), { statusCode });
            }
            return { body: world.customer };
          },
        }),
      }),
    }),
  }),
}));

import { AddressLimitError, AddressNotFoundError, addAddress, changeAddress, getAddresses, removeAddress, setDefault } from './addresses';
import type { AddressInput } from '@/lib/types';

const ct = (id: string, extra: Record<string, unknown> = {}) => ({ id, key: `k-${id}`, firstName: 'Ada', lastName: 'L', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', ...extra });
const customer = (overrides: Partial<Customer> = {}): Customer => ({ id: 'cust-1', version: 3, addresses: [], shippingAddressIds: [], billingAddressIds: [], ...overrides }) as unknown as Customer;
const input: AddressInput = { firstName: 'Ada', lastName: 'Lovelace', streetName: '1 Main St', city: 'New York', state: 'NY', postalCode: '10001', country: 'US', isService: true, isBilling: true };
const key = () => 'addr-fixed';

beforeEach(() => {
  world.customer = customer();
  world.posts = [];
  world.reads = 0;
  world.failStatus = undefined;
  world.failCount = 0;
});

describe('addAddress', () => {
  it('stores the address, its purposes and the defaults in one update', async () => {
    await addAddress('cust-1', input, { service: true, billing: true }, key);
    expect(world.posts).toHaveLength(1);
    expect(world.posts[0]?.version).toBe(3);
    expect(world.posts[0]?.actions.map((a) => a.action)).toEqual(['addAddress', 'addShippingAddressId', 'addBillingAddressId', 'setDefaultShippingAddress', 'setDefaultBillingAddress']);
    expect(world.posts[0]?.actions[1]).toEqual({ action: 'addShippingAddressId', addressKey: 'addr-fixed' });
    expect((world.posts[0]?.actions[0] as { address: { key: string } }).address.key).toBe('addr-fixed');
  });
  it('makes the first address the default of each purpose it serves even when not asked', async () => {
    await addAddress('cust-1', { ...input, isBilling: false }, { service: false, billing: false }, key);
    expect(world.posts[0]?.actions.map((a) => a.action)).toEqual(['addAddress', 'addShippingAddressId', 'setDefaultShippingAddress']);
  });
  it('keeps the existing default when the new address is not asked to be one', async () => {
    world.customer = customer({ addresses: [ct('a1')] as never, shippingAddressIds: ['a1'], billingAddressIds: ['a1'], defaultShippingAddressId: 'a1', defaultBillingAddressId: 'a1' });
    await addAddress('cust-1', input, { service: false, billing: false }, key);
    expect(world.posts[0]?.actions.map((a) => a.action)).toEqual(['addAddress', 'addShippingAddressId', 'addBillingAddressId']);
  });
  it('refuses the eleventh address before calling commercetools', async () => {
    world.customer = customer({ addresses: Array.from({ length: 10 }, (_, i) => ct(`a${i}`)) as never });
    await expect(addAddress('cust-1', input, { service: false, billing: false }, key)).rejects.toBeInstanceOf(AddressLimitError);
    expect(world.posts).toHaveLength(0);
  });
  it('re-reads and retries once on a version conflict', async () => {
    world.failStatus = 409;
    world.failCount = 1;
    await addAddress('cust-1', input, { service: true, billing: true }, key);
    expect(world.posts.map((p) => p.version)).toEqual([3, 4]);
  });
  it('gives up after the second conflict', async () => {
    world.failStatus = 409;
    world.failCount = 2;
    await expect(addAddress('cust-1', input, { service: true, billing: true }, key)).rejects.toMatchObject({ statusCode: 409 });
    expect(world.posts).toHaveLength(2);
  });
});

describe('changeAddress', () => {
  it('Changes the address and only the purposes that changed; defaults stay', async () => {
    world.customer = customer({ addresses: [ct('a1')] as never, shippingAddressIds: ['a1'], billingAddressIds: [], defaultShippingAddressId: 'a1' });
    await changeAddress('cust-1', 'a1', { ...input, isService: true, isBilling: true });
    expect(world.posts[0]?.actions.map((a) => a.action)).toEqual(['changeAddress', 'addBillingAddressId']);
    await changeAddress('cust-1', 'a1', { ...input, isService: false, isBilling: false });
    expect(world.posts[1]?.actions.map((a) => a.action)).toEqual(['changeAddress', 'removeShippingAddressId']);
    expect((world.posts[0]?.actions[0] as { address: { key: string } }).address.key).toBe('k-a1');
  });
  it('rejects an id that is not in this customer book before any request', async () => {
    world.customer = customer({ addresses: [ct('a1')] as never });
    await expect(changeAddress('cust-1', 'someone-elses', input)).rejects.toBeInstanceOf(AddressNotFoundError);
    expect(world.posts).toHaveLength(0);
  });
});

describe('removeAddress', () => {
  it('Default address removed: only removeAddress is sent and no other address is promoted', async () => {
    world.customer = customer({ addresses: [ct('a1'), ct('a2')] as never, shippingAddressIds: ['a1', 'a2'], defaultShippingAddressId: 'a1' });
    await removeAddress('cust-1', 'a1');
    expect(world.posts).toHaveLength(1);
    expect(world.posts[0]?.actions).toEqual([{ action: 'removeAddress', addressId: 'a1' }]);
  });
  it('rejects a foreign address id before any request', async () => {
    await expect(removeAddress('cust-1', 'nope')).rejects.toBeInstanceOf(AddressNotFoundError);
    expect(world.posts).toHaveLength(0);
  });
});

describe('setDefault', () => {
  it('adds the purpose only when the address does not have it yet', async () => {
    world.customer = customer({ addresses: [ct('a1')] as never, shippingAddressIds: [], billingAddressIds: ['a1'] });
    await setDefault('cust-1', 'a1', 'service');
    expect(world.posts[0]?.actions).toEqual([{ action: 'addShippingAddressId', addressId: 'a1' }, { action: 'setDefaultShippingAddress', addressId: 'a1' }]);
    await setDefault('cust-1', 'a1', 'billing');
    expect(world.posts[1]?.actions).toEqual([{ action: 'setDefaultBillingAddress', addressId: 'a1' }]);
  });
  it('rejects a foreign address id', async () => {
    await expect(setDefault('cust-1', 'nope', 'service')).rejects.toBeInstanceOf(AddressNotFoundError);
  });
});

describe('getAddresses', () => {
  it('maps the whole book with purposes and defaults', async () => {
    world.customer = customer({ addresses: [ct('a1'), ct('a2')] as never, shippingAddressIds: ['a1'], billingAddressIds: ['a2'], defaultShippingAddressId: 'a1' });
    const list = await getAddresses('cust-1');
    expect(list.map((a) => [a.id, a.isService, a.isBilling, a.isDefaultService, a.isDefaultBilling])).toEqual([
      ['a1', true, false, true, false],
      ['a2', false, true, false, false],
    ]);
  });
});
