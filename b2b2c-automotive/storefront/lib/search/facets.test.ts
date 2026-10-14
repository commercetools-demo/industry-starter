// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { buildFacetGroups, humanizeKey } from './facets';
import { parseListingParams } from './params';

const facets = [
  { name: 'brand', buckets: [{ key: 'vektra', count: 12 }, { key: 'alpendyn', count: 3 }, { key: 'malva-select', count: 1 }] },
  { name: 'quality-tier', buckets: [{ key: 'premium', count: 9 }] },
  { name: 'position', buckets: [{ key: 'rear', count: 2 }, { key: 'front', count: 7 }] },
];
const labels = { brand: { vektra: 'Vektra', alpendyn: 'Alpendyn', 'malva-select': 'Malva Select' }, position: { front: 'Front', rear: 'Rear' } };

describe('Brand options follow the result set: lib/search/facets', () => {
  it('brand list only has brands from the result facet and is alphabetical', () => {
    const groups = buildFacetGroups(facets, parseListingParams({}), labels);
    const brand = groups.find((g) => g.name === 'brand');
    expect(brand?.options.map((o) => o.label)).toEqual(['Alpendyn', 'Malva Select', 'Vektra']);
    expect(brand?.options.map((o) => o.count)).toEqual([3, 1, 12]);
    expect(brand?.param).toBe('brand');
  });

  it('a part facet needs at least two values in the result', () => {
    const groups = buildFacetGroups(facets, parseListingParams({}), labels);
    expect(groups.map((g) => g.name)).toEqual(['brand', 'position']);
    expect(groups.find((g) => g.name === 'position')?.param).toBe('attr.position');
  });

  it('marks the selected values from the address', () => {
    const groups = buildFacetGroups(facets, parseListingParams({ brand: ['vektra'], 'attr.position': 'front' }), labels);
    expect(groups.find((g) => g.name === 'brand')?.options.filter((o) => o.selected).map((o) => o.key)).toEqual(['vektra']);
    expect(groups.find((g) => g.name === 'position')?.options.filter((o) => o.selected).map((o) => o.key)).toEqual(['front']);
  });

  it('a selected value stays listed with count 0 when the facet no longer has it', () => {
    const groups = buildFacetGroups(facets, parseListingParams({ brand: ['kestrel'] }), labels);
    expect(groups.find((g) => g.name === 'brand')?.options.find((o) => o.key === 'kestrel')).toEqual({ key: 'kestrel', label: 'Kestrel', count: 0, selected: true });
  });

  it('a missing label falls back to the humanised key', () => {
    const groups = buildFacetGroups(facets, parseListingParams({}), {});
    expect(groups.find((g) => g.name === 'brand')?.options.map((o) => o.label)).toEqual(['Alpendyn', 'Malva Select', 'Vektra']);
    expect(humanizeKey('not-applicable')).toBe('Not Applicable');
  });

  it('no facets in the response means no groups', () => {
    expect(buildFacetGroups([], parseListingParams({}), labels)).toEqual([]);
  });
});
