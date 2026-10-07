import { screen, within } from '@testing-library/react';
import { HOME_CONFIG } from '@/lib/config/home';
import { categoryTiles } from '@/lib/home/derive';
import { renderWithProviders } from '@/test/utils';
import { HOME_TREE, OFFERS_BY_CATEGORY } from './__fixtures__/home';
import { CategoryTiles } from './CategoryTiles';

const tiles = (offers = OFFERS_BY_CATEGORY, tree = HOME_TREE) => categoryTiles(tree, offers, HOME_CONFIG.hiddenCategoryKeys);

describe('CategoryTiles', () => {
  it('shows four tiles in tree order with from prices and "Browse all" for add-ons', () => {
    renderWithProviders(<CategoryTiles locale="en-US" tiles={tiles()} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    const names = items.map((item) => within(item).getByRole('link').textContent ?? '');
    expect(names[0]).toContain('Phone plans');
    expect(names[1]).toContain('Wireless internet');
    expect(names[2]).toContain('Cable internet');
    expect(names[3]).toContain('Add-ons');
    expect(within(items[0]!).getByText('From $25/mo →')).toBeInTheDocument();
    expect(within(items[2]!).getByText('From $39.99/mo →')).toBeInTheDocument();
    expect(within(items[3]!).getByText('Browse all →')).toBeInTheDocument();
    expect(within(items[2]!).getByRole('link')).toHaveAttribute('href', '/en-US/shop/cable-internet');
    expect(screen.queryByText('Phones and devices')).not.toBeInTheDocument();
  });

  it('a new category in the tree appears without a code change and has no blurb', () => {
    const tree = [...HOME_TREE, { id: 'id-new', key: 'malva-cat-new', name: 'Brand new', slug: 'brand-new', slugs: { 'en-US': 'brand-new', 'de-DE': 'neu' }, children: [] }];
    renderWithProviders(<CategoryTiles locale="en-US" tiles={tiles(OFFERS_BY_CATEGORY, tree)} />);
    const link = screen.getByRole('link', { name: /Brand new/ });
    expect(link).toHaveAttribute('href', '/en-US/shop/brand-new');
    expect(within(link).getByText('Browse all →')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('de-DE shows the German title, the blurb and euro prices', () => {
    const eur = Object.fromEntries(
      Object.entries(OFFERS_BY_CATEGORY).map(([key, list]) => [
        key,
        list.map((offer) => ({ ...offer, headline: { ...offer.headline, recurring: offer.headline.recurring && { ...offer.headline.recurring, currencyCode: 'EUR' } } })),
      ]),
    );
    renderWithProviders(<CategoryTiles locale="de-DE" tiles={tiles(eur)} />, { locale: 'de-DE' });
    expect(screen.getByText('Nach Kategorie einkaufen')).toBeInTheDocument();
    expect(screen.getAllByText(/^Ab .*€\/Monat →$/)).toHaveLength(3);
    expect(screen.getByText('Alle ansehen →')).toBeInTheDocument();
  });

  it('renders nothing without tiles', () => {
    renderWithProviders(<CategoryTiles locale="en-US" tiles={[]} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
