import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_AUTH_LOGIN, API_AUTH_LOGOUT, API_AUTH_ME, API_AUTH_REGISTER } from '@/lib/api-paths';
import { KEY_ACCOUNT, KEY_CART } from '@/lib/cache-keys';
import { renderWithProviders, screen } from '@/test/utils';
import { useAccount } from './use-account';
import { useAuth } from './use-auth';
import { useCart } from './use-cart';

const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => router,
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const sam = { id: 'c1', firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com' };

let cache: Map<string, unknown>;
const wrapper = (fallback: Record<string, unknown> = {}) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <SWRConfig value={{ fallback, provider: () => cache as never, dedupingInterval: 0 }}>{children}</SWRConfig>;
  };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  cache = new Map();
  Object.values(router).forEach((fn) => fn.mockReset());
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('authentication-and-identity: useAccount', () => {
  it('seeded by the layout (user or null): no request on first paint', async () => {
    const { result } = renderHook(() => useAccount(), { wrapper: wrapper({ [KEY_ACCOUNT]: null }) });
    expect(result.current.data).toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('without seeded data it reads GET /api/auth/me', async () => {
    fetchMock.mockResolvedValue(json(sam));
    const { result } = renderHook(() => useAccount(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toEqual(sam));
    expect(fetchMock).toHaveBeenCalledWith(API_AUTH_ME);
  });

  it('signed out: the endpoint answers null and the hook yields null', async () => {
    fetchMock.mockResolvedValue(json(null));
    const { result } = renderHook(() => useAccount(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeNull());
  });
});

describe('authentication-and-identity: useAuth', () => {
  it('signIn posts credentials, writes the user to the account key and revalidates the cart key', async () => {
    fetchMock.mockResolvedValue(json(sam));
    const { result } = renderHook(() => ({ auth: useAuth(), account: useAccount(), cart: useCart() }), { wrapper: wrapper({ [KEY_ACCOUNT]: null }) });
    expect(result.current.account.data).toBeNull(); // reading `data` subscribes the hook to it, as a component would
    let outcome;
    await act(async () => {
      outcome = await result.current.auth.signIn('sam@example.com', 'secret-pass-123');
    });
    expect(outcome).toEqual({ ok: true, user: sam });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(API_AUTH_LOGIN);
    expect(JSON.parse(init.body as string)).toEqual({ email: 'sam@example.com', password: 'secret-pass-123' });
    await waitFor(() => expect(result.current.account.data).toEqual(sam));
  });

  it('a refusal is returned with status and the server text; the account key is untouched', async () => {
    fetchMock.mockResolvedValue(json({ error: 'The email or password is not correct.' }, 401));
    const { result } = renderHook(() => ({ auth: useAuth(), account: useAccount() }), { wrapper: wrapper({ [KEY_ACCOUNT]: null }) });
    let outcome;
    await act(async () => {
      outcome = await result.current.auth.signIn('sam@example.com', 'bad');
    });
    expect(outcome).toEqual({ ok: false, status: 401, error: 'The email or password is not correct.', fields: undefined });
    expect(result.current.account.data).toBeNull();
  });

  it('a network failure is status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper() });
    let outcome;
    await act(async () => {
      outcome = await result.current.signIn('sam@example.com', 'x');
    });
    expect(outcome).toEqual({ ok: false, status: 0, error: '' });
  });

  it('register posts name, email and password', async () => {
    fetchMock.mockResolvedValue(json({ ...sam, emailVerified: true }, 201));
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.register('Sam Rivera', 'sam@example.com', 'a-long-passphrase');
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(API_AUTH_REGISTER);
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Sam Rivera', email: 'sam@example.com', password: 'a-long-passphrase' });
  });

  it('signOut clears account and cart keys (null, not the layout fallback) and goes to /login', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    const fallback = { [KEY_ACCOUNT]: sam, [KEY_CART]: { id: 'cart-old' } };
    const { result } = renderHook(() => ({ auth: useAuth(), account: useAccount(), cart: useCart() }), { wrapper: wrapper(fallback) });
    expect(result.current.cart.data).toEqual({ id: 'cart-old' });
    let ok;
    await act(async () => {
      ok = await result.current.auth.signOut();
    });
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(API_AUTH_LOGOUT, { method: 'POST' });
    expect(result.current.account.data).toBeNull();
    expect(result.current.cart.data).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/login');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('a failed sign-out request keeps the state and does not navigate', async () => {
    fetchMock.mockResolvedValue(json({ error: 'x' }, 500));
    const { result } = renderHook(() => ({ auth: useAuth(), account: useAccount() }), { wrapper: wrapper({ [KEY_ACCOUNT]: sam }) });
    let ok;
    await act(async () => {
      ok = await result.current.auth.signOut();
    });
    expect(ok).toBe(false);
    expect(result.current.account.data).toEqual(sam);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('authentication-and-identity: header slot shows initials', () => {
  it('a signed-in user from /api/auth/me renders the initials avatar, an anonymous one the Sign in button', async () => {
    const { AccountSlot } = await import('@/components/layout/AccountSlot');
    fetchMock.mockResolvedValue(json(sam));
    const { unmount } = renderWithProviders(<AccountSlot />);
    expect(await screen.findByText('SR')).toBeInTheDocument();
    unmount();
    fetchMock.mockResolvedValue(json(null));
    renderWithProviders(<AccountSlot />);
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });
});
