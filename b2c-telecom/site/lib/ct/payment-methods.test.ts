// @vitest-environment node
import type { PaymentMethod } from '@commercetools/platform-sdk';

const CUSTOMER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

type Request = { kind: 'list' | 'get' | 'post'; id?: string; version?: number; actions?: Array<Record<string, unknown>>; where?: string };
const world = {
  requests: [] as Request[],
  records: [] as PaymentMethod[],
  failNextPost: undefined as number | undefined,
  listStatus: undefined as number | undefined,
};

const pm = (id: string, over: Record<string, unknown> = {}): PaymentMethod =>
  ({ id, version: 1, default: false, paymentMethodStatus: 'Active', customer: { typeId: 'customer', id: CUSTOMER }, ...over }) as unknown as PaymentMethod;

vi.mock('./client', () => ({
  getApiRoot: () => ({
    paymentMethods: () => ({
      get: ({ queryArgs }: { queryArgs: { where: string } }) => ({
        execute: async () => {
          world.requests.push({ kind: 'list', where: queryArgs.where });
          if (world.listStatus) throw Object.assign(new Error('x'), { statusCode: world.listStatus });
          return { body: { results: world.records.filter((r) => r.paymentMethodStatus === 'Active') } };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({
          execute: async () => {
            world.requests.push({ kind: 'get', id: ID });
            return { body: world.records.find((r) => r.id === ID) };
          },
        }),
        post: ({ body }: { body: { version: number; actions: Array<Record<string, unknown>> } }) => ({
          execute: async () => {
            world.requests.push({ kind: 'post', id: ID, version: body.version, actions: body.actions });
            const record = world.records.find((r) => r.id === ID) as unknown as { version: number; default: boolean; paymentMethodStatus: string };
            if (world.failNextPost) {
              const statusCode = world.failNextPost;
              world.failNextPost = undefined;
              record.version += 1;
              throw Object.assign(new Error('conflict'), { statusCode });
            }
            for (const action of body.actions) {
              if (action.action === 'setDefault') record.default = action.default as boolean;
              if (action.action === 'setPaymentMethodStatus') record.paymentMethodStatus = action.paymentMethodStatus as string;
            }
            record.version += 1;
            return { body: record };
          },
        }),
      }),
    }),
  }),
}));

import { listPaymentMethods, PaymentMethodNotFoundError, PaymentMethodsForbiddenError, removePaymentMethod, setDefaultPaymentMethod } from './payment-methods';

const posts = () => world.requests.filter((r) => r.kind === 'post').map((r) => ({ id: r.id, actions: r.actions }));

beforeEach(() => {
  world.requests = [];
  world.failNextPost = undefined;
  world.listStatus = undefined;
  world.records = [pm('A', { default: true }), pm('B'), pm('C')];
});

describe('listPaymentMethods', () => {
  it('asks for the active records of this customer only', async () => {
    await listPaymentMethods(CUSTOMER);
    expect(world.requests[0]?.where).toBe(`customer(id="${CUSTOMER}") and paymentMethodStatus="Active"`);
  });
  it('refuses a customer id that is not an id before any request (query-injection guard)', async () => {
    await expect(listPaymentMethods('x" or customer(id="y')).rejects.toThrow('Invalid customer id');
    expect(world.requests).toHaveLength(0);
  });
  it('never returns another customer record even if the platform did', async () => {
    world.records = [pm('A'), pm('Z', { customer: { typeId: 'customer', id: OTHER } })];
    expect((await listPaymentMethods(CUSTOMER)).map((r) => r.id)).toEqual(['A']);
  });
  it('maps 403 (missing scope) to PaymentMethodsForbiddenError', async () => {
    world.listStatus = 403;
    await expect(listPaymentMethods(CUSTOMER)).rejects.toBeInstanceOf(PaymentMethodsForbiddenError);
  });
});

describe('setDefaultPaymentMethod', () => {
  it('clears the previous default first and never touches the other records', async () => {
    await setDefaultPaymentMethod(CUSTOMER, 'C');
    expect(posts()).toEqual([
      { id: 'A', actions: [{ action: 'setDefault', default: false }] },
      { id: 'C', actions: [{ action: 'setDefault', default: true }] },
    ]);
    expect(world.records.filter((r) => r.default).map((r) => r.id)).toEqual(['C']);
  });
  it('sends nothing when the record already is the only default', async () => {
    await setDefaultPaymentMethod(CUSTOMER, 'A');
    expect(posts()).toEqual([]);
  });
  it('rejects a record that is not this customer own before any update', async () => {
    world.records = [pm('A'), pm('Z', { customer: { typeId: 'customer', id: OTHER } })];
    await expect(setDefaultPaymentMethod(CUSTOMER, 'Z')).rejects.toBeInstanceOf(PaymentMethodNotFoundError);
    expect(posts()).toEqual([]);
  });
  it('re-reads the record and retries once on a version conflict', async () => {
    world.failNextPost = 409;
    await setDefaultPaymentMethod(CUSTOMER, 'C');
    const sent = world.requests.filter((r) => r.kind === 'post');
    expect(sent.map((r) => [r.id, r.version])).toEqual([['A', 1], ['A', 2], ['C', 1]]);
    expect(world.requests.some((r) => r.kind === 'get' && r.id === 'A')).toBe(true);
  });
});

describe('removePaymentMethod', () => {
  it('Default method removed: setDefault false then Inactive and no other method promoted', async () => {
    await removePaymentMethod(CUSTOMER, 'A');
    expect(posts()).toEqual([{ id: 'A', actions: [{ action: 'setDefault', default: false }, { action: 'setPaymentMethodStatus', paymentMethodStatus: 'Inactive' }] }]);
    expect(world.records.filter((r) => r.default)).toEqual([]);
  });
  it('makes a non-default record Inactive without touching defaults', async () => {
    await removePaymentMethod(CUSTOMER, 'B');
    expect(posts()).toEqual([{ id: 'B', actions: [{ action: 'setPaymentMethodStatus', paymentMethodStatus: 'Inactive' }] }]);
  });
  it('rejects a foreign or unknown record before any update', async () => {
    world.records = [pm('A'), pm('Z', { customer: { typeId: 'customer', id: OTHER } })];
    await expect(removePaymentMethod(CUSTOMER, 'Z')).rejects.toBeInstanceOf(PaymentMethodNotFoundError);
    await expect(removePaymentMethod(CUSTOMER, 'nope')).rejects.toBeInstanceOf(PaymentMethodNotFoundError);
    expect(posts()).toEqual([]);
  });
});
