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
    const desktop = within(screen.getAllByRole('navigation', { name: 'Main navigation' })[0]).getAllByRole('link');
    const desktopOrder = desktop.map((link) => [link.textContent, link.getAttribute('href')]);
    header.unmount();

    renderWithProviders(<MobileDrawer items={items} account={<span>Log in</span>} locale="en-US" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = within(within(screen.getByRole('dialog')).getByRole('navigation', { name: 'Main navigation' })).getAllByRole('link');
    expect(drawer.map((link) => [link.textContent, link.getAttribute('href')])).toEqual(desktopOrder);
    expect(drawer.map((link) => link.textContent)).toEqual(tree.map((root) => root.name));
  });
});
