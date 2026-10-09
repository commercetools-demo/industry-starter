import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig, useSWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buKey, KEY_ACCOUNT, KEY_BUSINESS_UNITS, KEY_CART } from '@/lib/cache-keys';
import { clearClientState, clearOtherCompanies } from '@/lib/client-state';
import { useAccount } from './useAccount';
import { useBusinessUnits } from './useBusinessUnits';
import { useQuoteList } from './useQuoteList';

const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
const respond = (routes: Record<string, { status?: number; body: unknown }>) =>
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { const r = routes[url] ?? { status: 404, body: { error: 'no' } }; return new Response(JSON.stringify(r.body), { status: r.status ?? 200 }); }));
afterEach(() => vi.unstubAllGlobals());

describe('malva-data-loading › Per-visitor state is client-fetched', () => {
  it('Hook shape: an error response gives null and [] and never throws', async () => {
    respond({});
    const a = renderHook(() => useAccount(), { wrapper });
    await waitFor(() => expect(a.result.current.isLoading).toBe(false));
    expect(a.result.current.account).toBeNull();
    const q = renderHook(() => useQuoteList(), { wrapper });
    await waitFor(() => expect(q.result.current.isLoading).toBe(false));
    expect(q.result.current.list).toEqual({ id: null, lines: [], count: 0 });
    expect(q.result.current.count).toBe(0);
    const b = renderHook(() => useBusinessUnits(), { wrapper });
    expect(b.result.current.businessUnits).toEqual([]);
  });
  it('a network failure also gives the safe default', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const a = renderHook(() => useAccount(), { wrapper });
    await waitFor(() => expect(a.result.current.isLoading).toBe(false));
    expect(a.result.current.account).toBeNull();
  });
  it('Mutation updates cache from the response body, without a refetch; failure throws', async () => {
    respond({ '/api/quote-list': { body: { id: 'c', lines: [], count: 0 } } });
    const q = renderHook(() => useQuoteList(), { wrapper });
    await waitFor(() => expect(q.result.current.isLoading).toBe(false));
    const next = { id: 'c', lines: [{ id: 'l', serviceId: 's', slug: 'x', name: 'X', quantity: 1 }], count: 1 };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(next), { status: 200 })));
    await act(async () => { await q.result.current.update('POST', '/api/quote-list/lines', {}); });
    expect(q.result.current.count).toBe(1);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Nope' }), { status: 400 })));
    await expect(q.result.current.update('POST', '/api/quote-list/lines', {})).rejects.toThrow('Nope');
  });
  it('Keys: tuples for Business-Unit-scoped entries', () => {
    expect(buKey(KEY_CART, 'co')).toEqual(['quote-list', 'co']);
    expect(buKey(KEY_CART, undefined)).toEqual(['quote-list', null]);
  });
});

describe('malva-data-loading › Sign-out and switch company', () => {
  it('Sign-out clears the account, quote-list and Business Unit entries', async () => {
    respond({ '/api/auth/me': { body: { customerId: 'c', email: 'e', businessUnitKey: 'co' } }, '/api/quote-list': { body: { id: 'x', lines: [], count: 2 } } });
    const hook = renderHook(() => ({ a: useAccount(), q: useQuoteList(), cfg: useSWRConfig() }), { wrapper });
    await waitFor(() => expect(hook.result.current.q.count).toBe(2));
    expect(hook.result.current.a.account?.customerId).toBe('c');
    await act(async () => { await clearClientState(hook.result.current.cfg.mutate as never); });
    expect(hook.result.current.a.account).toBeNull();
    expect(hook.result.current.cfg.cache.get(KEY_ACCOUNT)?.data).toBeUndefined();
    expect(KEY_BUSINESS_UNITS).toBe('business-units');
  });
  it('Switch company: another company\'s entries are cleared, this one\'s kept', async () => {
    const calls: boolean[] = [];
    const mutate = (m: (k: unknown) => boolean) => { for (const k of [[KEY_CART, 'a'], [KEY_CART, 'b'], KEY_ACCOUNT, 'other']) calls.push(m(k)); };
    clearOtherCompanies(mutate as never, 'b');
    expect(calls).toEqual([true, false, false, false]);
  });
});
