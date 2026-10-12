import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fixture from '@/lib/mappers/__fixtures__/categories.json';
import { buildCategoryTree, mapCategory } from '@/lib/mappers/category';
import { buildNavItems } from '@/lib/nav';
import type { Locale } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

// Conformance of plp-led-catalog-navigation against the header built by workstream I: the header is derived from the category tree
// (H's real mapper over a trimmed live category read), never from literals.

const state = vi.hoisted(() => ({ pathname: '/shop/cable-internet' }));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  usePathname: () => state.pathname,
}));
vi.mock('@/hooks/useSwitchMarket', () => ({ useSwitchMarket: () => ({ switchMarket: vi.fn(), pending: false }) }));

import { SiteHeader } from './SiteHeader';

type SdkCategory = Parameters<typeof mapCategory>[0];
const SDK = fixture as unknown as SdkCategory[];

function header(locale: Locale, categories: SdkCategory[] = SDK) {
  const tree = buildCategoryTree(categories.map((category) => mapCategory(category, locale)));
  renderWithProviders(<SiteHeader items={buildNavItems(tree, locale)} account={<span>Log in</span>} bundle={<span>bundle slot</span>} />, { locale });
  return tree;
}

const nav = () => within(screen.getByRole('navigation', { name: /Main navigation|Hauptnavigation/ }));
// the root categories that are pills of their own (the plan finder and the plan menu are static entries around them)
const pills = () => nav().getAllByRole('link').filter((link) => !link.getAttribute('href')?.endsWith('/plan-finder'));
const menuButton = () => nav().getByRole('button', { name: /Browse all plans|Alle Tarife/ });

describe('header and the category tree', () => {
  it('Plan finder comes first, then the plan menu, then the other roots; Add-ons is not navigation', () => {
    const tree = header('en-US');
    const order = Array.from(screen.getByRole('navigation', { name: 'Main navigation' }).querySelectorAll('a, button')).map((node) => node.textContent?.replace('▾', '').trim());
    expect(order).toEqual(['Plan finder', 'Browse all plans', 'Phones & devices']);
    expect(screen.queryByText('Add-ons')).not.toBeInTheDocument();
    // The root still exists in the tree (its pages work); nothing links to it.
    expect(tree.some((root) => root.key === 'malva-cat-add-ons')).toBe(true);
  });

  it('the menu opens to the three plan categories in the tree\'s slugs and closes on Escape', async () => {
    const user = userEvent.setup();
    const tree = header('en-US');
    expect(screen.queryByRole('region', { name: 'Plan categories' })).not.toBeInTheDocument();
    await user.click(menuButton());
    const panel = screen.getByRole('region', { name: 'Plan categories' });
    const links = within(panel).getAllByRole('link');
    expect(links.map((link) => link.querySelector('span')?.textContent)).toEqual(['Phone plans', 'Wireless internet', 'Cable internet']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      ['malva-cat-phone-plans', 'malva-cat-home-wireless', 'malva-cat-cable-internet'].map((key) => `/en-US/shop/${tree.find((root) => root.key === key)?.slugs['en-US']}`),
    );
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Plan categories' })).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });

  it('a plan category listing marks the plan menu as the current section', () => {
    header('en-US');
    expect(menuButton().className).toContain('bg-brand-950');
    state.pathname = '/shop/phones-and-devices';
    cleanup();
    header('en-US');
    expect(menuButton().className).not.toContain('bg-brand-950');
    state.pathname = '/shop/cable-internet';
  });

  it('names and links are German for a German buyer', async () => {
    const user = userEvent.setup();
    const tree = header('de-DE');
    await user.click(menuButton());
    const links = within(screen.getByRole('region', { name: 'Tarifkategorien' })).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      ['malva-cat-phone-plans', 'malva-cat-home-wireless', 'malva-cat-cable-internet'].map((key) => `/de-DE/shop/${tree.find((root) => root.key === key)?.slugs['de-DE']}`),
    );
    expect(links[0].querySelector('span')?.textContent).not.toBe('Phone plans');
  });

  it('a category added to the tree appears with no code change', () => {
    const extra = {
      ...SDK[0],
      id: 'new-cat-id',
      key: 'malva-cat-new-offers',
      name: { 'en-US': 'New offers', 'de-DE': 'Neue Angebote' },
      slug: { 'en-US': 'new-offers', 'de-DE': 'neue-angebote' },
      orderHint: '0.95',
      parent: undefined,
    } as unknown as SdkCategory;
    header('en-US', [...SDK, extra]);
    expect(pills().map((link) => link.textContent)).toContain('New offers');
    expect(pills().at(-1)).toHaveAttribute('href', '/en-US/shop/new-offers');
  });
});
