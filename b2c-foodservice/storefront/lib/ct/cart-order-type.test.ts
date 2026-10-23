// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ct = vi.hoisted(() => ({
  carts: new Map<string, Record<string, unknown>>(),
  created: [] as Record<string, unknown>[],
  updates: [] as { id: string; actions: Record<string, unknown>[] }[],
  typeMissing: false,
  n: 0,
}));

vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    types: () => ({
      withKey: () => ({
        get: () => ({
          execute: async () => {
            if (ct.typeMissing) throw Object.assign(new Error('nf'), { statusCode: 404 });
            return { body: { id: 'type-1' } };
          },
        }),
      }),
    }),
    carts: () => ({
      post: ({ body }: { body: Record<string, unknown> }) => ({
        execute: async () => {
          ct.n += 1;
          const cart = { id: `cart-${ct.n}`, version: 1, cartState: 'Active', lineItems: [], totalPrice: { centAmount: 0, currencyCode: body.currency }, ...body };
          ct.carts.set(cart.id as string, cart);
          ct.created.push(body);
          return { body: cart };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => ({ body: ct.carts.get(ID) }) }),
        post: ({ body }: { body: { version: number; actions: Record<string, unknown>[] } }) => ({
          execute: async () => {
            ct.updates.push({ id: ID, actions: body.actions });
            const c = ct.carts.get(ID) as { version: number; lineItems: unknown[]; custom?: unknown };
            let custom = c.custom;
            let lines = c.lineItems;
            for (const a of body.actions) {
              if (a.action === 'setCustomType') custom = { type: { typeId: 'type', id: 'type-1' }, fields: a.fields };
              if (a.action === 'setCustomField') custom = { ...(custom as object), fields: { orderType: a.value } };
              if (a.action === 'addLineItem') {
                lines = [...lines, { id: `li-${lines.length + 1}`, quantity: a.quantity, variant: { sku: a.sku }, productId: 'p-1', name: { 'en-US': 'x' }, productSlug: { 'en-US': 'x' }, price: { value: { centAmount: 100, currencyCode: 'USD' } }, totalPrice: { centAmount: 100, currencyCode: 'USD' } }];
              }
            }
            const next = { ...c, version: c.version + 1, lineItems: lines, ...(custom ? { custom } : {}) };
            ct.carts.set(ID, next);
            return { body: next };
          },
        }),
      }),
    }),
  },
}));
vi.mock('@/lib/ct/cart-enrich', async () => ({ getCartEnrichment: async () => (await import('@/lib/mappers/cart')).EMPTY_ENRICHMENT }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));

import { addLine, getCartView, rebuildCart } from './cart';
import { resetOrderTypeCache } from './order-type';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const input = { sku: 'MCF-POD-EMBER-10', quantity: 1, fulfilment: 'delivery' as const };
const MINE = { type: { typeId: 'type', key: 'instore-order-type' }, fields: { orderType: 'in-store-purchase' } };
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  ct.carts.clear();
  ct.created = [];
  ct.updates = [];
  ct.typeMissing = false;
  resetOrderTypeCache();
  vi.stubEnv('APP_MODE', 'instore');
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
});

describe('The cart carries the order type in the In-store companion (D-042)', () => {
  it('a cart created by the first add has the custom type fields in its draft', async () => {
    const { session } = await addLine({ anonymousId: 'a1' }, market, input);
    expect(ct.created).toHaveLength(1);
    expect(ct.created[0]?.custom).toEqual(MINE);
    // the existing cart already has it: the second add is one action
    await addLine(session, market, input);
    expect(ct.updates.at(-1)?.actions.map((a) => a.action)).toEqual(['addLineItem']);
  });

  it('an existing cart without the field gets setCustomType in the same update as the line', async () => {
    ct.carts.set('cart-old', { id: 'cart-old', version: 4, cartState: 'Active', lineItems: [], totalPrice: { centAmount: 0, currencyCode: 'USD' }, anonymousId: 'a1' });
    await addLine({ anonymousId: 'a1', cartId: 'cart-old' }, market, input);
    const actions = ct.updates[0]?.actions ?? [];
    expect(actions.map((a) => a.action)).toEqual(['addLineItem', 'setCustomType']);
    expect(actions[1]).toMatchObject({ type: MINE.type, fields: MINE.fields });
    expect((ct.carts.get('cart-old') as { custom: { fields: unknown } }).custom.fields).toEqual(MINE.fields);
  });

  it('a cart with our type and another value gets setCustomField', async () => {
    ct.carts.set('cart-old', {
      id: 'cart-old', version: 4, cartState: 'Active', lineItems: [], totalPrice: { centAmount: 0, currencyCode: 'USD' }, anonymousId: 'a1',
      custom: { type: { typeId: 'type', id: 'type-1' }, fields: { orderType: 'online' } },
    });
    await addLine({ anonymousId: 'a1', cartId: 'cart-old' }, market, input);
    expect(ct.updates[0]?.actions.map((a) => a.action)).toEqual(['addLineItem', 'setCustomField']);
  });

  it('reading a cart that predates the type tags it, and a second read does not write again', async () => {
    ct.carts.set('cart-old', { id: 'cart-old', version: 4, cartState: 'Active', lineItems: [], totalPrice: { centAmount: 0, currencyCode: 'USD' }, anonymousId: 'a1', shippingMode: 'Single' });
    const session = { anonymousId: 'a1', cartId: 'cart-old' };
    await getCartView(session, market);
    expect(ct.updates).toHaveLength(1);
    expect(ct.updates[0]?.actions[0]).toMatchObject({ action: 'setCustomType' });
    await getCartView(session, market);
    expect(ct.updates).toHaveLength(1);
  });

  it('the cart rebuilt on a market switch is born with the field', async () => {
    const old = { id: 'cart-old', version: 2, cartState: 'Active', lineItems: [], totalPrice: { centAmount: 0, currencyCode: 'USD' }, anonymousId: 'a1', country: 'US', discountCodes: [] };
    ct.carts.set('cart-old', old);
    await rebuildCart({ anonymousId: 'a1', cartId: 'cart-old' }, old as never, { country: 'CA', currency: 'CAD', locale: 'en-CA' });
    expect(ct.created[0]?.custom).toEqual(MINE);
  });

  it('Type missing: adding to the bag still works, logs once and sets nothing', async () => {
    ct.typeMissing = true;
    const first = await addLine({ anonymousId: 'a1' }, market, input);
    await addLine(first.session, market, input);
    expect(ct.created[0]?.custom).toBeUndefined();
    expect(ct.updates.every((u) => u.actions.every((a) => a.action === 'addLineItem'))).toBe(true);
    const logged = warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('instore_order_type_missing'));
    expect(logged).toHaveLength(1);
  });

  it('the website never sets it', async () => {
    vi.stubEnv('APP_MODE', 'website');
    const { session } = await addLine({ anonymousId: 'a1' }, market, input);
    await addLine(session, market, input);
    expect(ct.created[0]?.custom).toBeUndefined();
    expect(ct.updates.flatMap((u) => u.actions.map((a) => a.action))).toEqual(['addLineItem', 'addLineItem']);
  });
});
