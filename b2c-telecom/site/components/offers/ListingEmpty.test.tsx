import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ListingEmpty } from './ListingEmpty';

const LINKS = [
  { key: 'a', name: 'Phone plans', href: '/shop/phone-plans' },
  { key: 'b', name: 'Cable internet', href: '/shop/cable-internet' },
];

describe('ListingEmpty', () => {
  it('Empty category: lists other categories', () => {
    renderWithProviders(<ListingEmpty variant="empty" links={LINKS} />);
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    expect(within(screen.getByRole('region')).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/en-US/shop/phone-plans', '/en-US/shop/cable-internet']);
  });

  it('no match: names the noun and offers to clear the filters', () => {
    renderWithProviders(<ListingEmpty variant="no-match" noun="plans" clearHref="/shop/cable-internet" />);
    expect(screen.getByRole('heading', { name: 'No plans match these filters' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/en-US/shop/cable-internet');
  });

  it('no match for add-ons and in German', () => {
    renderWithProviders(<ListingEmpty variant="no-match" noun="addons" clearHref="/shop/zusatzoptionen" />, { locale: 'de-DE' });
    expect(screen.getByRole('heading', { name: 'Keine Zusatzoptionen passen zu diesen Filtern' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Filter zurücksetzen' })).toBeInTheDocument();
  });
});
