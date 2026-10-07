import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import type { Cart } from '@/lib/types';
import { CartError, useCart } from './useCart';
import { useDeviceActions } from './useDeviceActions';

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
const useBoth = () => ({ cart: useCart(), actions: useDeviceActions() });
const ADD = { offerKey: 'malva-offer-phone-nova-pro', sku: 'MLV-DEV-NOVAPRO-BLK-256', quantity: 1, mode: 'installments', termMonths: 24 } as const;

afterEach(() => vi.unstubAllGlobals());

describe('useDeviceActions', () => {
  it('writes the cart of the answer into the cart cache, with no client arithmetic and no refetch', async () => {
    const serverCart = cartWith({ version: 2, itemCount: 1, summary: { ...cartWith().summary, total: money(4200) } });
    const fetchMock = vi.fn((url: string) => (url === '/api/cart' ? reply(200, { cart: cartWith() }) : reply(200, { cart: serverCart })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useBoth, { wrapper });
    await waitFor(() => expect(result.current.cart.isLoading).toBe(false));
    const reads = fetchMock.mock.calls.filter(([url]) => url === '/api/cart').length;
    await act(async () => {
      await result.current.actions.addDeviceLine(ADD);
    });
    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
    expect(url).toBe('/api/cart/devices');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify(ADD) });
    await waitFor(() => expect(result.current.cart.cart?.summary.total.centAmount).toBe(4200));
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/cart').length).toBe(reads);
  });

  it('changeAcquisition patches the line with the new mode and term and caches the repriced cart', async () => {
    const fetchMock = vi.fn((url: string) => (url === '/api/cart' ? reply(200, { cart: cartWith() }) : reply(200, { cart: cartWith({ version: 3 }) })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useBoth, { wrapper });
    await act(async () => {
      await result.current.actions.changeAcquisition('line 1', { mode: 'lease', termMonths: 24 });
    });
    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
    expect(url).toBe('/api/cart/devices/line%201');
    expect(init).toMatchObject({ method: 'PATCH', body: JSON.stringify({ mode: 'lease', termMonths: 24 }) });
    await waitFor(() => expect(result.current.cart.cart?.version).toBe(3));
  });

  it('surfaces MODE_UNAVAILABLE with its details so the card can say which modes exist, and keeps the unchanged cart', async () => {
    const unchanged = cartWith({ version: 7 });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/cart' ? reply(200, { cart: cartWith() }) : reply(409, { error: { code: 'MODE_UNAVAILABLE', message: 'Lease is not available for Nova 5G.', details: { mode: 'lease', available: ['outright', 'installments'] } }, cart: unchanged }),
      ),
    );
    const { result } = renderHook(useBoth, { wrapper });
    let caught: unknown;
    await act(async () => {
      caught = await result.current.actions.addDeviceLine({ ...ADD, mode: 'lease' }).catch((error: unknown) => error);
    });
    expect(caught).toBeInstanceOf(CartError);
    expect(caught).toMatchObject({ bundleCode: 'MODE_UNAVAILABLE', httpStatus: 409, details: { available: ['outright', 'installments'] } });
    await waitFor(() => expect(result.current.cart.cart?.version).toBe(7));
  });

  it('a network failure is a CartError too', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/api/cart' ? reply(200, { cart: cartWith() }) : Promise.reject(new TypeError('offline')))));
    const { result } = renderHook(useBoth, { wrapper });
    await expect(result.current.actions.addDeviceLine(ADD)).rejects.toMatchObject({ bundleCode: 'NETWORK' });
  });
});
