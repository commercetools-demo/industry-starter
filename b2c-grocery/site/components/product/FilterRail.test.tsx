import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseListingParams } from '@/lib/listing-params';
import { renderWithProviders } from '@/test/utils';
import { AppliedFilters } from './AppliedFilters';
import { FilterRail } from './FilterRail';
import type { ListingFilterData } from './filter-data';
import { ListingToolbar } from './ListingToolbar';

const replace = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/shop',
}));

const data = (currency = 'USD'): ListingFilterData => ({
  currency,
  total: 36,
  categories: [
    { slug: 'bakery', name: 'Bakery', count: 6, depth: 0 },
    { slug: 'drinks', name: 'Drinks', count: 5, depth: 0 },
  ],
  priceBands: [
    { id: 'lt-500', max: 500, count: 10 },
    { id: '500-1500', min: 500, max: 1500, count: 14 },
    { id: '1500-3000', min: 1500, max: 3000, count: 8 },
    { id: 'gt-3000', min: 3000, count: 4 },
  ],
  availability: { inStock: 33, outOfStock: 3 },
});

beforeEach(() => replace.mockClear());

describe('FilterRail', () => {
  it('counts are displayed for categories and availability', () => {
    renderWithProviders(<FilterRail data={data()} params={parseListingParams({})} />);
    expect(screen.getByRole('button', { name: /^Bakery\s*6$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Everything\s*36$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'In stock (33)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Out of stock (3)' })).toBeInTheDocument();
  });

  it('Apply a filter: selecting a band calls router.replace with price set and page removed', async () => {
    renderWithProviders(<FilterRail data={data()} params={parseListingParams({ category: 'bakery', page: '3' })} />);
    await userEvent.click(screen.getByRole('button', { name: '$5.00–$15.00' }));
    expect(replace).toHaveBeenCalledWith('/shop?category=bakery&price=500-1500');
  });

  it('selecting a category keeps the other filters and resets the page', async () => {
    renderWithProviders(<FilterRail data={data()} params={parseListingParams({ price: 'lt-500', sort: 'newest', page: '2' })} />);
    await userEvent.click(screen.getByRole('button', { name: /^Drinks/ }));
    expect(replace).toHaveBeenCalledWith('/shop?category=drinks&price=lt-500&sort=newest');
  });

  it('"Everything" and "Any price" remove their filter', async () => {
    renderWithProviders(<FilterRail data={data()} params={parseListingParams({ category: 'bakery', price: 'lt-500' })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Any price' }));
    expect(replace).toHaveBeenLastCalledWith('/shop?category=bakery');
    await userEvent.click(screen.getByRole('button', { name: /^Everything/ }));
    expect(replace).toHaveBeenLastCalledWith('/shop?price=lt-500');
  });

  it('availability radios navigate', async () => {
    renderWithProviders(<FilterRail data={data()} params={parseListingParams({})} />);
    await userEvent.click(screen.getByRole('radio', { name: /Out of stock/ }));
    expect(replace).toHaveBeenCalledWith('/shop?stock=out');
  });

  it('Clear all resets to /shop', async () => {
    renderWithProviders(<FilterRail data={data()} params={parseListingParams({ category: 'bakery', price: 'lt-500', stock: 'in', sort: 'newest', page: '2' })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(replace).toHaveBeenCalledWith('/shop');
  });

  it('active styles: aria-pressed and checked mirror the URL state', () => {
    renderWithProviders(<FilterRail data={data()} params={parseListingParams({ category: 'bakery', price: 'gt-3000', stock: 'in' })} />);
    expect(screen.getByRole('button', { name: /^Bakery/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Drinks/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Over $30.00' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Any price' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('radio', { name: /^In stock/ })).toBeChecked();
  });

  it('default state: Everything, Any price and Everything radio are active', () => {
    renderWithProviders(<FilterRail data={data()} params={parseListingParams({})} />);
    expect(screen.getByRole('button', { name: /^Everything/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Any price' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'Everything' })).toBeChecked();
  });

  it('German price bands: bands are shown in euros', () => {
    renderWithProviders(<FilterRail data={data('EUR')} params={parseListingParams({})} />, { locale: 'de-DE' });
    expect(screen.getByRole('button', { name: /^Unter 5,00\s€$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^5,00\s€–15,00\s€$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Über 30,00\s€$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jeder Preis' })).toBeInTheDocument();
  });

  it('calls onChange after navigating (used by the tablet sheet)', async () => {
    const onChange = vi.fn();
    renderWithProviders(<FilterRail data={data()} params={parseListingParams({})} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Any price' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('AppliedFilters', () => {
  it('renders nothing without active filters', () => {
    renderWithProviders(<AppliedFilters data={data()} params={parseListingParams({ sort: 'newest' })} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows a chip per active filter and removing one keeps the rest', async () => {
    renderWithProviders(<AppliedFilters data={data()} params={parseListingParams({ category: 'bakery', price: 'lt-500', stock: 'out', page: '2' })} />);
    const list = screen.getByRole('list', { name: 'Applied filters' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(within(list).getByRole('button', { name: 'Remove filter: Under $5.00' }));
    expect(replace).toHaveBeenCalledWith('/shop?category=bakery&stock=out');
  });

  it('an unknown category slug produces no chip', () => {
    renderWithProviders(<AppliedFilters data={data()} params={parseListingParams({ category: 'nope' })} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('ListingToolbar', () => {
  it('shows the result count', () => {
    renderWithProviders(<ListingToolbar total={36} params={parseListingParams({})} />);
    expect(screen.getByText('36 products')).toBeInTheDocument();
  });

  it('single result label reads "1 product"', () => {
    renderWithProviders(<ListingToolbar total={1} params={parseListingParams({})} />);
    expect(screen.getByText('1 product')).toBeInTheDocument();
  });

  it('German plural', () => {
    renderWithProviders(<ListingToolbar total={1} params={parseListingParams({})} />, { locale: 'de-DE' });
    expect(screen.getByText('1 Produkt')).toBeInTheDocument();
  });

  it('Sort by price: selecting "Price ↑" updates the URL and keeps filters', async () => {
    renderWithProviders(<ListingToolbar total={36} params={parseListingParams({ category: 'bakery', page: '2' })} />);
    const group = screen.getByRole('radiogroup', { name: 'Sort by' });
    expect(within(group).getByRole('radio', { name: 'Relevance' })).toBeChecked();
    await userEvent.click(within(group).getByRole('radio', { name: 'Price ↑' }));
    expect(replace).toHaveBeenCalledWith('/shop?category=bakery&sort=price-asc');
  });

  it('mobile select offers the same sorts', async () => {
    renderWithProviders(<ListingToolbar total={36} params={parseListingParams({ sort: 'newest' })} />);
    const select = screen.getByRole('combobox', { name: 'Sort by' });
    expect(select).toHaveValue('newest');
    await userEvent.selectOptions(select, 'price-desc');
    expect(replace).toHaveBeenCalledWith('/shop?sort=price-desc');
  });
});
