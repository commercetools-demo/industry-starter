import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { KEY_ACCOUNT } from '@/lib/cache-keys';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers, screen } from '@/test/utils';
import { useAddRxLines, useAddWithToast, useCart, useCartDetails, useCartMutations } from './use-cart';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
// The layout seeds the account key; the header cart is only read for a signed-in visitor.
const wrapper = ({ children }: { children: ReactNode }) => (
  <Providers>
    <SWRConfig value={{ fallback: { [KEY_ACCOUNT]: { id: 'c1' } } }}>{children}</SWRConfig>
  </Providers>
);

const summary = { id: 'c1', version: 2, itemCount: 2, lineCount: 2, currencyCode: 'USD' };
const money = { centAmount: 1875, currencyCode: 'USD', fractionDigits: 2 };
const cart = { ...summary, lines: [], subtotal: money, shipping: null, total: money, unavailableCount: 0 };

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('cart-management: use-cart', () => {
  it('header count: the summary comes from the cheap endpoint', async () => {
    fetchMock.mockResolvedValue(json(summary));
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.data?.lineCount).toBe(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/cart?view=summary');
  });

  it('signed out (401) is no cart, not an error', async () => {
    fetchMock.mockResolvedValue(json({ error: 'Please sign in to continue.' }, 401));
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeUndefined();
  });

  it('signed out: no request at all for the header cart', async () => {
    const { result } = renderHook(() => useCart(), { wrapper: ({ children }: { children: ReactNode }) => (
        <Providers>
          <SWRConfig value={{ fallback: { [KEY_ACCOUNT]: null } }}>{children}</SWRConfig>
        </Providers>
      ),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('the cart page reads the full validated cart', async () => {
    fetchMock.mockResolvedValue(json(cart));
    const { result } = renderHook(() => useCartDetails(), { wrapper });
    await waitFor(() => expect(result.current.data?.total.centAmount).toBe(1875));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/cart');
  });

  it('adding posts the number in the body, never in the URL, then revalidates the cart', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => (init?.method === 'POST' ? json({ cart, refused: [] }) : json(summary)));
    const { result } = renderHook(() => ({ cart: useCart(), add: useAddRxLines() }), { wrapper });
    await waitFor(() => expect(result.current.cart.data).toBeTruthy());
    fetchMock.mockClear();
    await act(async () => {
      await result.current.add('RX-77102', ['RX-77102-1']);
    });
    const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST');
    expect(post?.[0]).toBe('/api/cart/rx-lines');
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toEqual({ rxNumber: 'RX-77102', lineRefs: ['RX-77102-1'] });
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/cart?view=summary')).toBe(true);
  });

  it('a refusal from the server is thrown to the caller', async () => {
    fetchMock.mockResolvedValue(json({ error: 'None of the selected medications can be added right now.' }, 422));
    const { result } = renderHook(() => useAddRxLines(), { wrapper });
    await expect(result.current('RX-77102', ['a'])).rejects.toMatchObject({ status: 422 });
  });

  it('removing sends DELETE for the line and revalidates both cart keys', async () => {
    fetchMock.mockImplementation(async () => json(cart));
    const { result } = renderHook(() => ({ header: useCart(), page: useCartDetails(), actions: useCartMutations() }), { wrapper });
    await waitFor(() => expect(result.current.page.data).toBeTruthy());
    fetchMock.mockClear();
    await act(async () => {
      await result.current.actions.removeLine('li 1');
    });
    expect(fetchMock.mock.calls[0]).toEqual(['/api/cart/lines/li%201', { method: 'DELETE' }]);
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain('/api/cart');
    expect(urls).toContain('/api/cart?view=summary');
  });

  it('addWithToast announces "Added to cart" with a link to the cart', async () => {
    fetchMock.mockResolvedValue(json({ cart, refused: [] }));
    const { result } = renderHook(() => useAddWithToast(), { wrapper });
    await act(async () => {
      await result.current('RX-77102', ['a']);
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Added to cart');
  });
});
