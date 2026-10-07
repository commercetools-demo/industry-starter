import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { COUNTRY_CONFIG } from '@/lib/utils';
import { renderWithProviders } from '@/test/utils';
import { LocaleSwitcher } from './LocaleSwitcher';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ ...router, push: vi.fn() }),
  usePathname: () => '/shop',
}));
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  useSearchParams: () => new URLSearchParams('category=bakery'),
}));

const markets = Object.values(COUNTRY_CONFIG);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LocaleSwitcher', () => {
  it('offers one option per market and checks the current locale', () => {
    renderWithProviders(<LocaleSwitcher markets={markets} />, { locale: 'de-DE' });
    expect(screen.getByRole('radio', { name: 'EN' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'DE' })).toBeChecked();
  });

  it('switching POSTs /api/locale, then replaces the route with the new locale and refreshes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ locale: 'de-DE' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<LocaleSwitcher markets={markets} />);
    await userEvent.click(screen.getByText('DE'));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/locale',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ locale: 'de-DE' }) }),
    );
    expect(router.replace).toHaveBeenCalledWith('/shop?category=bakery', { locale: 'de-DE' });
  });

  it('a failed POST does not navigate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));
    renderWithProviders(<LocaleSwitcher markets={markets} />);
    await userEvent.click(screen.getByText('DE'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('choosing the current locale does nothing', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderWithProviders(<LocaleSwitcher markets={markets} />);
    await userEvent.click(screen.getByText('EN'));
    expect(fetch).not.toHaveBeenCalled();
  });
});
