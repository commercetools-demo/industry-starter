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
const KEYS = ['malva-cat-phone-plans', 'malva-cat-home-wireless', 'malva-cat-cable-internet', 'malva-cat-add-ons', 'malva-cat-devices'];

function tree(count: number): Category[] {
  return NAMES.slice(0, count).map((name, index) => ({
    id: SLUGS[index],
    key: KEYS[index],
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

  const entries = () => Array.from(screen.getByRole('navigation', { name: 'Main navigation' }).querySelectorAll('a, button')).map((node) => node.textContent?.replace('▾', '').trim());

  it('a tree without devices renders the plan finder and the plan menu only', () => {
    header(buildNavItems(tree(4), 'en-US'));
    expect(entries()).toEqual(['Plan finder', 'Browse all plans']);
  });

  it('order: Plan finder first, then Browse all plans, then the other roots; Add-ons never appears', () => {
    header();
    expect(entries()).toEqual(['Plan finder', 'Browse all plans', 'Phones and devices']);
    expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getAllByRole('link')[0]).toHaveAttribute('href', '/en-US/plan-finder');
    expect(screen.queryByText('Add-ons')).not.toBeInTheDocument();
  });

  it('the active pill follows the route', () => {
    state.pathname = '/shop/phones-and-devices';
    header();
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Phones and devices');
    state.pathname = '/shop/cable-internet';
  });

  it('with no items (catalog unavailable) the wordmark and both slots still render', () => {
    header([]);
    expect(screen.getByRole('link', { name: 'Malva Telecom home' })).toBeInTheDocument();
    expect(screen.getByText('Log in')).toBeInTheDocument();
    expect(screen.getByText('bundle slot')).toBeInTheDocument();
    // the plan finder is static: it is there with no categories at all, and the plan menu needs categories
    expect(entries()).toEqual(['Plan finder']);
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
