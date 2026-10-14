// Role matrix of workstream T (section 8): for every write route a Buyer of the store gets 403 and an Admin of the store gets 200 (or 201);
// reads work for both. Services are mocked, so a refused request must not reach them.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/request';
import { asUser, params } from '@/test/seller-routes';

vi.mock('@/lib/portal/seam', async () => (await import('@/test/seller-routes')).seamModule());
vi.mock('@/lib/ct/associate', async () => (await import('@/test/seller-routes')).associateModule());
const s = vi.hoisted(() => {
  const ok = () => vi.fn(async () => ({ ok: true, rows: [], total: 0, discounts: [] }));
  return {
    assortment: { listAssortment: ok(), getChain: ok(), assortmentImpact: ok(), resolveFilterIds: vi.fn(async () => ['p1']) },
    write: { assignProducts: ok(), withdrawProducts: ok(), reconcileAssortment: ok() },
    prices: { listPrices: ok(), publishPrices: ok(), previewBulk: ok(), publishBulk: ok(), previewChanges: ok() },
    tailoring: { listTailoring: ok(), getTailoringDetail: ok(), saveTailoring: ok(), resetTailoring: ok(), checkImageUrl: vi.fn(async (url: string) => ({ url, width: 800, height: 800 })) },
    discounts: { listDiscounts: ok(), getDiscount: ok(), createDiscount: ok(), createDiscountDraft: ok(), updateDiscount: ok(), setDiscountActive: ok(), deleteDiscount: ok(), reorderDiscounts: ok() },
    data: { listCategories: vi.fn(async () => []) },
  };
});
vi.mock('@/lib/ct/seller/assortment', () => s.assortment);
vi.mock('@/lib/ct/seller/assortment-write', () => s.write);
vi.mock('@/lib/ct/seller/prices', () => s.prices);
vi.mock('@/lib/ct/seller/tailoring', () => s.tailoring);
vi.mock('@/lib/ct/seller/discounts', () => s.discounts);
vi.mock('@/lib/ct/seller/catalog-data', () => s.data);

import * as assign from './assortment/assign/route';
import * as chain from './assortment/chain/route';
import * as impact from './assortment/impact/route';
import * as list from './assortment/route';
import * as reconcile from './assortment/reconcile/route';
import * as withdraw from './assortment/withdraw/route';
import * as categories from './catalog/categories/route';
import * as discountCart from './discounts/cart/route';
import * as discountItem from './discounts/[kind]/[id]/route';
import * as discountActive from './discounts/[kind]/[id]/active/route';
import * as discountPriority from './discounts/priority/route';
import * as discountProduct from './discounts/product/route';
import * as discounts from './discounts/route';
import * as priceBulk from './prices/bulk/route';
import * as priceImport from './prices/import/route';
import * as prices from './prices/route';
import * as tailoringList from './tailoring/route';
import * as tailoringItem from './tailoring/[productId]/route';
import * as tailoringReset from './tailoring/[productId]/reset/route';
import * as imageUrl from './tailoring/[productId]/image-url/route';

const A = 'store-a';
const body = (url: string, method: string, json: Record<string, unknown>) => () => makeRequest(url, { method, json: { storeKey: A, ...json } });
const query = (url: string, method = 'GET') => () => makeRequest(`${url}${url.includes('?') ? '&' : '?'}storeKey=${A}`, { method });
const kindId = params({ kind: 'cart', id: 'd1' });
const product = params({ productId: 'p1' });
const cartRule = { name: { 'en-US': 'Cart' }, condition: { kind: 'always' }, effect: { kind: 'relative', percent: 3 }, stacking: 'Stacking' };

const writes: [string, () => Promise<Response>][] = [
  ['POST assortment/impact', () => impact.POST(body('/api/seller/assortment/impact', 'POST', { productIds: ['p1'] })())],
  ['POST assortment/assign', () => assign.POST(body('/api/seller/assortment/assign', 'POST', { productIds: ['p1'] })())],
  ['POST assortment/withdraw', () => withdraw.POST(body('/api/seller/assortment/withdraw', 'POST', { productIds: ['p1'], confirm: true, expectedCount: 1 })())],
  ['POST assortment/reconcile', () => reconcile.POST(body('/api/seller/assortment/reconcile', 'POST', {})())],
  ['PUT prices', () => prices.PUT(body('/api/seller/prices', 'PUT', { changes: [{ sku: 'A-1', centAmount: 100 }], confirm: true, expectedCount: 1 })())],
  ['POST prices/bulk', () => priceBulk.POST(body('/api/seller/prices/bulk', 'POST', { mode: 'setTo', value: 100, skus: ['A-1'], dryRun: true })())],
  ['POST prices/import', () => priceImport.POST(body('/api/seller/prices/import', 'POST', { csv: 'A-1;1.00', dryRun: true })())],
  ['PUT tailoring/[id]', () => tailoringItem.PUT(body('/api/seller/tailoring/p1', 'PUT', { name: { 'de-DE': 'x' } })(), product)],
  ['POST tailoring/[id]/reset', () => tailoringReset.POST(body('/api/seller/tailoring/p1/reset', 'POST', {})(), product)],
  ['POST tailoring/[id]/image-url', () => imageUrl.POST(body('/api/seller/tailoring/p1/image-url', 'POST', { url: 'https://cdn.example/a.png' })(), product)],
  ['POST discounts/product', () => discountProduct.POST(body('/api/seller/discounts/product', 'POST', {})())],
  ['POST discounts/cart', () => discountCart.POST(body('/api/seller/discounts/cart', 'POST', {})())],
  ['PATCH discounts/[kind]/[id]', () => discountItem.PATCH(body('/api/seller/discounts/cart/d1', 'PATCH', { rule: cartRule })(), kindId)],
  ['DELETE discounts/[kind]/[id]', () => discountItem.DELETE(query('/api/seller/discounts/cart/d1', 'DELETE')(), kindId)],
  ['POST discounts/[kind]/[id]/active', () => discountActive.POST(body('/api/seller/discounts/cart/d1/active', 'POST', { isActive: false })(), kindId)],
  ['PUT discounts/priority', () => discountPriority.PUT(body('/api/seller/discounts/priority', 'PUT', { kind: 'product', orderedIds: [] })())],
];

const reads: [string, () => Promise<Response>][] = [
  ['GET assortment', () => list.GET(query('/api/seller/assortment')())],
  ['GET assortment/chain', () => chain.GET(query('/api/seller/assortment/chain')())],
  ['GET catalog/categories', () => categories.GET(query('/api/seller/catalog/categories')())],
  ['GET prices', () => prices.GET(query('/api/seller/prices')())],
  ['GET tailoring', () => tailoringList.GET(query('/api/seller/tailoring')())],
  ['GET tailoring/[id]', () => tailoringItem.GET(query('/api/seller/tailoring/p1')(), product)],
  ['GET discounts', () => discounts.GET(query('/api/seller/discounts?kind=product')())],
  ['GET discounts/[kind]/[id]', () => discountItem.GET(query('/api/seller/discounts/cart/d1')(), kindId)],
];

const everyService = () => [...Object.values(s.assortment), ...Object.values(s.write), ...Object.values(s.prices), ...Object.values(s.tailoring), ...Object.values(s.discounts), ...Object.values(s.data)];

beforeEach(() => {
  for (const fn of everyService()) fn.mockClear();
});

describe('role matrix: writes are Admin only', () => {
  it.each(writes)('%s: buyerA 403 (no service call), adminA 2xx', async (_name, call) => {
    asUser('buyerA');
    expect((await call()).status).toBe(403);
    for (const fn of everyService()) expect(fn).not.toHaveBeenCalled();
    asUser('adminA');
    expect([200, 201]).toContain((await call()).status);
  });

  it.each(writes)('%s: nobody signed in is 401', async (_name, call) => {
    asUser('nobody');
    expect((await call()).status).toBe(401);
    for (const fn of everyService()) expect(fn).not.toHaveBeenCalled();
  });
});

describe('role matrix: reads work for Buyer and Admin', () => {
  it.each(reads)('%s', async (_name, call) => {
    for (const who of ['buyerA', 'adminA'] as const) {
      asUser(who);
      expect((await call()).status).toBe(200);
    }
  });
});
