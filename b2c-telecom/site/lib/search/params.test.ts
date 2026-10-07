import { MAX_QUERY_LENGTH } from '@/lib/config/search';
import { isSearchableQuery, looksLikeSku, normalizeQuery, parseSearchParams, toSearchQueryString, withSearchChange } from './params';

const CATEGORIES = ['malva-cat-cable-internet', 'malva-cat-add-ons'];

describe('parseSearchParams', () => {
  it('trims and collapses whitespace in q', () => {
    expect(parseSearchParams({ q: '  cable \t  500 ' }, CATEGORIES).q).toBe('cable 500');
  });

  it('cuts q at 100 characters', () => {
    expect(parseSearchParams({ q: 'a'.repeat(150) }, CATEGORIES).q).toHaveLength(MAX_QUERY_LENGTH);
  });

  it('a one-character query is not searchable (start state)', () => {
    expect(isSearchableQuery(parseSearchParams({ q: ' a ' }, CATEGORIES).q)).toBe(false);
    expect(isSearchableQuery('ab')).toBe(true);
  });

  it('ignores an invalid sort, category and page', () => {
    expect(parseSearchParams({ q: 'x', sort: 'newest', category: 'nope', page: 'abc' }, CATEGORIES)).toEqual({ q: 'x', category: null, sort: 'relevance', page: 1 });
    expect(parseSearchParams({ page: '0' }, CATEGORIES).page).toBe(1);
    expect(parseSearchParams({ page: '-3' }, CATEGORIES).page).toBe(1);
  });

  it('keeps a valid category, sort and page and takes the first of repeated values', () => {
    expect(parseSearchParams({ q: ['one', 'two'], category: 'malva-cat-add-ons', sort: 'price-desc', page: '3' }, CATEGORIES)).toEqual({
      q: 'one',
      category: 'malva-cat-add-ons',
      sort: 'price-desc',
      page: 3,
    });
  });
});

describe('toSearchQueryString and withSearchChange', () => {
  it('omits defaults', () => {
    expect(toSearchQueryString({ q: 'cable', category: null, sort: 'relevance', page: 1 })).toBe('?q=cable');
    expect(toSearchQueryString({ q: '', category: null, sort: 'relevance', page: 1 })).toBe('');
  });

  it('serialises every non-default parameter', () => {
    expect(toSearchQueryString({ q: 'a b', category: 'malva-cat-add-ons', sort: 'price-asc', page: 2 })).toBe('?q=a+b&category=malva-cat-add-ons&sort=price-asc&page=2');
  });

  it('resets the page when q, category or sort change, but not when only the page changes', () => {
    const current = { q: 'cable', category: null, sort: 'relevance' as const, page: 3 };
    expect(withSearchChange(current, { sort: 'price-asc' }).page).toBe(1);
    expect(withSearchChange(current, { category: 'malva-cat-add-ons' }).page).toBe(1);
    expect(withSearchChange(current, { q: 'router' }).page).toBe(1);
    expect(withSearchChange(current, { page: 4 }).page).toBe(4);
  });
});

describe('normalizeQuery and looksLikeSku', () => {
  it('normalises', () => {
    expect(normalizeQuery('  a   b ')).toBe('a b');
  });

  it('recognises an identifier-shaped query', () => {
    expect(looksLikeSku('MLV-CBL-500-24M')).toBe(true);
    expect(looksLikeSku('mlv-cbl-500-24m')).toBe(true);
    expect(looksLikeSku('cable 500')).toBe(false);
    expect(looksLikeSku('ab')).toBe(false);
  });
});
