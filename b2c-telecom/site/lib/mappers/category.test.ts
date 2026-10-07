import type { Category as SdkCategory } from '@commercetools/platform-sdk';
import type { Category } from '@/lib/types';
import fixture from './__fixtures__/categories.json';
import { breadcrumbTrail, buildCategoryTree, findCategoryBySlug, findDescendantKeys, flattenTree, mapCategory } from './category';

const sdkCategories = fixture as unknown as SdkCategory[];
const map = (locale: string) => sdkCategories.map((category) => mapCategory(category, locale));

describe('category mapper', () => {
  it('maps name, slug, every locale slug, image and order hint', () => {
    const phone = map('en-US').find((category) => category.key === 'malva-cat-phone-plans');
    expect(phone).toMatchObject({ name: 'Phone plans', slug: 'phone-plans', slugs: { 'en-US': 'phone-plans', 'de-DE': 'handytarife' }, orderHint: '0.1' });
    expect(phone?.image).toMatch(/^https:\/\//);
    expect(phone?.parentId).toBeUndefined();
  });

  it('orders roots by order hint and nests the add-on children', () => {
    const tree = buildCategoryTree(map('en-US'));
    expect(tree.map((category) => category.key)).toEqual([
      'malva-cat-phone-plans',
      'malva-cat-home-wireless',
      'malva-cat-cable-internet',
      'malva-cat-add-ons',
      'malva-cat-devices',
    ]);
    expect(tree[3]?.children.map((category) => category.key)).toEqual(['malva-cat-streaming', 'malva-cat-protection', 'malva-cat-equipment']);
  });

  it('falls back to the tie-break order and then the name when hints are missing or equal', () => {
    const base = { slugs: {}, children: [], slug: '' };
    const list = [
      { ...base, id: '1', key: 'malva-cat-devices', name: 'Z' },
      { ...base, id: '2', key: 'malva-cat-phone-plans', name: 'Y' },
      { ...base, id: '3', key: 'other-b', name: 'B' },
      { ...base, id: '4', key: 'other-a', name: 'A' },
    ];
    expect(buildCategoryTree(list).map((category) => category.key)).toEqual(['malva-cat-phone-plans', 'malva-cat-devices', 'other-a', 'other-b']);
  });

  it('treats an orphan as a root and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const orphan = { id: 'x', key: 'orphan-cat', name: 'Orphan', slug: 'o', slugs: {}, parentId: 'missing', children: [] };
    expect(buildCategoryTree([orphan]).map((category) => category.key)).toEqual(['orphan-cat']);
    buildCategoryTree([orphan]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('descendants are inclusive and flatten keeps parents before children', () => {
    const tree = buildCategoryTree(map('en-US'));
    const addOns = tree.find((category) => category.key === 'malva-cat-add-ons');
    expect(findDescendantKeys(addOns as Category)).toEqual(['malva-cat-add-ons', 'malva-cat-streaming', 'malva-cat-protection', 'malva-cat-equipment']);
    expect(flattenTree(tree)).toHaveLength(8);
    expect(breadcrumbTrail(tree, 'malva-cat-equipment').map((category) => category.key)).toEqual(['malva-cat-add-ons', 'malva-cat-equipment']);
    expect(breadcrumbTrail(tree, 'nope')).toEqual([]);
  });

  it('maps de-DE names and slugs', () => {
    const tree = buildCategoryTree(map('de-DE'));
    expect(tree[0]).toMatchObject({ name: 'Handytarife', slug: 'handytarife' });
    expect(tree[1]?.slug).toBe('funk-internet');
  });

  it('finds a category by the slug of the requested locale or of another locale', () => {
    const tree = buildCategoryTree(map('de-DE'));
    expect(findCategoryBySlug(tree, 'handytarife', 'de-DE')).toMatchObject({ matchedLocale: 'de-DE', category: { key: 'malva-cat-phone-plans' } });
    expect(findCategoryBySlug(tree, 'phone-plans', 'de-DE')).toMatchObject({ matchedLocale: 'en-US', category: { key: 'malva-cat-phone-plans' } });
    expect(findCategoryBySlug(tree, 'nope', 'de-DE')).toBeNull();
  });
});
