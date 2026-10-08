import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/utils';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => router,
  usePathname: () => '/doctors/remote',
}));

import { RegionSwitcher } from './RegionSwitcher';

const US = { locale: 'en-US', label: 'United States, English (USD)' };
const DE = { locale: 'de-DE', label: 'Germany, German (EUR)' };

describe('switching-region-or-language: the switcher is shown only when there is a choice', () => {
  it('hidden with one valid region (v1) and with none', () => {
    const { rerender } = renderWithProviders(<RegionSwitcher regions={[US]} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    rerender(<RegionSwitcher regions={[]} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shown with two valid regions: a labelled select with the current region selected', () => {
    renderWithProviders(<RegionSwitcher regions={[US, DE]} />);
    const select = screen.getByRole('combobox', { name: 'Region and language' });
    expect(select).toHaveValue('en-US');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([US.label, DE.label]);
  });
});

describe('switching-region-or-language: the switch flow in the browser', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    router.replace.mockReset();
    router.refresh.mockReset();
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  const answer = (body: unknown, status = 200) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
  const pick = (locale: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Region and language' }), { target: { value: locale } });

  it('Region switched before a cart exists: one POST with the locale only, then the same page under the new prefix', async () => {
    answer({ locale: 'de-DE', country: 'DE', currency: 'EUR', cartCleared: false });
    renderWithProviders(<RegionSwitcher regions={[US, DE]} />);
    pick('de-DE');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/doctors/remote', { locale: 'de-DE' }));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/locale');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ locale: 'de-DE' });
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByText(/cart was emptied/)).toBeNull();
  });

  it('Region switched with a cart: the buyer is told the cart was emptied because of the currency', async () => {
    answer({ locale: 'de-DE', country: 'DE', currency: 'EUR', cartCleared: true });
    renderWithProviders(<RegionSwitcher regions={[US, DE]} />);
    pick('de-DE');
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(await screen.findAllByText(/Your cart was emptied because prices are in a different currency/)).not.toHaveLength(0);
  });

  it('a refused switch stays on the page and says so', async () => {
    answer({ error: 'This region is not supported.' }, 400);
    renderWithProviders(<RegionSwitcher regions={[US, DE]} />);
    pick('de-DE');
    expect(await screen.findAllByText('We could not switch region. Try again.')).not.toHaveLength(0);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
