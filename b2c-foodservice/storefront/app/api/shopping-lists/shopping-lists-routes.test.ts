// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const h = vi.hoisted(() => {
  class ListFullError extends Error {}
  return { addProducts: vi.fn(), removeProduct: vi.fn(), findList: vi.fn(), cartProductIds: vi.fn(), loadSavedList: vi.fn(), addAllToBag: vi.fn(), ListFullError };
});
vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name) } : undefined),
  }),
}));
vi.mock('@/lib/ct/shopping-lists', () => ({
  addProducts: h.addProducts, removeProduct: h.removeProduct, findList: h.findList, cartProductIds: h.cartProductIds,
  ListFullError: h.ListFullError, MAX_LIST_LINES: 250,
}));
vi.mock('@/lib/account/saved', () => ({ loadSavedList: h.loadSavedList, addAllToBag: h.addAllToBag }));

import { POST as ADD_ALL } from '@/app/api/shopping-lists/add-to-cart/route';
import { DELETE, GET, POST } from '@/app/api/shopping-lists/route';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from '@/lib/session';

const P1 = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e61';
const P2 = '3f1c2a9e-7a1b-4c53-9d0e-1a2b3c4d5e62';
const ctx = { params: Promise.resolve({}) };
const req = (method: string, body?: unknown, qs = '') =>
  new Request(`http://x/api/shopping-lists${qs}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

beforeEach(async () => {
  jar.store.clear();
  for (const f of Object.values(h)) if (typeof f === 'function' && 'mockReset' in f) (f as ReturnType<typeof vi.fn>).mockReset();
  jar.store.set(SESSION_COOKIE, await createSessionToken({ customerId: 'c1', cartId: 'cart-1' }));
  h.loadSavedList.mockResolvedValue({ id: 'sl1', version: 2, items: [] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/shopping-lists', () => {
  it('401 with no detail on every verb', async () => {
    jar.store.clear();
    for (const res of [await GET(req('GET'), ctx), await POST(req('POST', {}), ctx), await DELETE(req('DELETE', undefined, `?productId=${P1}`), ctx), await ADD_ALL(req('POST'), ctx)]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'Sign in required' } });
    }
  });

  it('GET answers the session customer list, with products unless view=ids', async () => {
    await GET(req('GET'), ctx);
    expect(h.loadSavedList).toHaveBeenLastCalledWith('c1', expect.anything(), expect.anything(), { withProducts: true });
    await GET(req('GET', undefined, '?view=ids'), ctx);
    expect(h.loadSavedList).toHaveBeenLastCalledWith('c1', expect.anything(), expect.anything(), { withProducts: false });
  });

  it('No lists yet: GET answers { list: null }', async () => {
    h.loadSavedList.mockResolvedValue(null);
    expect(await (await GET(req('GET'), ctx)).json()).toEqual({ list: null });
  });

  it('POST saves one product (with a variant)', async () => {
    const res = await POST(req('POST', { productId: P1, variantId: 2 }), ctx);
    expect(res.status).toBe(200);
    expect(h.addProducts).toHaveBeenCalledWith('c1', [{ productId: P1, variantId: 2 }]);
  });

  it('Merge of guest saved ids ignores duplicates and invalid ids', async () => {
    await POST(req('POST', { merge: [P1, P2, P1, 'junk', 42] }), ctx);
    expect(h.addProducts).toHaveBeenCalledWith('c1', [{ productId: P1 }, { productId: P2 }]);
  });

  it('fromCart saves the bag products only while the list is empty', async () => {
    h.findList.mockResolvedValue(null);
    h.cartProductIds.mockResolvedValue([P1, P2]);
    expect((await POST(req('POST', { fromCart: true }), ctx)).status).toBe(200);
    expect(h.addProducts).toHaveBeenCalledWith('c1', [{ productId: P1 }, { productId: P2 }]);
    h.addProducts.mockClear();
    h.findList.mockResolvedValue({ lineItems: [{}] });
    expect((await POST(req('POST', { fromCart: true }), ctx)).status).toBe(422);
    expect(h.addProducts).not.toHaveBeenCalled();
  });

  it.each([{ productId: 'junk' }, { productId: P1, variantId: 0 }, { productId: P1, variantId: 'x' }, {}])('refuses %j with 422', async (body) => {
    const res = await POST(req('POST', body), ctx);
    expect(res.status).toBe(422);
    expect(h.addProducts).not.toHaveBeenCalled();
  });

  it('List over 250 lines is refused with 409 list_full', async () => {
    h.addProducts.mockRejectedValue(new h.ListFullError());
    const res = await POST(req('POST', { productId: P1 }), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('list_full');
  });

  it('DELETE removes by product id and refuses a bad one', async () => {
    expect((await DELETE(req('DELETE', undefined, `?productId=${P1}`), ctx)).status).toBe(200);
    expect(h.removeProduct).toHaveBeenCalledWith('c1', P1);
    expect((await DELETE(req('DELETE', undefined, '?productId=junk'), ctx)).status).toBe(422);
  });

  it('add-to-cart answers added and skipped, writes the new cart id and 409 list_empty for nothing saved', async () => {
    h.addAllToBag.mockResolvedValueOnce({
      result: { added: [{ sku: 'A', name: 'A', quantity: 1, fulfilment: 'delivery' }], skipped: [{ productId: P2, name: 'B', reason: 'out_of_stock' }], cart: { id: 'new', version: 1, count: 1, lines: [] } },
      session: { customerId: 'c1', cartId: 'new' },
    });
    const res = await ADD_ALL(req('POST'), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toEqual([{ productId: P2, name: 'B', reason: 'out_of_stock' }]);
    const token = /malva-session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
    expect((await verifySessionToken(token)).cartId).toBe('new');
    h.addAllToBag.mockResolvedValueOnce(null);
    const empty = await ADD_ALL(req('POST'), ctx);
    expect(empty.status).toBe(409);
    expect((await empty.json()).error.code).toBe('list_empty');
  });
});
