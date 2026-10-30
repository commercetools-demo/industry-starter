import { describe, expect, it } from 'vitest';
import { instoreVisibleTree, webVisibleTree } from '@/lib/category-tree';
import type { Category } from '@/lib/types';

const cat = (id: string, instoreVisibility?: Category['instoreVisibility'], children: Category[] = []): Category => ({
  id, name: id, slug: id, children, ...(instoreVisibility ? { instoreVisibility } : {}),
});

describe('instoreVisibleTree', () => {
  it('keeps only both and onlyInStore (unset is hidden) and drops hidden subtrees', () => {
    const tree = [cat('unset'), cat('both', 'both', [cat('c1', 'onlyInStore'), cat('c2', 'onlyOnline')]), cat('online', 'onlyOnline', [cat('x', 'both')]), cat('store', 'onlyInStore'), cat('none', 'none')];
    const out = instoreVisibleTree(tree);
    expect(out.map((c) => c.id)).toEqual(['both', 'store']);
    expect(out[0]?.children.map((c) => c.id)).toEqual(['c1']);
  });
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
