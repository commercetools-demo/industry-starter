import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEY_ORDERS, KEY_PROFILE, keyOrder, keyOrdersPage } from '@/lib/cache-keys';
import { useOrder, useOrders, useProfile } from './useOrders';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const reply = (body: unknown, status = 200) => vi.fn().mockImplementation(async () => json(body, status));

function setup<T>(fetchMock: ReturnType<typeof vi.fn>, hook: () => T, fallback: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', fetchMock);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, fallback }}>{children}</SWRConfig>
  );
  return renderHook(() => ({ value: hook(), cache: useSWRConfig().cache }), { wrapper: Wrapper });
}

afterEach(() => vi.unstubAllGlobals());

describe('useOrders', () => {
  it('safe defaults before the data arrives: no orders, total 0, page size 10', () => {
    const { result } = setup(vi.fn().mockImplementation(() => new Promise(() => undefined)), () => useOrders());
    expect(result.current.value.orders).toEqual([]);
    expect(result.current.value.total).toBe(0);
    expect(result.current.value.pageSize).toBe(10);
  });

  it('page 1 uses KEY_ORDERS and fetches /api/account/orders?page=1', async () => {
    const fetchMock = reply({ orders: [{ id: 'o1' }], total: 1, page: 1, pageSize: 10 });
    const { result } = setup(fetchMock, () => useOrders());
    await waitFor(() => expect(result.current.value.orders).toHaveLength(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/orders?page=1');
    expect(result.current.cache.get(KEY_ORDERS)?.data).toBeDefined();
  });

  it('later pages use their own key and page parameter', async () => {
    const fetchMock = reply({ orders: [], total: 25, page: 3, pageSize: 10 });
    const { result } = setup(fetchMock, () => useOrders(3));
    await waitFor(() => expect(result.current.value.total).toBe(25));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/orders?page=3');
    expect(keyOrdersPage(3)).toBe('orders:3');
    expect(result.current.cache.get('orders:3')?.data).toBeDefined();
  });

  it('401 keeps the safe defaults and exposes the error', async () => {
    const { result } = setup(reply({ error: 'Unauthorized' }, 401), () => useOrders());
    await waitFor(() => expect(result.current.value.error).toBeDefined());
    expect(result.current.value.orders).toEqual([]);
  });
});

describe('useOrder', () => {
  it('uses keyOrder(id) and unwraps the order', async () => {
    const fetchMock = reply({ order: { id: 'o 1' } });
    const { result } = setup(fetchMock, () => useOrder('o 1'));
    await waitFor(() => expect(result.current.value.order).toEqual({ id: 'o 1' }));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/account/orders/o%201');
    expect(result.current.cache.get(keyOrder('o 1'))?.data).toBeDefined();
    expect(result.current.value.notFound).toBe(false);
  });

  it('Another customer\'s order: 404 sets notFound, order stays null and is not retried', async () => {
    const fetchMock = reply({ error: 'ORDER_NOT_FOUND' }, 404);
    const { result } = setup(fetchMock, () => useOrder('x'));
    await waitFor(() => expect(result.current.value.notFound).toBe(true));
    expect(result.current.value.order).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('useProfile', () => {
  it('uses KEY_PROFILE; null while unloaded', async () => {
    const profile = { createdAt: '2023-01-01T00:00:00.000Z', firstName: 'Ada', lastName: 'L', email: 'a@b.co' };
    const { result } = setup(reply(profile), () => useProfile());
    expect(result.current.value.profile).toBeNull();
    await waitFor(() => expect(result.current.value.profile).toEqual(profile));
    expect(result.current.cache.get(KEY_PROFILE)?.data).toBeDefined();
  });
});
