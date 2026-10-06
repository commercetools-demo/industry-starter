import { screen, within } from '@testing-library/react';
import { buildShowcaseItems } from '@/lib/home-view';
import type { Category } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';
import { CategoryShowcase } from './CategoryShowcase';

const names = ['Fresh Produce', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Drinks', 'Household'];
const keys = ['fresh-produce', 'dairy-eggs', 'bakery', 'pantry', 'drinks', 'household'];
const tree: Category[] = keys.map((key, i) => ({ id: `c${i}`, key, name: names[i], slug: key }));
const facets = { categories: [{ id: 'c0', count: 12 }, { id: 'c1', count: 3 }, { id: 'c2', count: 6 }] };

describe('CategoryShowcase', () => {
  it('Category click: six cards, each linking to the filtered listing', () => {
    renderWithProviders(<CategoryShowcase items={buildShowcaseItems(tree, facets)} />);
    const links = within(screen.getByRole('list')).getAllByRole('link');
    expect(links).toHaveLength(6);
    keys.forEach((key, i) => expect(links[i]).toHaveAttribute('href', `/en-US/shop?category=${key}`));
    expect(screen.getByRole('link', { name: 'Everything →' })).toHaveAttribute('href', '/en-US/shop');
  });

  it('formats the count with two digits', () => {
    renderWithProviders(<CategoryShowcase items={buildShowcaseItems(tree, facets)} />);
    expect(screen.getByText('12 items')).toBeInTheDocument();
    expect(screen.getByText('03 items')).toBeInTheDocument();
    expect(screen.getByText('06 items')).toBeInTheDocument();
    expect(screen.getAllByText('00 items')).toHaveLength(3);
  });

  it('Missing count: omitted when facets are unknown', () => {
    renderWithProviders(<CategoryShowcase items={buildShowcaseItems(tree, undefined)} />);
    expect(screen.queryByText(/items/)).toBeNull();
    expect(screen.getAllByRole('link', { name: /Fresh Produce/ })).toHaveLength(1);
  });

  it('German count label', () => {
    renderWithProviders(<CategoryShowcase items={buildShowcaseItems(tree, facets)} />, { locale: 'de-DE' });
    expect(screen.getByText('12 Artikel')).toBeInTheDocument();
  });

  it('renders nothing without categories', () => {
    const { container } = renderWithProviders(<CategoryShowcase items={[]} />);
    expect(container.querySelector('[data-section="categories"]')).toBeNull();
  });
});

describe('buildShowcaseItems', () => {
  it('takes the first six roots and rolls subcategory counts up', () => {
    const nested: Category[] = [
      { id: 'a', key: 'fresh-produce', name: 'A', slug: 'a', children: [{ id: 'a1', key: 'x', name: 'X', slug: 'x', parentId: 'a' }] },
      ...tree.slice(1),
      { id: 'extra', key: 'extra', name: 'Extra', slug: 'extra' },
    ];
    const items = buildShowcaseItems(nested, { categories: [{ id: 'a', count: 2 }, { id: 'a1', count: 5 }] });
    expect(items).toHaveLength(6);
    expect(items[0].count).toBe(7);
    expect(items[0].image).toMatch(/^https:\/\//);
  });

  it('an empty category facet means unknown, not zero', () => {
    expect(buildShowcaseItems(tree, { categories: [] })[0].count).toBeUndefined();
  });
});
