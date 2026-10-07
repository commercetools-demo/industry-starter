import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import type { SearchResultItem } from '@/lib/types';
import { SearchResultCard } from './SearchResultCard';

const ITEM: SearchResultItem = {
  offerKey: 'malva-offer-cable-500',
  name: 'Cable 500',
  kind: 'plan',
  categoryKey: 'malva-cat-cable-internet',
  categoryName: 'Cable internet',
  fromPrice: { centAmount: 5999, currencyCode: 'USD' },
  fromPriceRecurring: true,
  matchedSku: null,
  highlight: '500 Mbps download',
  href: '/en-US/shop/cable-internet?offer=malva-offer-cable-500#offer-malva-offer-cable-500',
  path: '/shop/cable-internet?offer=malva-offer-cable-500#offer-malva-offer-cable-500',
};

const card = (item: SearchResultItem, best = false, locale: 'en-US' | 'de-DE' = 'en-US') => renderWithProviders(<ul><SearchResultCard item={item} best={best} /></ul>, { locale });

describe('SearchResultCard', () => {
  it('shows kind, name, category, highlight and the from price', () => {
    card(ITEM);
    expect(screen.getByRole('heading', { name: 'Cable 500' })).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Cable internet')).toBeInTheDocument();
    expect(screen.getByText('500 Mbps download')).toBeInTheDocument();
    expect(screen.getByText('From $59.99/mo')).toBeInTheDocument();
  });

  it('says so when there is no price', () => {
    card({ ...ITEM, fromPrice: null });
    expect(screen.getByText('Price not available')).toBeInTheDocument();
  });

  it('a one-time price has no per-month suffix', () => {
    card({ ...ITEM, fromPrice: { centAmount: 7900, currencyCode: 'USD' }, fromPriceRecurring: false });
    expect(screen.getByText('From $79')).toBeInTheDocument();
  });

  it('shows the part number match with the SKU, and announces the best match', () => {
    card({ ...ITEM, matchedSku: 'MLV-CBL-500-24M' }, true);
    const group = screen.getByRole('group', { name: 'Best match: part number MLV-CBL-500-24M' });
    expect(within(group).getByText('Part number match')).toBeInTheDocument();
    expect(within(group).getByTestId('matched-sku')).toHaveTextContent('MLV-CBL-500-24M');
  });

  it('a card without a part number match has neither the pill nor the group label', () => {
    card(ITEM);
    expect(screen.queryByText('Part number match')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('links to the offer anchor in its listing, never to a detail page', () => {
    card(ITEM);
    const link = screen.getByTestId('result-link');
    expect(link).toHaveAttribute('href', ITEM.href);
    expect(link).toHaveTextContent('View in Cable internet');
    expect(document.body.innerHTML).not.toMatch(/\/p\/|\/products\//);
  });

  it('German chrome and a euro price', () => {
    card({ ...ITEM, kind: 'addon', fromPrice: { centAmount: 5999, currencyCode: 'EUR' }, matchedSku: 'X-1' }, false, 'de-DE');
    expect(screen.getByText('Zusatzoption')).toBeInTheDocument();
    expect(screen.getByText(/^Ab 59,99/)).toHaveTextContent('€/Monat');
    expect(screen.getByText('Treffer bei Artikelnummer')).toBeInTheDocument();
  });
});
