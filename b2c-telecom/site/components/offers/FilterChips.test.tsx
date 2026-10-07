import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import type { ListingParams } from '@/lib/types';
import { FilterChips } from './FilterChips';

const PARAMS: ListingParams = { filter: null, sort: 'price-asc', page: 1, offer: null };
const CABLE = [
  { id: 'all', count: 3 },
  { id: 'up-to-500', count: 2 },
  { id: '1-gbps', count: 1 },
];

describe('FilterChips', () => {
  it('renders every chip as a link, All active when no filter is set', () => {
    renderWithProviders(<FilterChips chips={CABLE} active={null} params={PARAMS} basePath="/shop/cable-internet" />);
    const nav = screen.getByRole('navigation', { name: 'Filter' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['All', 'Up to 500 Mbps', '1 Gbps']);
    expect(within(nav).getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'true');
  });

  it('hrefs carry the chip and leave defaults out', () => {
    renderWithProviders(<FilterChips chips={CABLE} active={null} params={{ ...PARAMS, page: 2 }} basePath="/shop/cable-internet" />);
    expect(screen.getByRole('link', { name: 'Up to 500 Mbps' })).toHaveAttribute('href', '/en-US/shop/cable-internet?filter=up-to-500');
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/en-US/shop/cable-internet');
  });

  it('the sort stays when a chip changes, the page resets', () => {
    renderWithProviders(<FilterChips chips={CABLE} active={null} params={{ ...PARAMS, sort: 'price-desc', page: 3 }} basePath="/shop/cable-internet" />);
    expect(screen.getByRole('link', { name: '1 Gbps' })).toHaveAttribute('href', '/en-US/shop/cable-internet?filter=1-gbps&sort=price-desc');
  });

  it('the active chip is marked and a click on it removes the filter', () => {
    renderWithProviders(<FilterChips chips={CABLE} active="1-gbps" params={{ ...PARAMS, filter: '1-gbps' }} basePath="/shop/cable-internet" />);
    const active = screen.getByRole('link', { name: '1 Gbps' });
    expect(active).toHaveAttribute('aria-current', 'true');
    expect(active).toHaveAttribute('href', '/en-US/shop/cable-internet');
    expect(screen.getByRole('link', { name: 'All' })).not.toHaveAttribute('aria-current');
  });

  it('a chip with no offers is disabled, not removed', () => {
    renderWithProviders(
      <FilterChips
        chips={[{ id: 'all', count: 4 }, { id: 'music', count: 2 }, { id: 'video', count: 2 }, { id: 'extras', count: 0 }]}
        active={null}
        params={PARAMS}
        basePath="/shop/add-ons"
      />,
    );
    const extras = screen.getByText('Extras');
    expect(extras).toHaveAttribute('aria-disabled', 'true');
    expect(extras.closest('a')).toBeNull();
  });

  it('is hidden when fewer than two chips besides All have offers', () => {
    renderWithProviders(
      <FilterChips chips={[{ id: 'all', count: 5 }, { id: 'music', count: 0 }, { id: 'video', count: 0 }]} active={null} params={PARAMS} basePath="/shop/routers-and-equipment" />,
    );
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('labels come from the locale (de-DE)', () => {
    renderWithProviders(<FilterChips chips={CABLE} active={null} params={PARAMS} basePath="/shop/kabel-internet" />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Bis 500 Mbit/s' })).toHaveAttribute('href', '/de-DE/shop/kabel-internet?filter=up-to-500');
    expect(screen.getByRole('link', { name: '1 Gbit/s' })).toBeInTheDocument();
  });
});
