import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseListingParams } from '@/lib/listing-params';
import type { ListingFilterData } from '@/lib/listing-view';
import { renderWithProviders } from '@/test/utils';
import { FiltersSheet } from './FiltersSheet';

const replace = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/shop',
}));

const data: ListingFilterData = {
  currency: 'USD',
  total: 36,
  categories: [{ slug: 'bakery', name: 'Bakery', count: 6, depth: 0 }],
  priceBands: [{ id: 'lt-500', max: 500, count: 10 }],
  availability: { inStock: 33, outOfStock: 3 },
};

beforeEach(() => replace.mockClear());

describe('FiltersSheet', () => {
  it('Tablet filters: the button opens a dialog containing the filters', async () => {
    renderWithProviders(<FiltersSheet data={data} params={parseListingParams({})} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(within(dialog).getByRole('button', { name: /^Bakery/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Under $5.00' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /In stock/ })).toBeInTheDocument();
  });

  it('applying a filter navigates and closes the dialog', async () => {
    renderWithProviders(<FiltersSheet data={data} params={parseListingParams({})} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Under $5.00' }));
    expect(replace).toHaveBeenCalledWith('/shop?price=lt-500');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Escape closes the dialog without navigating', async () => {
    renderWithProviders(<FiltersSheet data={data} params={parseListingParams({})} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('German title', async () => {
    renderWithProviders(<FiltersSheet data={data} params={parseListingParams({})} />, { locale: 'de-DE' });
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByRole('dialog', { name: 'Filter' })).toBeInTheDocument();
  });
});
