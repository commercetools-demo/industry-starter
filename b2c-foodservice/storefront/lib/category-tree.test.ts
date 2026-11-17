import { describe, expect, it } from 'vitest';
import { instoreVisibleTree, webVisibleTree } from '@/lib/category-tree';
import type { Category } from '@/lib/types';

const cat = (id: string, instoreVisibility?: Category['instoreVisibility'], children: Category[] = []): Category => ({
  id, name: id, slug: id, children, ...(instoreVisibility ? { instoreVisibility } : {}),
});

describe('instoreVisibleTree', () => {
  it('keeps only onlyBarista and allThree (unset, both and onlyInStore are hidden) and drops hidden subtrees', () => {
    const tree = [
      cat('unset'), cat('both', 'both'), cat('store', 'onlyInStore'), cat('none', 'none'),
      cat('all', 'allThree', [cat('c1', 'onlyBarista'), cat('c2', 'onlyInStore'), cat('c3', 'allThree')]),
      cat('online', 'onlyOnline', [cat('x', 'allThree')]), cat('barista', 'onlyBarista'),
    ];
    const out = instoreVisibleTree(tree);
    expect(out.map((c) => c.id)).toEqual(['all', 'barista']);
    expect(out[0]?.children.map((c) => c.id)).toEqual(['c1', 'c3']);
  });
});

describe('webVisibleTree', () => {
  it('keeps categories with no visibility, both, onlyOnline and allThree; drops onlyInStore, onlyBarista and none', () => {
    const tree = [cat('unset'), cat('both', 'both'), cat('online', 'onlyOnline'), cat('all', 'allThree'), cat('store', 'onlyInStore'), cat('barista', 'onlyBarista'), cat('none', 'none')];
    expect(webVisibleTree(tree).map((c) => c.id)).toEqual(['unset', 'both', 'online', 'all']);
  });

  it('drops a hidden category with its subtree and filters hidden children', () => {
    const tree = [cat('p', undefined, [cat('ok'), cat('hidden', 'onlyInStore')]), cat('h', 'none', [cat('child')])];
    const out = webVisibleTree(tree);
    expect(out.map((c) => c.id)).toEqual(['p']);
    expect(out[0]?.children.map((c) => c.id)).toEqual(['ok']);
  });
});
