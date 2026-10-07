import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildNavItems } from '@/lib/nav';
import type { Category } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

const flag = vi.hoisted(() => ({ enabled: true }));
vi.mock('@/lib/config/search', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/config/search')>()),
  get HEADER_SEARCH_ENABLED() {
    return flag.enabled;
  },
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  usePathname: () => '/',
}));
vi.mock('@/hooks/useSwitchMarket', () => ({ useSwitchMarket: () => ({ switchMarket: vi.fn(), pending: false }) }));

import { SiteHeader } from './SiteHeader';

const TREE: Category[] = ['phone-plans', 'cable-internet'].map((slug) => ({ id: slug, key: slug, name: slug, slug, slugs: { 'en-US': slug, 'de-DE': slug }, children: [] }));

function header() {
  renderWithProviders(<SiteHeader items={buildNavItems(TREE, 'en-US')} account={<button type="button">Log in</button>} bundle={<span>bundle slot</span>} />);
}

describe('header search entry', () => {
  beforeEach(() => {
    flag.enabled = true;
  });

  it('the header has a labelled search link to the locale search page, before the account link', () => {
    header();
    const link = screen.getAllByRole('link', { name: 'Search' }).find((candidate) => candidate.getAttribute('aria-label') === 'Search');
    expect(link).toHaveAttribute('href', '/en-US/search');
    const account = screen.getByRole('button', { name: 'Log in' });
    expect(link?.compareDocumentPosition(account)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('is absent when the flag is false', async () => {
    flag.enabled = false;
    header();
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.queryByRole('link', { name: 'Search' })).not.toBeInTheDocument();
  });

  it('the drawer shows Search first, above the category pills', async () => {
    header();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = within(screen.getByRole('dialog'));
    const links = drawer.getAllByRole('link');
    expect(links[0]).toHaveAccessibleName('Malva Telecom home');
    expect(links[1]).toHaveTextContent('Search');
    expect(links[1]).toHaveAttribute('href', '/en-US/search');
    expect(links[2]).toHaveTextContent('phone-plans');
  });
});
