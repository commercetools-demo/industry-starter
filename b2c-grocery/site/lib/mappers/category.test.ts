import { describe, it, expect } from 'vitest';
import type { Category as SdkCategory } from '@commercetools/platform-sdk';
import fixture from './__fixtures__/categories.json';
import { buildCategoryTree, mapCategory } from './category';

const sdk = (o: { id: string; key?: string; parent?: string; orderHint?: string; name?: Record<string, string>; slug?: Record<string, string> }): SdkCategory =>
  ({
    id: o.id,
    key: o.key ?? o.id,
    name: o.name ?? { 'en-US': o.id },
    slug: o.slug ?? { 'en-US': o.id },
    orderHint: o.orderHint,
    ...(o.parent ? { parent: { typeId: 'category', id: o.parent } } : {}),
  }) as unknown as SdkCategory;

describe('mapCategory', () => {
  it('maps real fixture: key, localized name and slug', () => {
    const [first] = fixture as unknown as SdkCategory[];
    expect(mapCategory(first, 'de-DE')).toEqual({
      id: first.id,
      key: 'fresh-produce',
      name: 'Frisches Obst & Gemüse',
      slug: 'obst-gemuese',
    });
  });

  it('locale fallback: missing de-DE falls back to the available locale', () => {
    expect(mapCategory(sdk({ id: 'a', name: { 'en-US': 'Bakery' }, slug: { 'en-US': 'bakery' } }), 'de-DE')).toMatchObject({ name: 'Bakery', slug: 'bakery' });
  });

  it('keeps parentId', () => {
    expect(mapCategory(sdk({ id: 'b', parent: 'a' }), 'en-US').parentId).toBe('a');
  });
});

describe('buildCategoryTree', () => {
  it('real fixture: six roots in orderHint order', () => {
    const tree = buildCategoryTree(fixture as unknown as SdkCategory[], 'en-US');
    expect(tree.map((c) => c.key)).toEqual(['fresh-produce', 'dairy-eggs', 'bakery', 'pantry', 'drinks', 'household']);
    expect(tree.every((c) => c.children === undefined)).toBe(true);
  });

  it('nests children under their parent and sorts siblings by orderHint', () => {
    const tree = buildCategoryTree(
      [
        sdk({ id: 'child-b', parent: 'root', orderHint: '0.2' }),
        sdk({ id: 'root', orderHint: '0.1' }),
        sdk({ id: 'child-a', parent: 'root', orderHint: '0.1' }),
        sdk({ id: 'grand', parent: 'child-a', orderHint: '0.1' }),
      ],
      'en-US',
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].children?.map((c) => c.id)).toEqual(['child-a', 'child-b']);
    expect(tree[0].children?.[0].children?.map((c) => c.id)).toEqual(['grand']);
  });

  it('orphan parent: category is treated as a root', () => {
    const tree = buildCategoryTree([sdk({ id: 'x', parent: 'missing', orderHint: '0.1' }), sdk({ id: 'y', orderHint: '0.2' })], 'en-US');
    expect(tree.map((c) => c.id)).toEqual(['x', 'y']);
    expect(tree[0].parentId).toBe('missing');
  });

  it('missing orderHint sorts last', () => {
    const tree = buildCategoryTree([sdk({ id: 'none' }), sdk({ id: 'one', orderHint: '0.1' })], 'en-US');
    expect(tree.map((c) => c.id)).toEqual(['one', 'none']);
  });

  it('empty input: empty tree', () => {
    expect(buildCategoryTree([], 'en-US')).toEqual([]);
  });
});
