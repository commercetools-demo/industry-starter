// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryDrafts } from './data/categories';

describe('Bundles category (V-03)', () => {
  it('is top level, and carries no in-store visibility (online only)', () => {
    const bundles = CATEGORIES.find((c) => c.key === 'mcf-cat-bundles');
    expect(bundles?.parent).toBeUndefined();
    const draft = categoryDrafts().find((c) => c.key === 'mcf-cat-bundles');
    expect(draft).toBeDefined();
    expect(draft).not.toHaveProperty('custom');
  });

  it('sorts after Gifts among the top-level categories', () => {
    const tops = categoryDrafts().filter((c) => !c.parent).map((c) => c.key);
    expect(tops.slice(-2)).toEqual(['mcf-cat-gifts', 'mcf-cat-bundles']);
  });
});
