// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn() }));
vi.mock('@/lib/ct/shopping-lists', async (orig) => ({
  ...(await orig<typeof import('@/lib/ct/shopping-lists')>()),
  getSavedProductIds: vi.fn(),
  saveProduct: vi.fn(),
  unsaveProduct: vi.fn(),
  getSavedProducts: vi.fn(),
}));

import { GET, POST } from './route';
import { DELETE } from './[productId]/route';
import { GET as GET_PRODUCTS } from './products/route';
import { getSession } from '@/lib/session';
import { getSavedProductIds, getSavedProducts, saveProduct, unsaveProduct } from '@/lib/ct/shopping-lists';

const list = (...productIds: string[]) => ({ id: 'sl', version: 1, lineItems: productIds.map((productId, i) => ({ id: `li-${i}`, productId })) }) as never;
const post = (body: unknown) => new Request('http://localhost/api/account/wishlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const del = (productId: string) => DELETE(new Request('http://localhost/x', { method: 'DELETE' }), { params: Promise.resolve({ productId }) });
const signedIn = () => vi.mocked(getSession).mockResolvedValue({ customerId: 'c-1' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(getSession).mockResolvedValue({});
});

describe('anonymous visitors', () => {
  it('get 401 from every wishlist route and nothing is read or written', async () => {
    const responses = [await GET(), await POST(post({ productId: 'p-1' })), await del('p-1'), await GET_PRODUCTS(new Request('http://localhost/api/account/wishlist/products'))];
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    }
    expect(getSavedProductIds).not.toHaveBeenCalled();
    expect(saveProduct).not.toHaveBeenCalled();
    expect(unsaveProduct).not.toHaveBeenCalled();
    expect(getSavedProducts).not.toHaveBeenCalled();
  });
});

describe('signed-in customer', () => {
  beforeEach(signedIn);

  it('GET returns the saved ids for the session customer only', async () => {
    vi.mocked(getSavedProductIds).mockResolvedValue(['p-2', 'p-1']);
    const res = await GET();
    expect(await res.json()).toEqual({ productIds: ['p-2', 'p-1'] });
    expect(getSavedProductIds).toHaveBeenCalledWith('c-1');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('POST adds the product and returns the updated ids', async () => {
    vi.mocked(saveProduct).mockResolvedValue(list('p-1'));
    const res = await POST(post({ productId: 'p-1' }));
    expect(saveProduct).toHaveBeenCalledWith('c-1', 'p-1');
    expect(await res.json()).toEqual({ productIds: ['p-1'] });
  });

  it('POST without a product id is 400', async () => {
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ productId: 5 }))).status).toBe(400);
    expect(saveProduct).not.toHaveBeenCalled();
  });

  it('POST of an id commercetools rejects is 400, other failures 500', async () => {
    vi.mocked(saveProduct).mockRejectedValueOnce(Object.assign(new Error('bad'), { statusCode: 400 }));
    expect((await POST(post({ productId: 'nope' }))).status).toBe(400);
    vi.mocked(saveProduct).mockRejectedValueOnce(new Error('boom'));
    const res = await POST(post({ productId: 'p-1' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'WISHLIST_ERROR' });
  });

  it('DELETE removes the product and returns the remaining ids', async () => {
    vi.mocked(unsaveProduct).mockResolvedValue(list('p-2'));
    const res = await del('p-1');
    expect(unsaveProduct).toHaveBeenCalledWith('c-1', 'p-1');
    expect(await res.json()).toEqual({ productIds: ['p-2'] });
  });

  it('GET products uses the market of the ?locale= (D-012) and returns the products', async () => {
    vi.mocked(getSavedProducts).mockResolvedValue([{ id: 'p-1' }] as never);
    const res = await GET_PRODUCTS(new Request('http://localhost/api/account/wishlist/products?locale=de-DE'));
    expect(await res.json()).toEqual({ products: [{ id: 'p-1' }] });
    expect(getSavedProducts).toHaveBeenCalledWith('c-1', { country: 'DE', currency: 'EUR', locale: 'de-DE' });
  });
});
