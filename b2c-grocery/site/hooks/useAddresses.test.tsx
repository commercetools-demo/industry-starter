import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEY_ADDRESSES } from '@/lib/cache-keys';
import { ApiError } from '@/lib/fetcher';
import type { SavedAddress } from '@/lib/types';
import { useProfile } from './useOrders';
import { useAddressMutations, useAddresses } from './useAddresses';

const a = (id: string, extra: Partial<SavedAddress> = {}): SavedAddress => ({
  id,
  firstName: 'Ada',
  lastName: 'L',
  streetName: `${id} St`,
  postalCode: '94105',
  city: 'SF',
  country: 'US',
  isDefaultShipping: false,
  isDefaultBilling: false,
  ...extra,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function setup(handler: (url: string, init?: RequestInit) => Promise<Response>, options?: { enabled?: boolean }) {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal('fetch', fetchMock);
  const Wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
  const hook = renderHook(() => ({ list: useAddresses(options), profile: useProfile(), mutations: useAddressMutations(), cache: useSWRConfig().cache }), { wrapper: Wrapper });
  return { fetchMock, ...hook };
}

afterEach(() => vi.unstubAllGlobals());

describe('useAddresses', () => {
  it('safe default before data: no addresses, no default', () => {
    const { result } = setup(() => new Promise(() => undefined));
    expect(result.current.list.addresses).toEqual([]);
    expect(result.current.list.defaultAddress).toBeNull();
  });

  it('loads the book under KEY_ADDRESSES and exposes the default shipping address', async () => {
    const { result, fetchMock } = setup(async () => json({ addresses: [a('a1'), a('a2', { isDefaultShipping: true })] }));
    await waitFor(() => expect(result.current.list.addresses).toHaveLength(2));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/addresses');
    expect(result.current.list.defaultAddress?.id).toBe('a2');
    expect(result.current.cache.get(KEY_ADDRESSES)?.data).toBeDefined();
  });

  it('enabled: false (anonymous) does not fetch', async () => {
    const { fetchMock, result } = setup(async () => json({ addresses: [] }), { enabled: false });
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/account/addresses')).toHaveLength(0);
    expect(result.current.list.addresses).toEqual([]);
  });

  it('401 keeps the safe default and exposes the error', async () => {
    const { result } = setup(async () => json({ error: 'UNAUTHENTICATED' }, 401));
    await waitFor(() => expect(result.current.list.error).toBeDefined());
    expect(result.current.list.addresses).toEqual([]);
  });
});

describe('useAddressMutations', () => {
  it('Save address: the list in the cache is the server answer; the profile is refreshed', async () => {
    const book = [a('a1', { isDefaultShipping: true }), a('a2')];
    const calls: string[] = [];
    const { result, fetchMock } = setup(async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/account/addresses' && init?.method === 'POST') return json({ addresses: book }, 201);
      if (url === '/api/account/addresses') return json({ addresses: [a('a1', { isDefaultShipping: true })] });
      return json({ firstName: 'Ada' });
    });
    await waitFor(() => expect(result.current.list.addresses).toHaveLength(1));
    await act(async () => {
      await result.current.mutations.add({ firstName: 'Bob' });
    });
    expect(result.current.list.addresses.map((x) => x.id)).toEqual(['a1', 'a2']);
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')?.[1]?.body))).toEqual({ firstName: 'Bob' });
    await waitFor(() => expect(calls.filter((c) => c === 'GET /api/account/profile')).toHaveLength(2));
  });

  it('update, remove and make default use the id routes and write the answer', async () => {
    const seen: string[] = [];
    const { result } = setup(async (url, init) => {
      if (init?.method) seen.push(`${init.method} ${url}`);
      if (init?.method === 'DELETE') return json({ addresses: [] });
      if (init?.method === 'POST') return json({ addresses: [a('a/1', { isDefaultShipping: true, isDefaultBilling: true })] });
      if (init?.method === 'PATCH') return json({ addresses: [a('a/1', { city: 'Oakland' })] });
      return json({ addresses: [a('a/1')] });
    });
    await waitFor(() => expect(result.current.list.addresses).toHaveLength(1));
    await act(async () => {
      await result.current.mutations.update('a/1', { city: 'Oakland' });
    });
    expect(result.current.list.addresses[0].city).toBe('Oakland');
    await act(async () => {
      await result.current.mutations.makeDefault('a/1');
    });
    expect(result.current.list.defaultAddress?.id).toBe('a/1');
    await act(async () => {
      await result.current.mutations.remove('a/1');
    });
    expect(result.current.list.addresses).toEqual([]);
    expect(seen).toEqual(['PATCH /api/account/addresses/a%2F1', 'POST /api/account/addresses/a%2F1/default', 'DELETE /api/account/addresses/a%2F1']);
  });

  it('Invalid postcode: a 400 throws ApiError with the field keys and the cache keeps the old list', async () => {
    const { result } = setup(async (_url, init) =>
      init?.method === 'POST' ? json({ error: 'INVALID_ADDRESS', fields: { postalCode: 'invalidPostcode' } }, 400) : json({ addresses: [a('a1')] }),
    );
    await waitFor(() => expect(result.current.list.addresses).toHaveLength(1));
    let caught: unknown;
    await act(async () => {
      await result.current.mutations.add({ postalCode: '1' }).catch((e: unknown) => {
        caught = e;
      });
    });
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(400);
    expect((caught as ApiError).data).toEqual({ error: 'INVALID_ADDRESS', fields: { postalCode: 'invalidPostcode' } });
    expect(result.current.list.addresses).toHaveLength(1);
  });
});
