import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScanLookup } from '@/hooks/useScanLookup';
import { stubFetch } from '@/test/shell';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);
const product = { sku: 'MCF-POD-EMBER-50', name: 'Ember' };

afterEach(() => vi.unstubAllGlobals());

describe('useScanLookup', () => {
  it('makes no request without a SKU', () => {
    const { fn } = stubFetch({});
    const { result } = renderHook(() => useScanLookup(null, 'US'), { wrapper });
    expect(result.current.status).toBe('idle');
    expect(fn).not.toHaveBeenCalled();
  });

  it('a known SKU is found', async () => {
    const { calls } = stubFetch({ '/api/instore/scan': () => ({ product }) });
    const { result } = renderHook(() => useScanLookup('MCF-POD-EMBER-50', 'US'), { wrapper });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.product).toEqual(product);
    expect(calls[0]?.url).toBe('/api/instore/scan?sku=MCF-POD-EMBER-50');
  });

  it('Unknown SKU: a 404 is "unknown", not a failure', async () => {
    stubFetch({ '/api/instore/scan': () => Response.json({ error: { code: 'not_found', message: 'x' } }, { status: 404 }) });
    const { result } = renderHook(() => useScanLookup('NOPE-1', 'US'), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unknown'));
    expect(result.current.product).toBeNull();
  });

  it('a server error is a failure the dialog can retry, and retry asks again', async () => {
    let n = 0;
    const { calls } = stubFetch({
      '/api/instore/scan': () => (n++ === 0 ? Response.json({ error: { code: 'internal_error', message: 'x' } }, { status: 500 }) : { product }),
    });
    const { result } = renderHook(() => useScanLookup('MCF-POD-EMBER-50', 'US'), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('failed'));
    await result.current.retry();
    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(calls).toHaveLength(2);
  });

  it('a network failure is a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const { result } = renderHook(() => useScanLookup('MCF-POD-EMBER-50', 'US'), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('failed'));
  });
});
