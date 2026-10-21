import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig, unstable_serialize } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import { useAuthActions } from '@/hooks/useAuthActions';
import { KEY_ACCOUNT, KEY_CART, KEY_CART_COUNT, keyCart, keyOrders } from '@/lib/cache-keys';
import { nav, stubFetch } from '@/test/shell';

afterEach(() => vi.unstubAllGlobals());

describe('useAuthActions', () => {
  it('Logout clears every user-scoped cache key in both key forms', async () => {
    stubFetch({ '/api/auth/logout': () => ({ ok: true }) });
    const cache = new Map();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
    );
    const { result } = renderHook(() => ({ actions: useAuthActions() }), { wrapper });
    // Entries as useSWR leaves them: the original key is kept in `_k`, which key filters match on.
    const put = (key: unknown, data: unknown) => cache.set(unstable_serialize(key as string), { data, _k: key });
    put(KEY_ACCOUNT, { customer: { id: 'c1' } });
    put(KEY_CART, { id: 'k' });
    put(keyCart('c1'), { id: 'k' });
    put(keyOrders('c1'), [{ id: 'o' }]);
    put(KEY_CART_COUNT, { count: 3 });
    put('market', { x: 1 });
    await act(async () => {
      await result.current.actions.signOut();
    });
    const live = [...cache.entries()].filter(([k, v]) => v?.data !== undefined && !k.startsWith('$'));
    const keys = live.map(([k]) => k);
    expect(keys.some((k) => k.includes('market'))).toBe(true);
    expect(keys.filter((k) => k.includes('orders') || k.includes('cart'))).toEqual([]);
    expect(cache.get(KEY_ACCOUNT)?.data).toEqual({ customer: null });
    expect(nav.replace).toHaveBeenCalledWith('/account/sign-in?notice=signedOut');
  });

  it('signIn posts credentials and adopts the customer', async () => {
    const { calls } = stubFetch({
      '/api/auth/login': () => ({ customer: { id: 'c1', firstName: 'A' }, cart: null }),
      '/api/cart/count': () => ({ count: 0 }),
    });
    const cache = new Map();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
    );
    const { result } = renderHook(() => useAuthActions(), { wrapper });
    await act(async () => {
      await result.current.signIn('a@example.com', 'pw');
    });
    expect(calls[0].url).toBe('/api/auth/login');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'a@example.com', password: 'pw' });
    expect(cache.get(KEY_ACCOUNT)?.data).toEqual({ customer: { id: 'c1', firstName: 'A' } });
  });
});
