// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAccount } from './useAccount';
import { useCart } from './useCart';
import { useCartSummary } from './useCartSummary';
import { cart } from '@/test/cart-view-model';

const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const anna = { id: 'cust-1', email: 'anna@example.com', firstName: 'Anna', lastName: 'Schneider', mobile: null, addresses: [], defaultShippingAddressId: null, defaultBillingAddressId: null };

afterEach(() => vi.unstubAllGlobals());

describe('hooks/useAccount', () => {
  it('null when signed out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ customer: null })));
    const { result } = renderHook(() => useAccount(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.customer).toBeNull();
    expect(result.current.isSignedIn).toBe(false);
  });

  it('customer when signed in', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ customer: anna })));
    const { result } = renderHook(() => useAccount(), { wrapper });
    await waitFor(() => expect(result.current.isSignedIn).toBe(true));
    expect(result.current.customer?.firstName).toBe('Anna');
  });

  it('login signs in, updates the header count from the merged cart and returns ok', async () => {
    let signedIn = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/auth/login') {
          signedIn = true;
          return json({ customer: anna, count: 3 });
        }
        if (url === '/api/auth/me') return json({ customer: signedIn ? anna : null });
        if (url === '/api/cart/summary') return json({ count: signedIn ? 3 : 1 });
        return json({ cart: null });
      }),
    );
    const { result } = renderHook(() => ({ account: useAccount(), badge: useCartSummary() }), { wrapper });
    await waitFor(() => expect(result.current.badge.count).toBe(1));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.account.login('anna@example.com', 'pw');
    });
    expect(outcome).toEqual({ ok: true });
    expect(result.current.account.isSignedIn).toBe(true);
    await waitFor(() => expect(result.current.badge.count).toBe(3));
  });

  it('login reports bad credentials and rate limiting without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/auth/login' ? json({ error: 'invalid-credentials' }, 401) : json({ customer: null }))));
    const { result } = renderHook(() => useAccount(), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.login('a@example.com', 'bad');
    });
    expect(outcome).toEqual({ ok: false, error: 'invalid-credentials' });
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'x' }, 429)));
    await act(async () => {
      outcome = await result.current.login('a@example.com', 'bad');
    });
    expect(outcome).toEqual({ ok: false, error: 'rate-limited' });
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'x' }, 500)));
    await act(async () => {
      outcome = await result.current.login('a@example.com', 'bad');
    });
    expect(outcome).toEqual({ ok: false, error: 'failed' });
  });

  it('logout clears cart cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/auth/me') return json({ customer: anna });
        if (url === '/api/auth/logout') return json({ ok: true });
        if (url === '/api/cart/summary') return json({ count: 3 });
        return json({ cart: cart() });
      }),
    );
    const { result } = renderHook(() => ({ account: useAccount(), cart: useCart(), badge: useCartSummary() }), { wrapper });
    await waitFor(() => expect(result.current.cart.cart).not.toBeNull());
    await waitFor(() => expect(result.current.account.isSignedIn).toBe(true));
    await act(async () => {
      await result.current.account.logout();
    });
    expect(result.current.account.isSignedIn).toBe(false);
    expect(result.current.cart.cart).toBeNull();
    expect(result.current.badge.count).toBe(0);
  });
});
