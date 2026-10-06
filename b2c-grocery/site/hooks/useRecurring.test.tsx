import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEY_RECURRING } from '@/lib/cache-keys';
import { ApiError } from '@/lib/fetcher';
import { summary } from '@/test/recurring';
import { useRecurring, useRecurringMutations } from './useRecurring';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function setup(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal('fetch', fetchMock);
  const Wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
  const hook = renderHook(() => ({ list: useRecurring(), mutations: useRecurringMutations(), cache: useSWRConfig().cache }), { wrapper: Wrapper });
  return { fetchMock, ...hook };
}

afterEach(() => vi.unstubAllGlobals());

describe('useRecurring', () => {
  it('safe defaults before data: no recurring orders, no policies', () => {
    const { result } = setup(() => new Promise(() => undefined));
    expect(result.current.list.recurringOrders).toEqual([]);
    expect(result.current.list.policies).toEqual([]);
  });

  it('loads the list under KEY_RECURRING', async () => {
    const { result, fetchMock } = setup(async () => json({ recurringOrders: [summary()], policies: [{ key: 'weekly', name: 'Every week' }] }));
    await waitFor(() => expect(result.current.list.recurringOrders).toHaveLength(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/recurring');
    expect(result.current.list.policies).toEqual([{ key: 'weekly', name: 'Every week' }]);
    expect(result.current.cache.get(KEY_RECURRING)).toBeDefined();
  });

  it('a change replaces that entry in the cache with the answer (same id) without refetching', async () => {
    const { result, fetchMock } = setup(async (url, init) =>
      init?.method === 'PATCH'
        ? json({ recurringOrder: summary({ state: 'Paused', stateRaw: 'Paused', nextOrderAt: undefined }) })
        : json({ recurringOrders: [summary(), summary({ id: 'ro-2' })], policies: [] }),
    );
    await waitFor(() => expect(result.current.list.recurringOrders).toHaveLength(2));
    await act(async () => {
      await result.current.mutations.pause('ro-1');
    });
    const patch = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH')!;
    expect(patch[0]).toBe('/api/account/recurring/ro-1');
    expect(JSON.parse(String((patch[1] as RequestInit).body))).toEqual({ action: 'pause' });
    expect(result.current.list.recurringOrders.map((r) => [r.id, r.state])).toEqual([['ro-1', 'Paused'], ['ro-2', 'Active']]);
    expect(fetchMock.mock.calls.filter((c) => !(c[1] as RequestInit | undefined)?.method)).toHaveLength(1);
  });

  it('request bodies of the other actions', async () => {
    const { result, fetchMock } = setup(async (url, init) => (init?.method === 'PATCH' ? json({ recurringOrder: summary() }) : json({ recurringOrders: [summary()], policies: [] })));
    await waitFor(() => expect(result.current.list.recurringOrders).toHaveLength(1));
    await act(async () => {
      await result.current.mutations.setCadence('ro-1', 'monthly');
      await result.current.mutations.setQuantity('ro-1', 'l-1', 4);
      await result.current.mutations.resume('ro-1');
      await result.current.mutations.cancel('ro-1');
    });
    const bodies = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH').map((c) => JSON.parse(String((c[1] as RequestInit).body)));
    expect(bodies).toEqual([
      { action: 'set-cadence', policyKey: 'monthly' },
      { action: 'set-quantity', lineId: 'l-1', quantity: 4 },
      { action: 'resume' },
      { action: 'cancel' },
    ]);
  });

  it('a failed change throws ApiError and refreshes the list', async () => {
    let reads = 0;
    const { result } = setup(async (url, init) => {
      if (init?.method === 'PATCH') return json({ error: 'INVALID_STATE' }, 409);
      reads += 1;
      return json({ recurringOrders: [summary()], policies: [] });
    });
    await waitFor(() => expect(reads).toBe(1));
    await act(async () => {
      await expect(result.current.mutations.pause('ro-1')).rejects.toBeInstanceOf(ApiError);
    });
    await waitFor(() => expect(reads).toBe(2));
  });
});
