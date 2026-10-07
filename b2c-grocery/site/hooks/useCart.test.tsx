import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/fetcher';
import type { Cart } from '@/lib/types';
import { useCart, useCartMutations } from './useCart';

const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const cartWith = (itemCount: number): Cart => ({
  id: 'cart-1',
  version: itemCount,
  currencyCode: 'USD',
  lines: [],
  itemCount,
  subtotal: money(0),
  total: money(0),
  isProvisional: false,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Every call gets a fresh Response (a body can be read only once). */
const reply = (body: unknown, status = 200) => vi.fn().mockImplementation(async () => json(body, status));

function setup(fetchMock: ReturnType<typeof vi.fn>, fallback: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', fetchMock);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fallback }}>{children}</SWRConfig>
  );
  return renderHook(() => ({ query: useCart(), mutations: useCartMutations() }), { wrapper: Wrapper });
}

afterEach(() => vi.unstubAllGlobals());

describe('useCart', () => {
  it('read default: no cart yields null', async () => {
    const { result } = setup(reply({ cart: null }));
    await waitFor(() => expect(result.current.query.data).toBeNull());
    expect(result.current.query.cart).toBeNull();
  });

  it('seeded fallback is the first value (no spinner flash)', () => {
    const { result } = setup(reply({ cart: cartWith(2) }), { cart: cartWith(2) });
    expect(result.current.query.cart?.itemCount).toBe(2);
  });
});

describe('useCartMutations', () => {
  it('Add mutation success: cache is updated from the response and nothing is refetched', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ cart: null })).mockResolvedValueOnce(json({ cart: cartWith(1) }));
    const { result } = setup(fetchMock);
    await waitFor(() => expect(result.current.query.data).toBeNull());
    await act(async () => {
      await result.current.mutations.addItem('MILK-1L', 2);
    });
    expect(result.current.query.cart?.itemCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/cart/line-items');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ sku: 'MILK-1L', quantity: 2 });
  });

  it('addItem forwards the recurrence policy key', async () => {
    const fetchMock = reply({ cart: cartWith(1) });
    const { result } = setup(fetchMock);
    await act(async () => {
      await result.current.mutations.addItem('MILK-1L', 1, { recurrencePolicyKey: 'weekly' });
    });
    expect(JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body)).toEqual({ sku: 'MILK-1L', quantity: 1, recurrencePolicyKey: 'weekly' });
  });

  it('setQuantity PATCHes and removeLine DELETEs the line', async () => {
    const fetchMock = reply({ cart: cartWith(1) });
    const { result } = setup(fetchMock, { cart: cartWith(1) });
    await act(async () => {
      await result.current.mutations.setQuantity('line 1', 3);
      await result.current.mutations.removeLine('line 1');
    });
    const calls = fetchMock.mock.calls.filter(([url]) => String(url).includes('line-items'));
    expect(calls[0][0]).toBe('/api/cart/line-items/line%201');
    expect(calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(calls[0][1].body)).toEqual({ quantity: 3 });
    expect(calls[1][1].method).toBe('DELETE');
  });

  it('removing the last line stores null', async () => {
    const { result } = setup(reply({ cart: null }), { cart: cartWith(1) });
    await act(async () => {
      await result.current.mutations.removeLine('line-1');
    });
    expect(result.current.query.cart).toBeNull();
  });

  it('Mutation fails: throws ApiError and the cache is unchanged', async () => {
    const fetchMock = reply({ error: 'INSUFFICIENT_STOCK', available: 3 }, 409);
    const { result } = setup(fetchMock, { cart: cartWith(2) });
    let error: unknown;
    await act(async () => {
      error = await result.current.mutations.addItem('MILK-1L', 9).catch((e: unknown) => e);
    });
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).data).toEqual({ error: 'INSUFFICIENT_STOCK', available: 3 });
    expect(result.current.query.cart?.itemCount).toBe(2);
  });
});
