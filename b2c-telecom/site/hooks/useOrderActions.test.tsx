import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { keyOrder } from '@/lib/cache-keys';
import { AccountApiError } from './accountRequest';
import { useOrderActions } from './useOrderActions';

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
const useBoth = () => ({ actions: useOrderActions(), swr: useSWRConfig() });

afterEach(() => vi.unstubAllGlobals());

describe('useOrderActions', () => {
  it('cancel posts the reason to the cancel route and writes the answer into the order cache', async () => {
    const fetchMock = vi.fn(() => reply(200, { order: { orderNumber: 'MLV-ABC12345', orderState: 'Cancelled' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useBoth, { wrapper });
    let order: unknown;
    await act(async () => {
      order = await result.current.actions.cancel('MLV-ABC12345', { reason: 'other', note: 'moving' });
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/MLV-ABC12345/cancel', expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'other', note: 'moving' }) }));
    expect(order).toMatchObject({ orderState: 'Cancelled' });
    expect(result.current.swr.cache.get(keyOrder('MLV-ABC12345'))?.data).toMatchObject({ orderState: 'Cancelled' });
  });

  it('requestReturn posts the items to the return route', async () => {
    const fetchMock = vi.fn(() => reply(200, { order: { orderNumber: 'MLV-ABC12345', returns: [] } }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useBoth, { wrapper });
    const input = { items: [{ lineItemId: 'd2', quantity: 1 }], reason: 'defective' as const };
    await act(async () => {
      await result.current.actions.requestReturn('MLV-ABC12345', input);
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/orders/MLV-ABC12345/return', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }));
  });

  it('surfaces the error code and details of a refusal and leaves the cache alone', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(409, { error: { code: 'NOT_CANCELLABLE', message: 'no', details: { block: 'SERVICE_STARTED' } } })));
    const { result } = renderHook(useBoth, { wrapper });
    const error = await act(async () => result.current.actions.cancel('MLV-ABC12345', { reason: 'moving' }).catch((caught: unknown) => caught));
    expect(error).toBeInstanceOf(AccountApiError);
    expect(error).toMatchObject({ code: 'NOT_CANCELLABLE', status: 409, details: { block: 'SERVICE_STARTED' } });
    expect(result.current.swr.cache.get(keyOrder('MLV-ABC12345'))).toBeUndefined();
  });

  it('reports a network failure as NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    const { result } = renderHook(useBoth, { wrapper });
    const error = await act(async () => result.current.actions.requestReturn('MLV-ABC12345', { items: [], reason: 'other' }).catch((caught: unknown) => caught));
    expect(error).toMatchObject({ code: 'NETWORK' });
  });
});
