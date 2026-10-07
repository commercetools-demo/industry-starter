import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { KEY_SESSION } from '@/lib/cache-keys';
import { useSession } from './useSession';

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

describe('useSession', () => {
  it('loads the session summary through fetch and uses the shared key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"session":{"kind":"anonymous","hasCart":true}}'));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSession(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.session).toEqual({ kind: 'anonymous', hasCart: true }));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', undefined);
    expect(KEY_SESSION).toBe('session');
  });

  it('exposes the error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":{"code":"INTERNAL","message":"x"}}', { status: 500 })));
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.session).toBeUndefined();
  });
});
