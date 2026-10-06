import { screen, within } from '@testing-library/react';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { COUNTRY_CONFIG } from '@/lib/utils';
import { renderWithProviders } from '@/test/utils';
import { Header } from './Header';

const nav = vi.hoisted(() => ({ pathname: '/', search: '' }));

vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const markets = Object.values(COUNTRY_CONFIG);
const renderHeader = (locale: 'en-US' | 'de-DE' = 'en-US') =>
  renderWithProviders(<Header bag={<button>BAG SLOT</button>} account={<button>ACCOUNT SLOT</button>} markets={markets} />, { locale });

beforeEach(() => {
  nav.pathname = '/';
  nav.search = '';
});

describe('Header', () => {
  it.each([
    ['en-US', en.nav],
    ['de-DE', de.nav],
  ] as const)('nav items come from messages in %s and link locale-aware', (locale, messages) => {
    renderHeader(locale);
    const primary = screen.getByRole('navigation', { name: messages.primary });
    expect(within(primary).getByRole('link', { name: messages.shop })).toHaveAttribute('href', `/${locale}/shop`);
    expect(within(primary).getByRole('link', { name: messages.new })).toHaveAttribute('href', `/${locale}/shop?sort=newest`);
    expect(within(primary).getByRole('link', { name: messages.journal })).toHaveAttribute('href', `/${locale}/journal`);
  });

  it('wordmark links home, search pill links to /search, saved links to /account/saved', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: en.nav.home })).toHaveAttribute('href', '/en-US');
    expect(screen.getByRole('link', { name: new RegExp(en.nav.searchPill) })).toHaveAttribute('href', '/en-US/search');
    expect(screen.getByRole('link', { name: en.nav.saved })).toHaveAttribute('href', '/en-US/account/saved');
  });

  it('renders the bag and account slots', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: 'BAG SLOT' })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ACCOUNT SLOT" })).toBeInTheDocument();
  });

  it('is sticky with the blurred 92% background', () => {
    renderHeader();
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky', 'top-0', 'backdrop-blur-[10px]');
    expect(header.className).toContain('color-mix(in_srgb,var(--color-bg)_92%,transparent)');
  });

  it('shows the compact menu button and the market picker', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: en.nav.menu })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: en.a11y.language })).toBeInTheDocument();
  });

  it('active item: Shop has aria-current on /shop, others do not', () => {
    nav.pathname = '/shop';
    renderHeader();
    const primary = screen.getByRole('navigation', { name: en.nav.primary });
    expect(within(primary).getByRole('link', { name: en.nav.shop })).toHaveAttribute('aria-current', 'page');
    expect(within(primary).getByRole('link', { name: en.nav.new })).not.toHaveAttribute('aria-current');
    expect(within(primary).getByRole('link', { name: en.nav.journal })).not.toHaveAttribute('aria-current');
  });

  it('active item: New in on /shop?sort=newest', () => {
    nav.pathname = '/shop';
    nav.search = 'sort=newest';
    renderHeader();
    const primary = screen.getByRole('navigation', { name: en.nav.primary });
    expect(within(primary).getByRole('link', { name: en.nav.new })).toHaveAttribute('aria-current', 'page');
    expect(within(primary).getByRole('link', { name: en.nav.shop })).not.toHaveAttribute('aria-current');
  });

  it('active item: Journal on /journal', () => {
    nav.pathname = '/journal';
    renderHeader();
    const primary = screen.getByRole('navigation', { name: en.nav.primary });
    expect(within(primary).getByRole('link', { name: en.nav.journal })).toHaveAttribute('aria-current', 'page');
  });

  it('no item is current on the home page', () => {
    renderHeader();
    const primary = screen.getByRole('navigation', { name: en.nav.primary });
    expect(within(primary).queryAllByRole('link').filter((l) => l.hasAttribute('aria-current'))).toHaveLength(0);
  });
});
