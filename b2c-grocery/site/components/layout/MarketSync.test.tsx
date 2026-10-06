import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketSync } from './MarketSync';

const refresh = vi.fn();
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

const setCookie = (value: string | null) => {
  document.cookie = `your-shop-country-locale=${value ?? ''}; path=/; ${value === null ? 'max-age=0' : ''}`;
};

beforeEach(() => {
  refresh.mockClear();
  setCookie(null);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

describe('MarketSync', () => {
  it('Q-ORCH-1: calls /api/locale once and refreshes when the cookie differs from the URL locale', async () => {
    setCookie('de-DE');
    const { rerender } = render(<MarketSync locale="en-US" />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/locale');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ locale: 'en-US' });
    rerender(<MarketSync locale="en-US" />);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the cookie already matches the locale', async () => {
    setCookie('en-US');
    render(<MarketSync locale="en-US" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetch).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not refresh when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 400 })));
    render(<MarketSync locale="de-DE" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(refresh).not.toHaveBeenCalled();
  });
});
