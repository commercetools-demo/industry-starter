// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  class LineRejected extends Error {
    constructor(readonly code: string, readonly status: number, readonly extra: Record<string, number | string> = {}) {
      super(code);
    }
  }
  return {
    LineRejected, addLine: vi.fn(), getCartForSession: vi.fn(), getInventoryDetail: vi.fn(),
    findList: vi.fn(), getListingProjections: vi.fn(), getCategoryTree: vi.fn(), getStoresForCountry: vi.fn(),
  };
});
vi.mock('@/lib/ct/cart', () => ({ LineRejected: h.LineRejected, addLine: h.addLine, getCartForSession: h.getCartForSession }));
vi.mock('@/lib/ct/inventory', () => ({ getInventoryDetail: h.getInventoryDetail }));
vi.mock('@/lib/ct/shopping-lists', () => ({ findList: h.findList }));
vi.mock('@/lib/ct/products', () => ({ getListingProjections: h.getListingProjections }));
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: h.getCategoryTree }));
vi.mock('@/lib/ct/channels', () => ({ getStoresForCountry: h.getStoresForCountry }));

import { addAllToBag, loadSavedList } from '@/lib/account/saved';
import { AppError } from '@/lib/errors';
import type { Session } from '@/lib/session';
import type { ProductSummary } from '@/lib/types';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const session: Session = { customerId: 'c1', cartId: 'cart-old' };
const pid = (n: number) => `3f1c2a9e-7a1b-4c53-9d0e-${String(n).padStart(12, '0')}`;
const card = (n: number, over: Partial<ProductSummary> = {}): ProductSummary =>
  ({
    id: pid(n), slug: `p${n}`, sku: `SKU-${n}`, name: `Product ${n}`, categoryName: 'Pods', imageAlt: '', badge: null,
    price: { from: { centAmount: 1000 + n, currencyCode: 'USD' }, fromIsRange: false }, requiredChoice: null, rating: null, availability: null, ...over,
  }) as ProductSummary;
const line = (n: number, over: Record<string, unknown> = {}) => ({
  id: `l${n}`, productId: pid(n), addedAt: `2026-10-${String((n % 28) + 1).padStart(2, '0')}T00:00:00.000Z`, name: { 'en-US': `Saved ${n}` }, quantity: 1, published: true,
  variant: { id: 1, sku: `SKU-${n}` }, ...over,
});
const list = (lines: unknown[]) => ({ id: 'sl1', version: 3, customer: { typeId: 'customer', id: 'c1' }, lineItems: lines });

beforeEach(() => {
  for (const f of [h.addLine, h.getCartForSession, h.getInventoryDetail, h.findList, h.getListingProjections, h.getCategoryTree, h.getStoresForCountry]) f.mockReset();
  h.getCategoryTree.mockResolvedValue([]);
  h.getStoresForCountry.mockResolvedValue([]);
  h.getInventoryDetail.mockImplementation(async (skus: string[]) => Object.fromEntries(skus.map((s) => [s, { online: 50, stores: {} }])));
  h.addLine.mockImplementation(async (s: Session) => ({ cart: { id: 'cart-1', version: 2, count: 1, lines: [] }, session: { ...s, cartId: 'cart-1' } }));
  h.getListingProjections.mockImplementation(async (ids: string[]) => ids.map((id) => card(Number(id.slice(-12)))));
});

describe('loadSavedList', () => {
  it('List prices come from the product read, not the list: the cards carry the market price', async () => {
    h.findList.mockResolvedValue(list([line(1), line(2)]));
    const out = await loadSavedList('c1', session, market, { withProducts: true });
    expect(h.getListingProjections).toHaveBeenCalledWith([pid(1), pid(2)], expect.objectContaining({ currency: 'USD', country: 'US', locale: 'en-US' }));
    expect(out?.items.map((i) => i.product?.price?.from.centAmount).sort()).toEqual([1001, 1002]);
    expect(JSON.stringify(list([line(1)]))).not.toContain('price');
  });

  it('the ids view makes no product read', async () => {
    h.findList.mockResolvedValue(list([line(1)]));
    const out = await loadSavedList('c1', session, market, { withProducts: false });
    expect(h.getListingProjections).not.toHaveBeenCalled();
    expect(out?.items[0]).toMatchObject({ productId: pid(1), product: null, name: 'Saved 1' });
  });

  it('No lists yet: null, and nothing is created by a read', async () => {
    h.findList.mockResolvedValue(null);
    expect(await loadSavedList('c1', session, market, { withProducts: true })).toBeNull();
  });

  it('lines are newest first and a product that is gone has no card', async () => {
    h.findList.mockResolvedValue(list([line(1, { addedAt: '2026-10-01T00:00:00.000Z' }), line(2, { addedAt: '2026-10-05T00:00:00.000Z' })]));
    h.getListingProjections.mockResolvedValue([card(2)]);
    const out = await loadSavedList('c1', session, market, { withProducts: true });
    expect(out?.items.map((i) => [i.productId, i.product?.id ?? null])).toEqual([[pid(2), pid(2)], [pid(1), null]]);
  });
});

describe('addAllToBag', () => {
  it('List converted in one operation: twelve lines all added, the list is not written', async () => {
    h.findList.mockResolvedValue(list(Array.from({ length: 12 }, (_, i) => line(i + 1))));
    const out = await addAllToBag('c1', session, market);
    expect(out?.result.added).toHaveLength(12);
    expect(out?.result.skipped).toEqual([]);
    expect(h.addLine).toHaveBeenCalledTimes(12);
    expect(h.addLine.mock.calls.every((c) => c[2].fulfilment === 'delivery' && c[2].quantity === 1)).toBe(true);
    expect(h.addLine.mock.calls[0][0].cartId).toBe('cart-old');
    expect(out?.session.cartId).toBe('cart-1');
  });

  it('Line no longer purchasable: the others are added and the excluded one is named with its reason', async () => {
    h.findList.mockResolvedValue(list([line(1), line(2), line(3)]));
    h.addLine.mockImplementation(async (s: Session, _m: unknown, input: { sku: string }) => {
      if (input.sku === 'SKU-2') throw new AppError('not_found', 404);
      return { cart: { id: 'c', version: 1, count: 1, lines: [] }, session: s };
    });
    h.getListingProjections.mockResolvedValue([card(1), card(2), card(3)]);
    const out = await addAllToBag('c1', session, market);
    expect(out?.result.added.map((a) => a.sku)).toEqual(['SKU-1', 'SKU-3']);
    expect(out?.result.skipped).toEqual([{ productId: pid(2), name: 'Product 2', reason: 'not_found' }]);
  });

  it('an unpublished or vanished product is skipped without a call', async () => {
    h.findList.mockResolvedValue(list([line(1), line(2, { published: false }), line(3)]));
    h.getListingProjections.mockResolvedValue([card(1), card(2)]);
    const out = await addAllToBag('c1', session, market);
    expect(out?.result.added.map((a) => a.sku)).toEqual(['SKU-1']);
    expect(out?.result.skipped.map((s) => [s.productId, s.reason])).toEqual([[pid(2), 'unavailable'], [pid(3), 'not_found'], ]);
  });

  it('out of stock online is skipped with the reason', async () => {
    h.findList.mockResolvedValue(list([line(1)]));
    h.getInventoryDetail.mockResolvedValue({ 'SKU-1': { online: 0, stores: {} } });
    const out = await addAllToBag('c1', session, market);
    expect(out?.result.skipped).toEqual([{ productId: pid(1), name: 'Product 1', reason: 'out_of_stock' }]);
  });

  it('No lists yet or an empty list: null (the route answers 409 list_empty)', async () => {
    h.findList.mockResolvedValue(null);
    expect(await addAllToBag('c1', session, market)).toBeNull();
    h.findList.mockResolvedValue(list([]));
    expect(await addAllToBag('c1', session, market)).toBeNull();
  });
});
