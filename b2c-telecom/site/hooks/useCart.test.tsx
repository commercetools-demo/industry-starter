import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import type { Cart } from '@/lib/types';
import { CartError, useCart, useCartMutations } from './useCart';

const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const cartWith = (patch: Partial<Cart> = {}): Cart =>
  ({
    id: 'c1',
    version: 1,
    currencyCode: 'USD',
    country: 'US',
    lines: [],
    itemCount: 0,
    summary: { plans: money(0), addons: money(0), devicesMonthly: money(0), monthly: money(0), oneTime: money(0), discountTotal: money(0), tax: null, total: money(0) },
    discountCodes: [],
    minimumOrder: null,
    issues: [],
    canCheckout: false,
    checkoutBlockedBy: ['EMPTY'],
    postalCode: null,
    ...patch,
  }) as Cart;

const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

function useBoth() {
  return { cart: useCart(), mutations: useCartMutations() };
}

afterEach(() => vi.unstubAllGlobals());

describe('useCart', () => {
  it('default: no cart yet is null and the count is 0', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(200, { cart: null })));
    const { result } = renderHook(useCart, { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cart).toBeNull();
    expect(result.current.itemCount).toBe(0);
  });

  it('reads the server count', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(200, { cart: cartWith({ itemCount: 2 }) })));
    const { result } = renderHook(useCart, { wrapper });
    await waitFor(() => expect(result.current.itemCount).toBe(2));
  });
});

describe('useCartMutations', () => {
  it('Quantity changed: cache replaced with server cart, no client arithmetic', async () => {
    const serverCart = cartWith({ version: 5, itemCount: 1, summary: { ...cartWith().summary, total: money(16500) } });
    const fetchMock = vi.fn((url: string) => (url === '/api/cart' ? reply(200, { cart: cartWith({ version: 4 }) }) : reply(200, { cart: serverCart })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useBoth, { wrapper });
    await waitFor(() => expect(result.current.cart.cart?.version).toBe(4));
    const readsBefore = fetchMock.mock.calls.filter(([url]) => url === '/api/cart').length;
    await act(async () => {
      await result.current.mutations.setQuantity('line-1', 3);
    });
    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
    expect(url).toBe('/api/cart/line-items/line-1');
    expect(init).toMatchObject({ method: 'PATCH', body: JSON.stringify({ quantity: 3 }) });
    await waitFor(() => expect(result.current.cart.cart?.summary.total.centAmount).toBe(16500));
    expect(result.current.cart.cart?.version).toBe(5);
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/cart').length).toBe(readsBefore);
  });

  it('an error response with a cart still updates the cache and throws a CartError with details', async () => {
    const unchanged = cartWith({ version: 7, itemCount: 1 });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/cart'
          ? reply(200, { cart: cartWith({ version: 6 }) })
          : reply(409, { error: { code: 'OFFER_BLOCKED', message: 'blocked', details: { kind: 'incompatible', offerKey: 'o', reasons: [] } }, cart: unchanged }),
      ),
    );
    const { result } = renderHook(useBoth, { wrapper });
    await waitFor(() => expect(result.current.cart.cart?.version).toBe(6));
    let caught: unknown;
    await act(async () => {
      caught = await result.current.mutations.addLine({ offerKey: 'o', sku: 's' }).catch((e: unknown) => e);
    });
    expect(caught).toBeInstanceOf(CartError);
    expect(caught).toMatchObject({ bundleCode: 'OFFER_BLOCKED', code: 'CONFLICT', httpStatus: 409 });
    expect((caught as CartError).blocked).toMatchObject({ kind: 'incompatible' });
    await waitFor(() => expect(result.current.cart.cart?.version).toBe(7));
  });

  it('builds the URLs of every mutation', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => (void url, void init, reply(200, { cart: null })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useCartMutations, { wrapper });
    await act(async () => {
      await result.current.removeLine('a b', { cascade: true });
      await result.current.applyCode('MALVA-CABLE5');
      await result.current.removeCode('MALVA-CABLE5');
      await result.current.setPostalCode('10001');
    });
    expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      'DELETE /api/cart/line-items/a%20b?cascade=true',
      'POST /api/cart/discount-code',
      'DELETE /api/cart/discount-code?code=MALVA-CABLE5',
      'POST /api/cart/address',
    ]);
  });

  it('a network failure throws a CartError that is not a refusal', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    const { result } = renderHook(useCartMutations, { wrapper });
    await expect(result.current.addLine({ offerKey: 'o', sku: 's' })).rejects.toMatchObject({ bundleCode: 'NETWORK', code: 'UPSTREAM_ERROR' });
  });
});
