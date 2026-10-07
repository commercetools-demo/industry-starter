import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { AppliedFilters } from './AppliedFilters';

const PARAMS = { filter: 'up-to-500', sort: 'price-desc', page: 2, offer: null } as const;

describe('AppliedFilters', () => {
  it('renders nothing without a filter', () => {
    renderWithProviders(<AppliedFilters filter={null} params={{ ...PARAMS, filter: null }} basePath="/shop/cable-internet" />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows the active filter as a removable pill that keeps the sort', () => {
    renderWithProviders(<AppliedFilters filter="up-to-500" params={PARAMS} basePath="/shop/cable-internet" />);
    const pill = screen.getByRole('link', { name: 'Remove filter Up to 500 Mbps' });
    expect(pill).toHaveTextContent('Up to 500 Mbps');
    expect(pill).toHaveAttribute('href', '/en-US/shop/cable-internet?sort=price-desc');
  });

  it('is labelled in German', () => {
    renderWithProviders(<AppliedFilters filter="up-to-500" params={PARAMS} basePath="/shop/kabel-internet" />, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Filter Bis 500 Mbit/s entfernen' })).toBeInTheDocument();
  });
});
