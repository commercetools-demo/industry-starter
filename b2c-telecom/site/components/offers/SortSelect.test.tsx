import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

const replace = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/shop/cable-internet',
}));

import { SortSelect } from './SortSelect';

const PARAMS = { filter: 'up-to-500', sort: 'price-asc', page: 3, offer: null } as const;

describe('SortSelect', () => {
  beforeEach(() => replace.mockClear());

  it('shows the current sort and both options', () => {
    renderWithProviders(<SortSelect params={PARAMS} />);
    const select = screen.getByLabelText('Sort');
    expect(select).toHaveValue('price-asc');
    expect(screen.getByRole('option', { name: 'Price: high to low' })).toBeInTheDocument();
  });

  it('a change only replaces the URL: sort set, chip kept, page reset', async () => {
    renderWithProviders(<SortSelect params={PARAMS} />);
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'price-desc');
    expect(replace).toHaveBeenCalledWith('/shop/cable-internet?filter=up-to-500&sort=price-desc');
  });

  it('back to the default sort leaves the parameter out', async () => {
    renderWithProviders(<SortSelect params={{ ...PARAMS, sort: 'price-desc', filter: null }} />);
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'price-asc');
    expect(replace).toHaveBeenCalledWith('/shop/cable-internet');
  });
});
