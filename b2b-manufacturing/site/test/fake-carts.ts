/** The fields of a commercetools cart these tests touch. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a loose stand-in for the SDK cart, which tests cannot import (lint rule)
type Cart = any;

/** An in-memory commercetools carts endpoint for tests of the quote list: enough of the API to create, read, update and delete carts. */
export interface FakeCartsWorld {
  carts: Map<string, Cart>;
  /** Product ids that cannot be priced (the add fails with a 400 like the real API). */
  unpriceable: Set<string>;
  calls: Array<{ api: 'store' | 'associate'; op: string; body?: unknown; storeKey?: string }>;
  store: (storeKey: string) => unknown;
  associate: () => unknown;
  /** The root the mocked `apiRoot` exposes. */
  root: Record<string, unknown>;
}

const apiError = (statusCode: number, code = 'InvalidOperation') => Object.assign(new Error(code), { statusCode, body: { errors: [{ code }] } });

export function createFakeCarts(): FakeCartsWorld {
  const world = { carts: new Map<string, Cart>(), unpriceable: new Set<string>(), calls: [] } as unknown as FakeCartsWorld;
  let seq = 0;
  const makeLine = (d: { productId: string; variantId?: number; quantity?: number; custom?: { fields: Record<string, unknown> } }) => {
    if (world.unpriceable.has(d.productId)) throw apiError(400, 'MissingPriceForProduct');
    return { id: `li-${++seq}`, productId: d.productId, variant: { id: d.variantId ?? 1 }, name: { 'en-US': `Service ${d.productId}` }, productSlug: { 'en-US': `slug-${d.productId}` }, quantity: d.quantity ?? 1, ...(d.custom ? { custom: { fields: { ...d.custom.fields } } } : {}) };
  };
  const api = (kind: 'store' | 'associate', visible: (c: Cart) => boolean, storeKey?: string) => {
    const log = (op: string, body?: unknown) => world.calls.push({ api: kind, op, body, storeKey });
    return {
      get: (a: { queryArgs: { where?: string } }) => ({ execute: async () => { log('query', a.queryArgs); return { body: { results: [...world.carts.values()].filter((c) => visible(c) && c.cartState === 'Active').slice(-1) } }; } }),
      post: (a: { body: Record<string, unknown> }) => ({
        execute: async () => {
          log('create', a.body);
          const lineItems = ((a.body.lineItems as Array<Parameters<typeof makeLine>[0]>) ?? []).map(makeLine);
          const cart = { id: `cart-${++seq}`, version: 1, cartState: 'Active', totalPrice: { currencyCode: a.body.currency, centAmount: 0 }, lineItems, customLineItems: [], discountCodes: [], shippingMode: a.body.shippingMode, ...(a.body.businessUnit ? { businessUnit: a.body.businessUnit } : {}), ...(a.body.anonymousId ? { anonymousId: a.body.anonymousId } : {}), ...(a.body.customerId ? { customerId: a.body.customerId } : {}), country: a.body.country, locale: a.body.locale } as unknown as Cart;
          world.carts.set(cart.id, cart);
          return { body: cart };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => { log('read'); const c = world.carts.get(ID); if (!c || !visible(c)) throw apiError(404, 'ResourceNotFound'); return { body: c }; } }),
        delete: () => ({ execute: async () => { log('delete'); world.carts.delete(ID); return { body: {} as Cart }; } }),
        post: (a: { body: { version: number; actions: Array<Record<string, unknown>> } }) => ({
          execute: async () => {
            log('update', a.body.actions);
            const c = world.carts.get(ID);
            if (!c || !visible(c)) throw apiError(404, 'ResourceNotFound');
            if (c.version !== a.body.version) throw apiError(409, 'ConcurrentModification');
            const next = { ...c, lineItems: [...c.lineItems], customLineItems: [...c.customLineItems] } as unknown as { lineItems: Array<Record<string, unknown>>; customLineItems: unknown[]; version: number; shippingAddress?: unknown };
            const added: Array<Record<string, unknown>> = [];
            for (const action of a.body.actions) {
              if (action.action === 'addLineItem') added.push(makeLine(action as never) as never);
              if (action.action === 'removeLineItem') { const i = next.lineItems.findIndex((l) => l.id === action.lineItemId); if (i < 0) throw apiError(400); next.lineItems.splice(i, 1); }
              if (action.action === 'setLineItemCustomType') { const l = next.lineItems.find((x) => x.id === action.lineItemId); if (!l) throw apiError(400); if (action.fields && Object.keys(action.fields as object).length) l.custom = { fields: { ...(action.fields as object) } }; else delete l.custom; }
              if (action.action === 'setShippingAddress') next.shippingAddress = action.address;
              if (action.action === 'addCustomLineItem') next.customLineItems.push({ id: `cli-${++seq}`, ...action });
              if (action.action === 'removeDiscountCode') (next as unknown as { discountCodes: unknown[] }).discountCodes = [];
            }
            next.lineItems.push(...added);
            next.version += 1;
            world.carts.set(ID, next as unknown as Cart);
            return { body: next as unknown as Cart };
          },
        }),
      }),
    };
  };
  world.store = (storeKey) => api('store', () => true, storeKey);
  // The associate chain only sees carts that are in a Business Unit.
  world.associate = () => api('associate', (c) => Boolean(c.businessUnit));
  world.root = {
    inStoreKeyWithStoreKeyValue: ({ storeKey }: { storeKey: string }) => ({ carts: () => world.store(storeKey) }),
    asAssociate: () => ({ withAssociateIdValue: () => ({ inBusinessUnitKeyWithBusinessUnitKeyValue: () => ({ carts: () => world.associate() }) }) }),
  };
  return world;
}
