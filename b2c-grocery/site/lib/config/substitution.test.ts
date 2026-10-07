import { describe, it, expect } from 'vitest';
import type { Category } from '../types';
import { categoryKeysOf, defaultSubstitutionPreference } from './substitution';

describe('defaultSubstitutionPreference', () => {
  it('chilled product: allow-similar', () => {
    expect(defaultSubstitutionPreference({ storage: 'chilled' })).toBe('allow-similar');
  });

  it.each(['fresh-produce', 'dairy-eggs', 'bakery'])('ambient product in %s: allow-similar', (key) => {
    expect(defaultSubstitutionPreference({ storage: 'ambient' }, [key])).toBe('allow-similar');
  });

  it('ambient household product: none', () => {
    expect(defaultSubstitutionPreference({ storage: 'ambient' }, ['household'])).toBe('none');
  });

  it('no storage and no categories: none', () => {
    expect(defaultSubstitutionPreference({})).toBe('none');
  });
});

describe('categoryKeysOf', () => {
  const tree: Category[] = [
    { id: 'c1', key: 'bakery', name: 'Bakery', slug: 'bakery', children: [{ id: 'c1a', key: 'bread', name: 'Bread', slug: 'bread', parentId: 'c1' }] },
    { id: 'c2', key: 'household', name: 'Household', slug: 'household' },
  ];

  it('resolves ids to keys including children and skips unknown ids', () => {
    expect(categoryKeysOf({ categoryIds: ['c1a', 'c2', 'nope'] }, tree)).toEqual(['bread', 'household']);
  });
});
