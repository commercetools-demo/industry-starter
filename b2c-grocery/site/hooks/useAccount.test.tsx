import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import useSWR, { SWRConfig, useSWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY_ACCOUNT, KEY_ADDRESSES, KEY_CART, KEY_ORDERS, KEY_RECURRING, KEY_WISHLIST, keyOrder, keyWishlistProducts } from '@/lib/cache-keys';
import { ApiError } from '@/lib/fetcher';
import { useCart } from './useCart';
import { useAccount, useAuthMutations } from './useAccount';

const refresh = vi.fn();
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh }),
}));

const user = { id: 'c-1', email: 'a@b.co', firstName: 'Ada', lastName: 'L' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function setup(fetchMock: ReturnType<typeof vi.fn>, fallback: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', fetchMock);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fallback }}>{children}</SWRConfig>
  );
  // useCart is mounted like CartProvider does in the app; useSWR(order key) stands in for an order detail page.
  return renderHook(
    () => ({
      account: useAccount(),
      cart: useCart(),
      order: useSWR(keyOrder('o-1'), async () => ({ id: 'o-1' })),
      savedProducts: useSWR(keyWishlistProducts('en-US'), async () => [{ id: 'p-1' }]),
      mutations: useAuthMutations(),
      cache: useSWRConfig(),
    }),
    { wrapper: Wrapper },
  );
}

beforeEach(() => refresh.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe('useAccount', () => {
  it('anonymous: user is null (never undefined) once loaded', async () => {
    const { result } = setup(vi.fn().mockImplementation(async () => json({ user: null })));
    await waitFor(() => expect(result.current.account.data).toBeNull());
    expect(result.current.account.user).toBeNull();
  });

  it('signed in: user comes from /api/auth/me', async () => {
    const { result } = setup(vi.fn().mockImplementation(async () => json({ user })));
    await waitFor(() => expect(result.current.account.user).toEqual(user));
  });

  it('the seeded fallback is available on the first render', () => {
    const { result } = setup(vi.fn().mockImplementation(() => new Promise(() => undefined)), { [KEY_ACCOUNT]: user });
    expect(result.current.account.user).toEqual(user);
  });
});

describe('useAuthMutations', () => {
  it('login: posts credentials, revalidates account and cart, refreshes the router', async () => {
    let signedIn = false;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/auth/login') {
        signedIn = true;
        return json({ user });
      }
      if (url === '/api/auth/me') return json({ user: signedIn ? user : null });
      if (url === '/api/cart') return json({ cart: null });
      throw new Error(`unexpected ${url}`);
    });
    const { result } = setup(fetchMock);
    await waitFor(() => expect(result.current.account.data).toBeNull());
    await act(() => result.current.mutations.login('a@b.co', 'secret-pass'));
    expect(JSON.parse(fetchMock.mock.calls.find((c) => c[0] === '/api/auth/login')![1].body)).toEqual({ email: 'a@b.co', password: 'secret-pass' });
    await waitFor(() => expect(result.current.account.user).toEqual(user));
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/cart')).toBe(true);
    expect(refresh).toHaveBeenCalled();
  });

  it('register: posts the draft and refreshes', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => (url === '/api/auth/me' ? json({ user }) : json({ user, cart: null })));
    const { result } = setup(fetchMock);
    await act(() => result.current.mutations.register({ firstName: 'Ada', lastName: 'L', email: 'a@b.co', password: 'longenough' }));
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/auth/register' && c[1].method === 'POST')).toBe(true);
    expect(refresh).toHaveBeenCalled();
  });

  it('failure: throws ApiError with the status and error code, no refresh', async () => {
    const { result } = setup(vi.fn().mockImplementation(async (url: string) => (url === '/api/auth/me' ? json({ user: null }) : json({ error: 'INVALID_CREDENTIALS' }, 401))));
    let error: unknown;
    await act(async () => {
      error = await result.current.mutations.login('a@b.co', 'bad').catch((e: unknown) => e);
    });
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe('INVALID_CREDENTIALS');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('Logout: clears the account, cart, orders, addresses, wishlist, recurring and order caches', async () => {
    const fallback = {
      [KEY_ACCOUNT]: user,
      [KEY_CART]: { id: 'cart-1' },
      [KEY_ORDERS]: [1],
      [KEY_ADDRESSES]: [1],
      [KEY_WISHLIST]: [1],
      [KEY_RECURRING]: [1],
    };
    const fetchMock = vi.fn().mockImplementation(async (url: string) => (url === '/api/auth/logout' ? json({ ok: true }) : json({ user: null })));
    const { result } = setup(fetchMock, fallback);
    await waitFor(() => expect(result.current.order.data).toEqual({ id: 'o-1' }));
    await act(() => result.current.mutations.logout());
    const get = (key: string) => result.current.cache.cache.get(key)?.data;
    expect(get(KEY_ACCOUNT)).toBeNull();
    expect(get(KEY_CART)).toBeNull();
    for (const key of [KEY_ORDERS, KEY_ADDRESSES, KEY_WISHLIST, KEY_RECURRING, keyOrder('o-1'), keyWishlistProducts('en-US')]) expect(get(key)).toBeUndefined();
    expect(refresh).toHaveBeenCalled();
  });
});
