// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cart } from '@/test/cart-view-model';
import { useCart } from './useCart';
import { useCartSummary } from './useCartSummary';

const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('Quantity change updates totals: hooks/useCart', () => {
  it('optimistic quantity updates line total and header count before the response', async () => {
    let release: (r: Response) => void = () => undefined;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return new Promise<Response>((resolve) => (release = resolve));
      return Promise.resolve(json({ count: 3 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => ({ cart: useCart(cart()), badge: useCartSummary() }), { wrapper });
    await waitFor(() => expect(result.current.badge.count).toBe(3));

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.cart.setQuantity('li-1', 3);
    });
    // the server has not answered yet
    await waitFor(() => expect(result.current.cart.cart?.lines[0].quantity).toBe(3));
    expect(result.current.cart.cart?.lines[0].total.centAmount).toBe(9200 + 4600);
    expect(result.current.cart.itemCount).toBe(4);
    await waitFor(() => expect(result.current.badge.count).toBe(4));

    await act(async () => {
      release(json({ cart: cart({ itemCount: 4 }) }));
      await pending;
    });
    expect(result.current.cart.itemCount).toBe(4);
  });

  it('rollback on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => (init?.method === 'PATCH' ? json({ error: 'x' }, 500) : json({ count: 3 }))),
    );
    const { result } = renderHook(() => useCart(cart()), { wrapper });
    await act(async () => {
      await result.current.setQuantity('li-1', 5);
    });
    expect(result.current.cart?.lines[0].quantity).toBe(2);
    expect(result.current.itemCount).toBe(3);
    expect(result.current.error).toBe(true);
  });

  it('response replaces cache without a second GET', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => (init?.method === 'PATCH' ? json({ cart: cart({ itemCount: 9, id: 'from-server' }), notice: 'capped' }) : json({ count: 3 })));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCart(cart()), { wrapper });
    await act(async () => {
      await result.current.setQuantity('li-1', 9);
    });
    expect(result.current.cart?.id).toBe('from-server');
    expect(result.current.notice).toBe('capped');
    expect(fetchMock.mock.calls.filter(([url, init]) => url === '/api/cart' && (init?.method ?? 'GET') === 'GET')).toHaveLength(0);
  });

  it('cart null after sign-out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ cart: null })));
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cart).toBeNull();
    expect(result.current.itemCount).toBe(0);
  });

  it('removing a line shows at once and replaces the cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => (init?.method === 'DELETE' ? json({ cart: cart({ lines: [], itemCount: 0 }) }) : json({ count: 3 }))));
    const { result } = renderHook(() => useCart(cart()), { wrapper });
    await act(async () => {
      await result.current.removeLine('li-1');
    });
    expect(result.current.cart?.lines).toHaveLength(0);
    expect(result.current.itemCount).toBe(0);
  });

  it('a refused promo code is reported without being in the cart', async () => {
    const promo = { code: 'NONSENSE', id: '', state: 'not-applied', reason: 'not-valid' };
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => (init?.method === 'POST' ? json({ cart: cart(), promo }) : json({ count: 3 }))));
    const { result } = renderHook(() => useCart(cart()), { wrapper });
    await act(async () => {
      await result.current.applyCode('NONSENSE');
    });
    expect(result.current.lastPromo).toEqual(promo);
    expect(result.current.cart?.promoCodes).toEqual([]);
  });

  it('a failed read of the cart shows the empty cart, not an error screen', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'x' }, 500)));
    const { result } = renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cart).toBeNull();
  });
});
