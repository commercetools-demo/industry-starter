// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { extraRootCategories, primaryNavFor } from '@/lib/nav/mega-config';
import type { Category } from '@/lib/types';

const cat = (key: string | undefined, slug: string): Category => ({ id: `id-${slug}`, ...(key ? { key } : {}), name: slug, slug, children: [] });

// The fixed entries have no Bundles: a category the owner adds in Merchant Center shows up from the tree instead (D-060).
describe('primary navigation', () => {
  it('lists the five fixed categories for both brands', () => {
    expect(primaryNavFor('malva-coffee').map((i) => i.id)).toEqual(['pods', 'coffee', 'machines', 'accessories', 'gifts']);
    expect(primaryNavFor('malva-drinks').map((i) => i.id)).toEqual(['pods', 'coffee', 'machines', 'accessories', 'gifts']);
  });

  it('adds the root categories no fixed entry points at, in tree order', () => {
    const tree = [cat('bundles', 'bundles'), cat('mcf-cat-pods', 'pods'), cat('mcf-cat-gifts', 'gifts'), cat(undefined, 'no-key')];
    expect(extraRootCategories(tree).map((c) => c.slug)).toEqual(['bundles', 'no-key']);
  });

  it('adds nothing when the tree holds only the fixed categories', () => {
    expect(extraRootCategories([cat('mcf-cat-pods', 'pods'), cat('mcf-cat-coffee', 'coffee')])).toEqual([]);
  });
});
