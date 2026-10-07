import type { Category } from '@/lib/types';

const getCategoryTree = vi.fn();
vi.mock('@/lib/ct/categories', () => ({ getCategoryTree: (locale: string) => getCategoryTree(locale) }));

import { loadNavItems } from './loadNavItems';

const TREE: Category[] = [
  { id: '1', key: 'malva-cat-phone-plans', name: 'Phone plans', slug: 'phone-plans', slugs: { 'en-US': 'phone-plans', 'de-DE': 'handytarife' }, children: [] },
];

describe('loadNavItems', () => {
  it('maps the root categories to nav items', async () => {
    getCategoryTree.mockResolvedValue(TREE);
    await expect(loadNavItems('en-US')).resolves.toEqual([
      { key: 'malva-cat-phone-plans', label: 'Phone plans', path: '/shop/phone-plans', matchSlugs: ['phone-plans', 'handytarife'] },
    ]);
    expect(getCategoryTree).toHaveBeenCalledWith('en-US');
  });

  it('a failing tree read logs and returns no items instead of throwing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getCategoryTree.mockRejectedValue(new Error('upstream down'));
    await expect(loadNavItems('en-US')).resolves.toEqual([]);
    expect(spy).toHaveBeenCalledWith('[shell] category tree unavailable');
    spy.mockRestore();
  });
});
