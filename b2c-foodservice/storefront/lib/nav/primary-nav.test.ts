// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { primaryNavFor } from '@/lib/nav/mega-config';

// The header has no hardcoded Bundles entry: the owner adds the Bundles category to the navigation (D-060).
describe('primary navigation', () => {
  it('lists the five categories for Malva Coffee, with no Bundles entry', () => {
    expect(primaryNavFor('malva-coffee').map((i) => i.id)).toEqual(['pods', 'coffee', 'machines', 'accessories', 'gifts']);
  });

  it('lists the same five categories for Malva Drinks', () => {
    expect(primaryNavFor('malva-drinks').map((i) => i.id)).toEqual(['pods', 'coffee', 'machines', 'accessories', 'gifts']);
  });
});
