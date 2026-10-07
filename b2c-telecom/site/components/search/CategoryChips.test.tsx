import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import type { SearchParams } from '@/lib/search/params';
import { CategoryChips } from './CategoryChips';

const PARAMS: SearchParams = { q: 'malva', category: null, sort: 'relevance', page: 1 };
const CATEGORIES = [
  { key: 'malva-cat-protection', name: 'Security and protection', count: 1 },
  { key: 'malva-cat-equipment', name: 'Routers and equipment', count: 5 },
];

describe('CategoryChips', () => {
  it('renders All with the total and one chip per category with its count', () => {
    renderWithProviders(<CategoryChips categories={CATEGORIES} total={6} params={PARAMS} />);
    const nav = screen.getByRole('navigation', { name: 'Narrow by category' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['All (6)', 'Security and protection (1)', 'Routers and equipment (5)']);
    expect(within(nav).getByRole('link', { name: 'All (6)' })).toHaveAttribute('aria-current', 'true');
  });

  it('hrefs keep q and sort, set the category and reset the page', () => {
    renderWithProviders(<CategoryChips categories={CATEGORIES} total={6} params={{ ...PARAMS, sort: 'price-desc', page: 3 }} />);
    expect(screen.getByRole('link', { name: 'Security and protection (1)' })).toHaveAttribute('href', '/en-US/search?q=malva&category=malva-cat-protection&sort=price-desc');
    expect(screen.getByRole('link', { name: 'All (6)' })).toHaveAttribute('href', '/en-US/search?q=malva&sort=price-desc');
  });

  it('the active chip is marked and a second click removes the filter', () => {
    renderWithProviders(<CategoryChips categories={CATEGORIES} total={6} params={{ ...PARAMS, category: 'malva-cat-protection' }} />);
    const active = screen.getByRole('link', { name: 'Security and protection (1)' });
    expect(active).toHaveAttribute('aria-current', 'true');
    expect(active).toHaveAttribute('href', '/en-US/search?q=malva');
    expect(screen.getByRole('link', { name: 'All (6)' })).not.toHaveAttribute('aria-current');
  });

  it('is hidden while fewer than two categories match', () => {
    renderWithProviders(<CategoryChips categories={[CATEGORIES[0] as (typeof CATEGORIES)[number]]} total={1} params={PARAMS} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
