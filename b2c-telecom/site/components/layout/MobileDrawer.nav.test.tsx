import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fixture from '@/lib/mappers/__fixtures__/categories.json';
import { buildCategoryTree, mapCategory } from '@/lib/mappers/category';
import { buildNavItems } from '@/lib/nav';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  usePathname: () => state.pathname,
}));
vi.mock('@/hooks/useSwitchMarket', () => ({ useSwitchMarket: () => ({ switchMarket: vi.fn(), pending: false }) }));

import { MobileDrawer } from './MobileDrawer';
import { SiteHeader } from './SiteHeader';

type SdkCategory = Parameters<typeof mapCategory>[0];
const SDK = fixture as unknown as SdkCategory[];

describe('mobile drawer and the category tree', () => {
  it('Mobile navigation: same tree and order in the drawer', async () => {
    const tree = buildCategoryTree(SDK.map((category) => mapCategory(category, 'en-US')));
    const items = buildNavItems(tree, 'en-US');

    const header = renderWithProviders(<SiteHeader items={items} account={<span>Log in</span>} bundle={<span>bundle slot</span>} />);
    // Plan finder first, then the plan menu (opened here), then the other roots
    const desktop = within(screen.getAllByRole('navigation', { name: 'Main navigation' })[0]);
    expect(desktop.getAllByRole('link')[0]).toHaveAttribute('href', '/en-US/plan-finder');
    await userEvent.click(desktop.getByRole('button', { name: 'Browse all plans' }));
    const menuLinks = within(screen.getByRole('region', { name: 'Plan categories' })).getAllByRole('link');
    const menuOrder = menuLinks.map((link) => [link.querySelector('span')?.textContent, link.getAttribute('href')]);
    const others = desktop.getAllByRole('link').filter((link) => !link.getAttribute('href')?.endsWith('/plan-finder') && !menuLinks.includes(link)).map((link) => [link.textContent, link.getAttribute('href')]);
    header.unmount();

    renderWithProviders(<MobileDrawer items={items} account={<span>Log in</span>} locale="en-US" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const nav = within(within(screen.getByRole('dialog')).getByRole('navigation', { name: 'Main navigation' }));
    const drawer = nav.getAllByRole('link');
    expect(drawer[0]).toHaveAttribute('href', '/en-US/plan-finder');
    const inGroup = within(nav.getByRole('group', { name: 'Browse all plans' })).getAllByRole('link');
    expect(inGroup.map((link) => [link.textContent, link.getAttribute('href')])).toEqual(menuOrder);
    expect(drawer.slice(1 + inGroup.length).map((link) => [link.textContent, link.getAttribute('href')])).toEqual(others);
    // Add-ons is in the tree but in no navigation
    expect(tree.some((root) => root.name === 'Add-ons')).toBe(true);
    expect(drawer.some((link) => link.textContent === 'Add-ons')).toBe(false);
  });
});
