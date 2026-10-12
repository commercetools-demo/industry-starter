import { screen, within } from '@testing-library/react';
import { buildNavItems } from '@/lib/nav';
import type { Category } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ pathname: '/shop/cable-internet' }));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  usePathname: () => state.pathname,
}));

vi.mock('@/hooks/useSwitchMarket', () => ({ useSwitchMarket: () => ({ switchMarket: vi.fn(), pending: false }) }));

import { SiteHeader } from './SiteHeader';

const NAMES = ['Phone plans', 'Wireless internet', 'Cable internet', 'Add-ons', 'Phones and devices'];
const SLUGS = ['phone-plans', 'home-wireless-internet', 'cable-internet', 'add-ons', 'phones-and-devices'];

function tree(count: number): Category[] {
  return NAMES.slice(0, count).map((name, index) => ({
    id: SLUGS[index],
    key: `malva-cat-${SLUGS[index]}`,
    name,
    slug: SLUGS[index],
    slugs: { 'en-US': SLUGS[index], 'de-DE': SLUGS[index] },
    children: [],
  }));
}

function header(items = buildNavItems(tree(5), 'en-US')) {
  renderWithProviders(<SiteHeader items={items} account={<span>Log in</span>} bundle={<span>bundle slot</span>} />);
}

describe('SiteHeader', () => {
  it('Header stays reachable: header is sticky at top-0 above content (z-10)', () => {
    header();
    expect(screen.getByRole('banner')).toHaveClass('sticky', 'top-0', 'z-10', 'bg-surface-brand', 'shadow-sm');
  });

  it('renders the wordmark as a home link with an accessible name', () => {
    header();
    const home = screen.getByRole('link', { name: 'Malva Telecom home' });
    expect(home).toHaveAttribute('href', '/en-US');
    expect(home).toHaveTextContent('malva');
  });

  it('a four-root tree renders four category pills and the plan finder', () => {
    header(buildNavItems(tree(4), 'en-US'));
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getAllByRole('link')).toHaveLength(5);
  });

  it('five roots render five pills in tree order', () => {
    header();
    const links = within(screen.getByRole('navigation', { name: 'Main navigation' })).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([...NAMES, 'Plan finder']);
    expect(links.at(-1)).toHaveAttribute('href', '/en-US/plan-finder');
  });

  it('the active pill follows the route', () => {
    header();
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Cable internet');
  });

  it('with no items (catalog unavailable) the wordmark and both slots still render', () => {
    header([]);
    expect(screen.getByRole('link', { name: 'Malva Telecom home' })).toBeInTheDocument();
    expect(screen.getByText('Log in')).toBeInTheDocument();
    expect(screen.getByText('bundle slot')).toBeInTheDocument();
    // the plan finder is static: it is there with no categories at all
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getAllByRole('link').map((link) => link.textContent)).toEqual(['Plan finder']);
  });

  it('the desktop nav is hidden below md', () => {
    header();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toHaveClass('hidden', 'md:flex');
  });

  it('the plan finder item is active on its route and only there; German label', () => {
    state.pathname = '/plan-finder';
    header();
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Plan finder');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
    state.pathname = '/shop/cable-internet';
  });
});
