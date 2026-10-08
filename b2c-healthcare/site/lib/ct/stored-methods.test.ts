import { beforeEach, describe, expect, it } from 'vitest';
import { StoredMethodNotFoundError } from '@/lib/checkout/payment-provider';
import { listStored, mapDescriptor, removeStored, setDefaultStored } from './stored-methods';

const TOKEN = 'tok_SECRET_do_not_render_1234567890';

interface Pm {
  id: string;
  version: number;
  customer?: { id: string };
  paymentMethodStatus: string;
  default: boolean;
  name?: Record<string, string>;
  token: { value: string };
  custom?: { fields: Record<string, unknown> };
  createdAt: string;
}

let store: Pm[];
let calls: { op: string; id?: string; actions?: unknown; version?: number }[];
let seq: number;

const err = (statusCode: number) => Object.assign(new Error(String(statusCode)), { statusCode });
const pm = (over: Partial<Pm> = {}): Pm => {
  seq += 1;
  return { id: `pm${seq}`, version: 1, customer: { id: 'c1' }, paymentMethodStatus: 'Active', default: false, token: { value: TOKEN }, custom: { fields: { brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2030 } }, createdAt: `2026-10-0${seq}T00:00:00Z`, ...over };
};

// A fake `apiRoot.paymentMethods()`: only what stored-methods.ts calls.
const root = {
  paymentMethods: () => ({
    get: (a: { queryArgs: Record<string, unknown> }) => ({
      execute: async () => {
        calls.push({ op: 'query' });
        const id = a.queryArgs['var.id'];
        return { body: { results: structuredClone(store.filter((p) => p.customer?.id === id && p.paymentMethodStatus === 'Active')) } };
      },
    }),
    withId: ({ ID }: { ID: string }) => ({
      get: () => ({
        execute: async () => {
          const p = store.find((x) => x.id === ID);
          if (!p) throw err(404);
          return { body: structuredClone(p) };
        },
      }),
      post: (a: { body: { version: number; actions: { action: string; default: boolean }[] } }) => ({
        execute: async () => {
          const p = store.find((x) => x.id === ID);
          if (!p) throw err(404);
          if (a.body.version !== p.version) throw err(409);
          calls.push({ op: 'update', id: ID, actions: a.body.actions });
          for (const action of a.body.actions) if (action.action === 'setDefault') p.default = action.default;
          p.version += 1;
          return { body: structuredClone(p) };
        },
      }),
      delete: (a: { queryArgs: { version: number } }) => ({
        execute: async () => {
          const p = store.find((x) => x.id === ID);
          if (!p) throw err(404);
          if (a.queryArgs.version !== p.version) throw err(409);
          calls.push({ op: 'delete', id: ID, version: a.queryArgs.version });
          store = store.filter((x) => x !== p);
          return { body: p };
        },
      }),
    }),
  }),
} as never;

beforeEach(() => {
  store = [];
  calls = [];
  seq = 0;
});

describe('payment-methods › Card tokenized then listed', () => {
  it('the card is listed by brand, last four digits, expiry and default flag; the provider token appears nowhere in the result', async () => {
    store.push(pm({ default: true }));
    const list = await listStored('c1', root);
    expect(list).toEqual([{ id: 'pm1', brand: 'Visa', last4: '4242', expMonth: 12, expYear: 2030, isDefault: true }]);
    expect(JSON.stringify(list)).not.toContain(TOKEN);
    expect(JSON.stringify(list)).not.toContain('token');
  });

  it('only the descriptor fields are ever copied: an unexpected field (a PAN-like value, a token) cannot leak through the mapper', () => {
    const d = mapDescriptor({ ...pm(), custom: { fields: { brand: 'Visa', last4: '4242', pan: '4242424242424242', cvc: '123', token: TOKEN } } } as never);
    expect(Object.keys(d).sort()).toEqual(['brand', 'expMonth', 'expYear', 'id', 'isDefault', 'last4']);
    expect(JSON.stringify(d)).not.toMatch(/4242424242424242|123"|SECRET/);
  });

  it('falls back to the display name when the connector keeps no custom fields ("Visa ending 4242", "Visa •••• 4242")', () => {
    for (const name of ['Visa ending 4242', 'Visa •••• 4242', 'Visa 4242']) {
      expect(mapDescriptor(pm({ custom: undefined, name: { 'en-US': name } }) as never)).toMatchObject({ brand: 'Visa', last4: '4242' });
    }
    expect(mapDescriptor(pm({ custom: undefined, name: undefined }) as never)).toMatchObject({ brand: 'Card', last4: '' });
  });

  it('a last4 that is not four digits is dropped, never shown', () => {
    expect(mapDescriptor(pm({ custom: { fields: { brand: 'Visa', last4: '4242424242424242' } } }) as never).last4).toBe('');
  });

  it('lists only the customer\'s own Active methods, the default first', async () => {
    store.push(pm(), pm({ default: true }), pm({ customer: { id: 'c2' } }), pm({ paymentMethodStatus: 'Inactive' }));
    expect((await listStored('c1', root)).map((m) => [m.id, m.isDefault])).toEqual([['pm2', true], ['pm1', false]]);
  });
});

describe('payment-methods: set default clears the previous default explicitly', () => {
  it('after setting one, exactly one is default and the previous default got an explicit setDefault false', async () => {
    store.push(pm({ default: true }), pm(), pm());
    await setDefaultStored('c1', 'pm3', root);
    expect(store.map((p) => p.default)).toEqual([false, false, true]);
    const updates = calls.filter((c) => c.op === 'update');
    expect(updates).toEqual([
      { op: 'update', id: 'pm1', actions: [{ action: 'setDefault', default: false }] },
      { op: 'update', id: 'pm3', actions: [{ action: 'setDefault', default: true }] },
    ]);
  });

  it('setting the one that is already default writes nothing', async () => {
    store.push(pm({ default: true }), pm());
    await setDefaultStored('c1', 'pm1', root);
    expect(calls.filter((c) => c.op === 'update')).toEqual([]);
  });

  it('a version conflict is retried once with the fresh version', async () => {
    store.push(pm());
    const first = store[0] as Pm;
    const realRoot = root as unknown as { paymentMethods: () => { withId: (i: { ID: string }) => { post: (a: unknown) => unknown } } };
    let bumped = false;
    const original = realRoot.paymentMethods;
    realRoot.paymentMethods = () => {
      const base = original();
      return { ...base, withId: (i: { ID: string }) => ({ ...base.withId(i), post: (a: { body: { version: number } }) => {
        if (!bumped) { bumped = true; first.version += 1; }
        return base.withId(i).post(a);
      } }) } as never;
    };
    await setDefaultStored('c1', 'pm1', root);
    realRoot.paymentMethods = original;
    expect(first.default).toBe(true);
  });

  it('somebody else\'s method, an unknown id and a malformed id are the same StoredMethodNotFoundError', async () => {
    store.push(pm({ customer: { id: 'c2' } }), pm());
    for (const id of ['pm1', 'nope', '../x', 'pm9']) {
      await expect(setDefaultStored('c1', id, root)).rejects.toBeInstanceOf(StoredMethodNotFoundError);
      await expect(removeStored('c1', id, root)).rejects.toBeInstanceOf(StoredMethodNotFoundError);
    }
    expect(store.map((p) => p.default)).toEqual([false, false]);
    expect(calls.filter((c) => c.op !== 'query')).toEqual([]);
  });
});

describe('payment-methods › Default method removed', () => {
  it('removes with the current version and leaves NO default: another method is not promoted silently', async () => {
    store.push(pm({ default: true }), pm());
    await removeStored('c1', 'pm1', root);
    expect(calls.find((c) => c.op === 'delete')).toEqual({ op: 'delete', id: 'pm1', version: 1 });
    expect((await listStored('c1', root)).map((m) => m.isDefault)).toEqual([false]);
    expect(store.some((p) => p.default)).toBe(false);
  });

  it('removing the same method twice: the second is the not-found answer', async () => {
    store.push(pm());
    await removeStored('c1', 'pm1', root);
    await expect(removeStored('c1', 'pm1', root)).rejects.toBeInstanceOf(StoredMethodNotFoundError);
  });
});
