import { act, renderHook, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
let pathname = '/shop';
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname,
}));

import { useSaved } from './useSaved';

const user = { id: 'c-1', email: 'a@b.c', firstName: 'A', lastName: 'B' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
function setup({ account = user as typeof user | null, handler }: { account?: typeof user | null; handler: Handler }) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/me') return json({ user: account });
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en-US" messages={{}}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fallback: { account } }}>{children}</SWRConfig>
    </NextIntlClientProvider>
  );
  return { fetchMock, ...renderHook(() => useSaved(), { wrapper: Wrapper }) };
}

beforeEach(() => {
  push.mockClear();
  pathname = '/shop';
  sessionStorage.clear();
  window.history.replaceState({}, '', '/en-US/shop');
});
afterEach(() => vi.unstubAllGlobals());

describe('useSaved: signed in', () => {
  it('Cached page: the heart state comes from the wishlist fetch, not from props', async () => {
    const { result } = setup({ handler: () => json({ productIds: ['p-1'] }) });
    expect(result.current.isSaved('p-1')).toBe(false);
    await waitFor(() => expect(result.current.isSaved('p-1')).toBe(true));
    expect(result.current.isSaved('p-2')).toBe(false);
  });

  it('Toggle: an unsaved product is added (optimistic) and the cache takes the server list', async () => {
    let release: (r: Response) => void = () => {};
    const { result, fetchMock } = setup({
      handler: (url, init) =>
        init?.method === 'POST' ? new Promise<Response>((resolve) => (release = resolve)) : json({ productIds: [] }),
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/account/wishlist', undefined));
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.toggle('p-1');
    });
    await waitFor(() => expect(result.current.isSaved('p-1')).toBe(true)); // before the server answered
    await act(async () => {
      release(json({ productIds: ['p-1'] }));
      await pending;
    });
    expect(result.current.isSaved('p-1')).toBe(true);
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ productId: 'p-1' });
  });

  it('Toggle: a filled heart removes the product (DELETE)', async () => {
    const { result, fetchMock } = setup({
      handler: (url, init) => (init?.method === 'DELETE' ? json({ productIds: [] }) : json({ productIds: ['p-1'] })),
    });
    await waitFor(() => expect(result.current.isSaved('p-1')).toBe(true));
    await act(async () => {
      await result.current.toggle('p-1');
    });
    expect(result.current.isSaved('p-1')).toBe(false);
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/account/wishlist/p-1' && init?.method === 'DELETE')).toBe(true);
  });

  it('Server error: the optimistic change is rolled back and nothing is thrown', async () => {
    const { result } = setup({
      handler: (url, init) => (init?.method === 'POST' ? json({ error: 'WISHLIST_ERROR' }, 500) : json({ productIds: [] })),
    });
    await waitFor(() => expect(result.current.isSaved('p-1')).toBe(false));
    await act(async () => {
      await result.current.toggle('p-1');
    });
    expect(result.current.isSaved('p-1')).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('Session ended (401): rolls back and sends the shopper to sign-in like a visitor', async () => {
    const { result } = setup({
      handler: (url, init) => (init?.method === 'POST' ? json({ error: 'UNAUTHORIZED' }, 401) : json({ productIds: [] })),
    });
    await act(async () => {
      await result.current.toggle('p-1');
    });
    expect(result.current.isSaved('p-1')).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe('useSaved: anonymous', () => {
  it('no wishlist request is made and hearts are outline', async () => {
    const { result, fetchMock } = setup({ account: null, handler: () => json({}, 401) });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', undefined));
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/account/wishlist')).toBe(false);
    expect(result.current.isSaved('p-1')).toBe(false);
  });

  it('Anonymous heart click: remembers the product and opens sign-in with redirect (incl. save) and save', async () => {
    window.history.replaceState({}, '', '/en-US/shop?category=bakery');
    const { result } = setup({ account: null, handler: () => json({}, 401) });
    await act(async () => {
      await result.current.toggle('p-1');
    });
    expect(sessionStorage.getItem('pendingSave')).toBe('p-1');
    const redirect = encodeURIComponent('/en-US/shop?category=bakery&save=p-1');
    expect(push).toHaveBeenCalledWith(`/account/sign-in?redirect=${redirect}&save=p-1`);
  });

  it('Anonymous heart click on the home page keeps a valid locale path', async () => {
    pathname = '/';
    window.history.replaceState({}, '', '/en-US');
    const { result } = setup({ account: null, handler: () => json({}, 401) });
    await act(async () => {
      await result.current.toggle('p-9');
    });
    expect(push).toHaveBeenCalledWith(`/account/sign-in?redirect=${encodeURIComponent('/en-US/?save=p-9')}&save=p-9`);
  });
});
