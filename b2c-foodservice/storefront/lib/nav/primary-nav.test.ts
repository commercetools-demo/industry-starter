// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { primaryNavFor } from '@/lib/nav/mega-config';

describe('Bundles in the primary navigation (V-18)', () => {
  it('Malva Coffee lists Bundles after Gifts, pointing at the bundles category', () => {
    const items = primaryNavFor('malva-coffee');
    expect(items.map((i) => i.id)).toEqual(['pods', 'coffee', 'machines', 'accessories', 'gifts', 'bundles']);
    expect(items.find((i) => i.id === 'bundles')).toMatchObject({ categoryKey: 'mcf-cat-bundles', hasMenu: false });
  });

  it('Malva Drinks shows no Bundles entry', () => {
    expect(primaryNavFor('malva-drinks').map((i) => i.id)).not.toContain('bundles');
  });
});
