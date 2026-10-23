import { describe, expect, it } from 'vitest';
import { buildFacetGroups, type FacetViewContext } from '@/lib/search/facets';
import { parseListingParams } from '@/lib/search/params';
import type { Category } from '@/lib/types';

const cat = (id: string, key: string, name: string, parentId?: string): Category => ({ id, key, name, slug: key, ...(parentId ? { parentId } : {}), children: [] });
const tree: Category[] = [{ ...cat('c-pods', 'mcf-cat-pods', 'Pods'), children: [cat('c-orig', 'mcf-cat-pods-original', 'Original', 'c-pods'), cat('c-vert', 'mcf-cat-pods-vertuo', 'Vertuo', 'c-pods')] }];

const ctx: FacetViewContext = {
  root: null, tree, attributeLabels: { roast: { dark: 'Dark', light: 'Light', medium: 'Medium' } },
  groupLabel: (f) => f, valueLabel: (f, v) => `${f}:${v}`,
  hrefFor: (f, v) => `/shop?f_${f}=${v}`,
};
const params = (sp: Record<string, string> = {}) => parseListingParams(sp, 'shop');

describe('buildFacetGroups', () => {
  it('Faceted counts: options show the counts of their own group computed against the other groups', () => {
    const raw = [{ name: 'roast', buckets: [{ key: 'dark', count: 5 }, { key: 'light', count: 2 }, { key: 'medium', count: 7 }] }];
    const g = buildFacetGroups(raw, params({ f_roast: 'dark' }), ctx).find((x) => x.name === 'roast')!;
    expect(g.options.map((o) => [o.value, o.label, o.count, o.selected])).toEqual([
      ['light', 'Light', 2, false], ['medium', 'Medium', 7, false], ['dark', 'Dark', 5, true],
    ]);
    expect(g.selectedCount).toBe(1);
  });
  it('Dead end avoided: a zero count option is reported with count 0 and not selected', () => {
    const raw = [{ name: 'intensity', buckets: [{ key: '8', count: 3 }, { key: '9', count: 0 }] }];
    const g = buildFacetGroups(raw, params(), ctx).find((x) => x.name === 'intensity')!;
    expect(g.options).toHaveLength(13);
    expect(g.options.find((o) => o.value === '9')).toMatchObject({ count: 0, selected: false });
    expect(g.options.find((o) => o.value === '8')).toMatchObject({ count: 3 });
    expect(g.control).toBe('grid');
  });
  it('group hidden when no buckets and nothing selected, kept when selected', () => {
    expect(buildFacetGroups([{ name: 'roast', buckets: [] }], params(), ctx).some((g) => g.name === 'roast')).toBe(false);
    const kept = buildFacetGroups([{ name: 'roast', buckets: [{ key: 'dark', count: 0 }] }], params({ f_roast: 'dark' }), ctx);
    expect(kept.find((g) => g.name === 'roast')?.options[0]).toMatchObject({ selected: true, count: 0 });
  });
  it('option links carry the new URL', () => {
    const g = buildFacetGroups([{ name: 'roast', buckets: [{ key: 'dark', count: 1 }] }], params(), ctx)[0]!;
    expect(g.options[0]!.href).toBe('/shop?f_roast=dark');
  });
  it('category ids map to keys, roots and the scope are not offered', () => {
    const raw = [{ name: 'category', buckets: [{ key: 'c-orig', count: 4 }, { key: 'c-pods', count: 9 }, { key: 'c-vert', count: 6 }] }];
    const g = buildFacetGroups(raw, params(), { ...ctx, scopeCategoryId: 'c-vert' }).find((x) => x.name === 'category')!;
    expect(g.options.map((o) => o.value)).toEqual(['mcf-cat-pods-original']);
  });
  it('collection counts come from count facets; boolean facets use the group label', () => {
    const raw = [
      { name: 'collection:bestseller', value: 3 }, { name: 'collection:new', value: 0 },
      { name: 'decaf', buckets: [{ key: 'true', count: 2 }, { key: 'false', count: 30 }] },
    ];
    const gs = buildFacetGroups(raw, params(), ctx);
    expect(gs.find((g) => g.name === 'collection')!.options.map((o) => [o.value, o.count])).toEqual([
      ['bestseller', 3], ['new', 0], ['limited-edition', 0], ['subscribable', 0],
    ]);
    expect(gs.find((g) => g.name === 'decaf')!.options).toEqual([expect.objectContaining({ value: 'true', label: 'decaf', count: 2 })]);
  });
  it('colour options carry the colour key; price and rating are radios', () => {
    const raw = [
      { name: 'colour', buckets: [{ key: 'red', count: 1 }] },
      { name: 'price', buckets: [{ key: 'p1', count: 4 }] }, { name: 'rating', buckets: [{ key: '4.5', count: 2 }] },
    ];
    const gs = buildFacetGroups(raw, params(), ctx);
    expect(gs.find((g) => g.name === 'colour')!.options[0]).toMatchObject({ colour: 'red', label: 'Red' });
    expect(gs.find((g) => g.name === 'price')!.control).toBe('radio');
    expect(gs.find((g) => g.name === 'rating')!.options.map((o) => o.value)).toEqual(['4.5', '4.0']);
  });
  it('scope root limits the groups', () => {
    const raw = [{ name: 'roast', buckets: [{ key: 'dark', count: 1 }] }, { name: 'system', buckets: [{ key: 'vertuo', count: 1 }] }];
    const names = buildFacetGroups(raw, params(), { ...ctx, root: 'pods' }).map((g) => g.name);
    expect(names).toContain('system');
    expect(names).not.toContain('roast');
  });
});
