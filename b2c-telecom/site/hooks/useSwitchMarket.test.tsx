import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import useSWR, { SWRConfig } from 'swr';
import { useSwitchMarket } from './useSwitchMarket';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock('@/i18n/routing', () => ({
  useRouter: () => router,
  usePathname: () => '/shop/cable',
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('sort=price'),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useSwitchMarket', () => {
  it('posts the locale, then replaces the same path with the new locale and refreshes', async () => {
    const fetchMock = stubFetch(200, { locale: 'de-DE', currency: 'EUR', country: 'DE', cart: { action: 'none', droppedLines: [] } });
    const { result } = renderHook(() => useSwitchMarket(), { wrapper });
    await act(async () => {
      await result.current.switchMarket('de-DE');
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/locale', expect.objectContaining({ method: 'POST', body: JSON.stringify({ locale: 'de-DE' }) }));
    expect(router.replace).toHaveBeenCalledWith('/shop/cable?sort=price', { locale: 'de-DE' });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
  });

  it('Product not sellable in the new region: the hook returns the dropped lines for the notice', async () => {
    const body = {
      locale: 'de-DE',
      currency: 'EUR',
      country: 'DE',
      cart: { action: 'discarded', droppedLines: [{ offerKey: 'malva-offer-cable-500', name: 'Cable 500' }] },
    };
    stubFetch(200, body);
    const { result } = renderHook(() => useSwitchMarket(), { wrapper });
    let returned: unknown;
    await act(async () => {
      returned = await result.current.switchMarket('de-DE');
    });
    expect(returned).toEqual(body);
  });

  it('an HTTP 400 rejects with region.error and does not navigate', async () => {
    stubFetch(400, { error: { code: 'VALIDATION', message: 'Unsupported locale' } });
    const { result } = renderHook(() => useSwitchMarket(), { wrapper });
    await act(async () => {
      await expect(result.current.switchMarket('de-DE')).rejects.toThrow('region.error');
    });
    expect(router.replace).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });

  it('clears the SWR cache: a seeded key refetches after the switch', async () => {
    const keyFetcher = vi.fn().mockResolvedValue('value');
    const { result } = renderHook(
      () => ({ swr: useSWR('probe-key', keyFetcher), market: useSwitchMarket() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.swr.data).toBe('value'));
    expect(keyFetcher).toHaveBeenCalledTimes(1);
    stubFetch(200, { locale: 'de-DE', currency: 'EUR', country: 'DE', cart: { action: 'none', droppedLines: [] } });
    await act(async () => {
      await result.current.market.switchMarket('de-DE');
    });
    await waitFor(() => expect(keyFetcher).toHaveBeenCalledTimes(2));
  });
});
