import { describe, expect, it } from 'vitest';
import { webVisibleTree } from '@/lib/category-tree';
import type { Category } from '@/lib/types';

const cat = (id: string, instoreVisibility?: Category['instoreVisibility'], children: Category[] = []): Category => ({
  id, name: id, slug: id, children, ...(instoreVisibility ? { instoreVisibility } : {}),
});

describe('webVisibleTree', () => {
  it('keeps categories with no visibility, both and onlyOnline; drops onlyInStore and none', () => {
    const tree = [cat('unset'), cat('both', 'both'), cat('online', 'onlyOnline'), cat('store', 'onlyInStore'), cat('none', 'none')];
    expect(webVisibleTree(tree).map((c) => c.id)).toEqual(['unset', 'both', 'online']);
  });

  it('drops a hidden category with its subtree and filters hidden children', () => {
    const tree = [cat('p', undefined, [cat('ok'), cat('hidden', 'onlyInStore')]), cat('h', 'none', [cat('child')])];
    const out = webVisibleTree(tree);
    expect(out.map((c) => c.id)).toEqual(['p']);
    expect(out[0]?.children.map((c) => c.id)).toEqual(['ok']);
  });
});
