import { describe, it, expect } from 'vitest';
import { buildFilterData, findCategoryById, findCategoryBySlug } from './listing-view';
import type { Category, ListingFacets } from './types';

const tree: Category[] = [
  {
    id: 'produce',
    key: 'produce',
    name: 'Produce',
    slug: 'produce',
    children: [{ id: 'fruit', key: 'fruit', name: 'Fruit', slug: 'fruit', parentId: 'produce' }],
  },
  { id: 'bakery', key: 'bakery', name: 'Bakery', slug: 'bakery' },
];
const facets: ListingFacets = {
  categories: [
    { id: 'produce', count: 2 },
    { id: 'fruit', count: 5 },
  ],
  priceBands: [{ id: '500-1500', count: 7 }],
  availability: { inStock: 8, outOfStock: 1 },
};

describe('findCategoryBySlug', () => {
  it('finds roots and nested categories, unknown slug gives undefined', () => {
    expect(findCategoryBySlug(tree, 'bakery')?.id).toBe('bakery');
    expect(findCategoryBySlug(tree, 'fruit')?.id).toBe('fruit');
    expect(findCategoryBySlug(tree, 'nope')).toBeUndefined();
  });
});

describe('buildFilterData', () => {
  const data = buildFilterData({ tree, facets, categoryTotal: 9, currency: 'USD' });

  it('flattens the tree depth first and rolls subcategory counts up into the parent', () => {
    expect(data.categories).toEqual([
      { slug: 'produce', name: 'Produce', count: 7, depth: 0 },
      { slug: 'fruit', name: 'Fruit', count: 5, depth: 1 },
      { slug: 'bakery', name: 'Bakery', count: 0, depth: 0 },
    ]);
    expect(data.total).toBe(9);
  });

  it('lists every configured price band, with 0 for bands missing from the facet', () => {
    expect(data.priceBands.map((b) => [b.id, b.count])).toEqual([
      ['lt-500', 0],
      ['500-1500', 7],
      ['1500-3000', 0],
      ['gt-3000', 0],
    ]);
  });

  it('German bands use the EUR configuration', () => {
    expect(buildFilterData({ tree, facets, categoryTotal: 9, currency: 'EUR' }).currency).toBe('EUR');
  });

  it('passes the availability counts through', () => {
    expect(data.availability).toEqual({ inStock: 8, outOfStock: 1 });
  });
});

describe('findCategoryById', () => {
  it('finds nested categories by id and returns undefined for unknown ids', () => {
    expect(findCategoryById(tree, 'fruit')?.name).toBe('Fruit');
    expect(findCategoryById(tree, 'nope')).toBeUndefined();
  });
});
