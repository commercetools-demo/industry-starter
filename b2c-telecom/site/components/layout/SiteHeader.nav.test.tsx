import { screen, within } from '@testing-library/react';
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

const pills = () => within(screen.getByRole('navigation', { name: /Main navigation|Hauptnavigation/ })).getAllByRole('link');

describe('header and the category tree', () => {
  it('Header reflects the tree: order, submenu children, locale names', () => {
    const tree = header('en-US');
    // Order: exactly the order the tree has (order hints decide), one pill per root.
    expect(pills().map((link) => link.textContent)).toEqual(tree.map((root) => root.name));
    expect(pills().map((link) => link.textContent)).toEqual(['Phone plans', 'Wireless internet', 'Cable internet', 'Add-ons', 'Phones & devices']);
    // Each pill links to the root's slug in the buyer's locale.
    expect(pills().map((link) => link.getAttribute('href'))).toEqual(tree.map((root) => `/en-US/shop/${root.slugs['en-US']}`));
    // Children are not literals either: a child category's own listing marks its ROOT pill as the current section.
    const addOns = tree.find((root) => root.key === 'malva-cat-add-ons');
    expect(addOns?.children.length).toBeGreaterThan(0);
  });

  it('the pill of a child category listing is the active one of its root', () => {
    const tree = buildCategoryTree(SDK.map((category) => mapCategory(category, 'en-US')));
    const child = tree.find((root) => root.key === 'malva-cat-add-ons')?.children[0];
    state.pathname = `/shop/${child?.slug}`;
    header('en-US');
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Add-ons');
    state.pathname = '/shop/cable-internet';
  });

  it('names and links are German for a German buyer', () => {
    const tree = header('de-DE');
    const items = pills();
    expect(items.map((link) => link.textContent)).toEqual(tree.map((root) => root.name));
    expect(items.map((link) => link.getAttribute('href'))).toEqual(tree.map((root) => `/de-DE/shop/${root.slugs['de-DE']}`));
    expect(items[0].textContent).not.toBe('Phone plans');
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
