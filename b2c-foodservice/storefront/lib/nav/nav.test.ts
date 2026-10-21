import { describe, expect, it } from 'vitest';
import { buildListingHref } from '@/lib/nav/listing-href';
import { MEGA_CONFIG, findCategoryByKey, missingCategoryKeys, resolveNavHref } from '@/lib/nav/mega-config';
import type { Category } from '@/lib/types';

const cat = (key: string, slug: string, children: Category[] = []): Category => ({ id: key, key, name: slug, slug, children });
const TREE: Category[] = [
  cat('mcf-cat-pods', 'pods-en', [cat('mcf-cat-pods-vertuo', 'vertuo-pods')]),
  cat('mcf-cat-coffee', 'coffee'),
];

describe('buildListingHref', () => {
  it('builds f_ params and comma lists', () => {
    expect(buildListingHref('coffee')).toBe('/category/coffee');
    expect(buildListingHref('coffee', { roast: 'dark' })).toBe('/category/coffee?f_roast=dark');
    expect(buildListingHref('pods', { intensity: [8, 9, 10], decaf: true })).toBe('/category/pods?f_intensity=8,9,10&f_decaf=true');
    expect(buildListingHref('coffee', { brew: 'french-press', skip: undefined })).toBe('/category/coffee?f_brew=french-press');
  });

  it('encodes unsafe characters', () => {
    expect(buildListingHref('a b', { origin: 'São Tomé' })).toBe('/category/a%20b?f_origin=S%C3%A3o%20Tom%C3%A9');
  });
});

describe('mega config', () => {
  it('uses the category slug resolved from the key', () => {
    expect(resolveNavHref(TREE, { labelKey: 'link.vertuo', categoryKey: 'mcf-cat-pods-vertuo' }, 'mcf-cat-pods')).toBe('/category/vertuo-pods');
    expect(resolveNavHref(TREE, { labelKey: 'feature.newIn', params: { collection: 'new' } }, 'mcf-cat-pods')).toBe(
      '/category/pods-en?f_collection=new',
    );
  });

  it('a key missing from the tree resolves to no link', () => {
    expect(resolveNavHref(TREE, { labelKey: 'link.original', categoryKey: 'mcf-cat-pods-original' }, 'mcf-cat-pods')).toBeNull();
    expect(findCategoryByKey(TREE, 'nope')).toBeNull();
    expect(missingCategoryKeys(TREE)).toContain('mcf-cat-machines');
    expect(missingCategoryKeys(TREE)).not.toContain('mcf-cat-coffee');
  });

  it('defines the four menus with five shop links except accessories', () => {
    expect(Object.keys(MEGA_CONFIG)).toEqual(['pods', 'coffee', 'machines', 'accessories']);
    expect(MEGA_CONFIG.pods.shop).toHaveLength(5);
    expect(MEGA_CONFIG.accessories.shop).toHaveLength(4);
  });
});
