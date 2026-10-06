import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keyProposals } from '@/lib/cache-keys';
import { ApiError } from '@/lib/fetcher';
import { useProposals } from './useProposals';

const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe('useProposals', () => {
  it('key is namespaced under order: so sign-out clears it', () => {
    expect(keyProposals('o-1')).toBe('order:o-1:proposals');
  });

  it('loads proposals and removal requests; defaults to none while loading', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ proposals: [{ editId: 'e1' }], removalRequested: ['l1'] })));
    const { result } = renderHook(() => useProposals('o 1'), { wrapper });
    expect(result.current.proposals).toEqual([]);
    expect(result.current.removalRequested).toEqual([]);
    await waitFor(() => expect(result.current.proposals).toHaveLength(1));
    expect(result.current.removalRequested).toEqual(['l1']);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/account/orders/o%201/proposals');
  });

  it('a body without the expected arrays counts as no proposals', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ order: {} })));
    const { result } = renderHook(() => useProposals('o-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ proposals: [], removalRequested: [] }));
  });

  it('accept posts and refetches; a 409 throws ApiError and leaves the list alone', async () => {
    let status = 200;
    const fn = vi.fn(async (url: string, init?: RequestInit) => (init?.method === 'POST' ? json({ error: 'STALE' }, status) : json({ proposals: [], removalRequested: [] })));
    vi.stubGlobal('fetch', fn);
    const { result } = renderHook(() => useProposals('o-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    await act(async () => result.current.accept('e1'));
    expect(fn.mock.calls.some(([url, init]) => url === '/api/account/proposals/e1/accept' && init?.method === 'POST')).toBe(true);
    status = 409;
    let caught: unknown;
    await act(async () => {
      caught = await result.current.decline('e1').catch((e: unknown) => e);
    });
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(409);
  });
});
