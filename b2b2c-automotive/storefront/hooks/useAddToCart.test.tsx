// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAddToCart } from './useAddToCart';
import { useCartSummary } from './useCartSummary';

const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('Add to cart from a card: hooks/useAddToCart', () => {
  it('posts sku and quantity and refreshes the cart summary', async () => {
    let count = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/cart/lines') {
        count += Number(JSON.parse(String(init?.body)).quantity);
        return json({ cartId: 'c1', count });
      }
      return json({ count });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => ({ add: useAddToCart(), cart: useCartSummary() }), { wrapper });
    await waitFor(() => expect(result.current.cart.isLoading).toBe(false));
    expect(result.current.cart.count).toBe(0);

    let ok = false;
    await act(async () => {
      ok = await result.current.add.add('MLV-BP-41001', 1);
    });
    expect(ok).toBe(true);
    const post = fetchMock.mock.calls.find(([url]) => url === '/api/cart/lines');
    expect(post?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ sku: 'MLV-BP-41001', quantity: 1 });
    await waitFor(() => expect(result.current.cart.count).toBe(1));
    await act(async () => {
      await result.current.add.add('MLV-BP-41001', 1);
    });
    await waitFor(() => expect(result.current.cart.count).toBe(2));
    expect(result.current.add.error).toBeNull();
    expect(result.current.add.isAdding).toBe(false);
  });

  it('isAdding is true while the request runs', async () => {
    let release: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));
    const { result } = renderHook(() => useAddToCart(), { wrapper });
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.add('A1B', 1);
    });
    await waitFor(() => expect(result.current.isAdding).toBe(true));
    await act(async () => {
      release(json({ cartId: 'c', count: 1 }));
      await pending;
    });
    expect(result.current.isAdding).toBe(false);
  });

  it('a 422 reads price-unavailable and a failure reads failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'price-unavailable' }, 422)));
    const { result } = renderHook(() => useAddToCart(), { wrapper });
    await act(async () => {
      expect(await result.current.add('A1B', 1)).toBe(false);
    });
    expect(result.current.error).toBe('price-unavailable');

    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'x' }, 500)));
    await act(async () => {
      expect(await result.current.add('A1B', 1)).toBe(false);
    });
    expect(result.current.error).toBe('failed');

    vi.stubGlobal('fetch', vi.fn(async () => json({ cartId: 'c', count: 1 })));
    await act(async () => {
      await result.current.add('A1B', 1);
    });
    expect(result.current.error).toBeNull();
  });

  it('a network failure reads failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    const { result } = renderHook(() => useAddToCart(), { wrapper });
    await act(async () => {
      expect(await result.current.add('A1B', 1)).toBe(false);
    });
    expect(result.current.error).toBe('failed');
  });
});
