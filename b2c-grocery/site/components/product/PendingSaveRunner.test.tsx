import { render, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
let search = '';
let path = '/shop';
vi.mock('next/navigation', async (orig) => ({ ...(await orig<typeof import('next/navigation')>()), useSearchParams: () => new URLSearchParams(search) }));
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => path,
}));

import { PendingSaveRunner } from './PendingSaveRunner';

const user = { id: 'c-1', email: 'a@b.c', firstName: 'A', lastName: 'B' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mount(account: typeof user | null, { saveStatus = 200 }: { saveStatus?: number } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/me') return json({ user: account });
    if (init?.method === 'POST') return saveStatus === 200 ? json({ productIds: ['p-1'] }) : json({ error: 'WISHLIST_ERROR' }, saveStatus);
    return json({ productIds: [] });
  });
  vi.stubGlobal('fetch', fetchMock);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en-US" messages={{}}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fallback: { account } }}>{children}</SWRConfig>
    </NextIntlClientProvider>
  );
  const view = render(<PendingSaveRunner />, { wrapper: Wrapper });
  const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
  return { ...view, posts, fetchMock };
}

beforeEach(() => {
  replace.mockClear();
  sessionStorage.clear();
  search = '';
  path = '/shop';
});
afterEach(() => vi.unstubAllGlobals());

describe('PendingSaveRunner', () => {
  it('does nothing on the sign-in page (its URL carries save too); the redirect target completes the save', async () => {
    path = '/account/sign-in';
    search = '?redirect=%2Fen-US%2Fshop%3Fsave%3Dp-1&save=p-1';
    sessionStorage.setItem('pendingSave', 'p-1');
    const { posts } = mount(user);
    await new Promise((r) => setTimeout(r, 50));
    expect(posts()).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('pendingSave')).toBe('p-1');
  });

  it('Anonymous heart click, after sign-in: adds the product once, clears the storage and strips save', async () => {
    search = '?category=bakery&save=p-1';
    sessionStorage.setItem('pendingSave', 'p-1');
    const { posts, rerender } = mount(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/shop?category=bakery'));
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(String(posts()[0][1]?.body))).toEqual({ productId: 'p-1' });
    expect(sessionStorage.getItem('pendingSave')).toBeNull();
    rerender(<PendingSaveRunner />); // another render with the same URL does not save again
    expect(posts()).toHaveLength(1);
  });

  it('keeps the path clean when save was the only parameter', async () => {
    search = '?save=p-1';
    sessionStorage.setItem('pendingSave', 'p-1');
    mount(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/shop'));
  });

  it('Anonymous visitor: does nothing (no request, storage and URL untouched)', async () => {
    search = '?save=p-1';
    sessionStorage.setItem('pendingSave', 'p-1');
    const { posts, fetchMock } = mount(null);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', undefined));
    expect(posts()).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('pendingSave')).toBe('p-1');
  });

  it('Crafted link (no matching pendingSave): nothing is saved, the parameter is removed', async () => {
    search = '?save=p-evil';
    sessionStorage.setItem('pendingSave', 'p-1');
    const { posts } = mount(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/shop'));
    expect(posts()).toHaveLength(0);
    expect(sessionStorage.getItem('pendingSave')).toBe('p-1');
  });

  it('No save parameter: nothing happens', async () => {
    sessionStorage.setItem('pendingSave', 'p-1');
    const { posts, fetchMock } = mount(user);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', undefined));
    expect(posts()).toHaveLength(0);
    expect(replace).not.toHaveBeenCalled();
  });

  it('A failed save is not retried: storage cleared, parameter stripped', async () => {
    search = '?save=p-1';
    sessionStorage.setItem('pendingSave', 'p-1');
    const { posts } = mount(user, { saveStatus: 500 });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/shop'));
    expect(posts()).toHaveLength(1);
    expect(sessionStorage.getItem('pendingSave')).toBeNull();
  });
});
