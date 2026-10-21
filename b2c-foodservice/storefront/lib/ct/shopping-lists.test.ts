// @vitest-environment node
import type { ShoppingList } from '@commercetools/platform-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn(), get: vi.fn(), post: vi.fn(), cart: vi.fn() }));
vi.mock('@/lib/env', () => ({ getEnv: () => ({}) }));
vi.mock('@/lib/ct/cart', () => ({
  ownsCart: (cart: { customerId?: string; anonymousId?: string }, s: { customerId?: string; anonymousId?: string }) =>
    Boolean(s.customerId && cart.customerId === s.customerId) || Boolean(s.anonymousId && cart.anonymousId === s.anonymousId),
}));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    shoppingLists: () => ({
      get: (a: unknown) => ({ execute: () => sdk.query(a) }),
      post: (a: unknown) => ({ execute: () => sdk.create(a) }),
      withId: () => ({
        get: () => ({ execute: () => sdk.get() }),
        post: (a: unknown) => ({ execute: () => sdk.post(a) }),
      }),
    }),
    carts: () => ({ withId: () => ({ get: () => ({ execute: () => sdk.cart() }) }) }),
  },
}));

import { ListFullError, MAX_LIST_LINES, addProducts, cartProductIds, ensureList, findList, removeProduct } from '@/lib/ct/shopping-lists';

const P1 = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e61';
const P2 = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e62';
const P3 = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e63';
const line = (id: string, productId: string) => ({ id, productId, addedAt: '2026-10-01T00:00:00.000Z', name: { 'en-US': `P ${id}` }, quantity: 1, published: true });
const list = (lines: unknown[] = [], over: Record<string, unknown> = {}): ShoppingList =>
  ({ id: 'sl1', version: 5, customer: { typeId: 'customer', id: 'c1' }, lineItems: lines, textLineItems: [], name: { 'en-US': 'Saved items' }, ...over }) as unknown as ShoppingList;
const posted = () => sdk.post.mock.calls.at(-1)?.[0].body;

beforeEach(() => {
  for (const f of Object.values(sdk)) f.mockReset();
  sdk.query.mockResolvedValue({ body: { results: [list([line('x1', P1)])] } });
  sdk.get.mockResolvedValue({ body: list([line('x1', P1)]) });
  sdk.post.mockImplementation(async () => ({ body: list() }));
});

describe('findList and ensureList', () => {
  it('finds the list by customer with a query variable and expands the variants', async () => {
    expect(await findList('c1')).not.toBeNull();
    expect(sdk.query.mock.calls[0][0].queryArgs).toMatchObject({ where: 'customer(id=:c)', 'var.c': 'c1', limit: 1, expand: ['lineItems[*].variant'] });
  });

  it("Other customer's list is 404: a list owned by someone else is not returned", async () => {
    sdk.query.mockResolvedValue({ body: { results: [list([], { customer: { typeId: 'customer', id: 'someone-else' } })] } });
    expect(await findList('c1')).toBeNull();
  });

  it('creates the list on first use: keyed by customer, named Saved items, no store', async () => {
    sdk.query.mockResolvedValue({ body: { results: [] } });
    sdk.create.mockResolvedValue({ body: list() });
    await ensureList('c1');
    const body = sdk.create.mock.calls[0][0].body;
    expect(body).toEqual({ name: { 'en-US': 'Saved items', 'en-CA': 'Saved items' }, key: 'mcf-saved-c1', customer: { typeId: 'customer', id: 'c1' } });
    expect(body).not.toHaveProperty('store');
  });

  it('a create that lost a race reads the winner', async () => {
    sdk.query.mockResolvedValueOnce({ body: { results: [] } }).mockResolvedValueOnce({ body: { results: [list()] } });
    sdk.create.mockRejectedValue({ statusCode: 400 });
    expect((await ensureList('c1')).id).toBe('sl1');
  });
});

describe('addProducts and removeProduct', () => {
  it('adds each product once, quantity 1, in one update', async () => {
    await addProducts('c1', [{ productId: P2 }, { productId: P3, variantId: 2 }]);
    expect(posted()).toEqual({
      version: 5,
      actions: [
        { action: 'addLineItem', productId: P2, quantity: 1 },
        { action: 'addLineItem', productId: P3, variantId: 2, quantity: 1 },
      ],
    });
  });

  it('Merge of guest saved ids ignores duplicates: saved, repeated and invalid ids add nothing', async () => {
    await addProducts('c1', [{ productId: P1 }, { productId: P2 }, { productId: P2 }, { productId: 'not-a-uuid' }]);
    expect(posted().actions).toEqual([{ action: 'addLineItem', productId: P2, quantity: 1 }]);
  });

  it('nothing new means no write', async () => {
    await addProducts('c1', [{ productId: P1 }]);
    expect(sdk.post).not.toHaveBeenCalled();
  });

  it('List over 250 lines is refused', async () => {
    sdk.get.mockResolvedValue({ body: list(Array.from({ length: MAX_LIST_LINES }, (_, i) => line(`l${i}`, `3f1c2a9e-7a1b-4c53-9d0e-${String(i).padStart(12, '0')}`))) });
    await expect(addProducts('c1', [{ productId: P3 }])).rejects.toBeInstanceOf(ListFullError);
    expect(sdk.post).not.toHaveBeenCalled();
  });

  it('a list that is not the customers is 404 before any write', async () => {
    sdk.get.mockResolvedValue({ body: list([], { customer: { typeId: 'customer', id: 'someone-else' } }) });
    await expect(addProducts('c1', [{ productId: P2 }])).rejects.toMatchObject({ status: 404 });
    expect(sdk.post).not.toHaveBeenCalled();
  });

  it('Remove: removeLineItem for every line of the product, nothing for an unknown product', async () => {
    sdk.get.mockResolvedValue({ body: list([line('x1', P1), line('x2', P1), line('x3', P2)]) });
    await removeProduct('c1', P1);
    expect(posted().actions).toEqual([{ action: 'removeLineItem', lineItemId: 'x1' }, { action: 'removeLineItem', lineItemId: 'x2' }]);
    sdk.post.mockClear();
    await removeProduct('c1', P3);
    expect(sdk.post).not.toHaveBeenCalled();
  });
});

describe('cartProductIds', () => {
  it('reads the distinct product ids of the session own active bag', async () => {
    sdk.cart.mockResolvedValue({ body: { cartState: 'Active', customerId: 'c1', lineItems: [{ productId: P1 }, { productId: P1 }, { productId: P2 }] } });
    expect(await cartProductIds({ customerId: 'c1', cartId: 'cart1' })).toEqual([P1, P2]);
  });

  it("someone else's bag, an ordered bag and no bag are empty", async () => {
    sdk.cart.mockResolvedValue({ body: { cartState: 'Active', customerId: 'other', lineItems: [{ productId: P1 }] } });
    expect(await cartProductIds({ customerId: 'c1', cartId: 'cart1' })).toEqual([]);
    sdk.cart.mockResolvedValue({ body: { cartState: 'Ordered', customerId: 'c1', lineItems: [{ productId: P1 }] } });
    expect(await cartProductIds({ customerId: 'c1', cartId: 'cart1' })).toEqual([]);
    expect(await cartProductIds({ customerId: 'c1' })).toEqual([]);
    sdk.cart.mockRejectedValue({ statusCode: 404 });
    expect(await cartProductIds({ customerId: 'c1', cartId: 'gone' })).toEqual([]);
  });
});
