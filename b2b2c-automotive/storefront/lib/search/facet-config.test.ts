// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_FACETS, FACETS } from './facet-config';

describe('Filter set: lib/search/facet-config', () => {
  it('enum fields point at .key', () => {
    for (const f of FACETS) {
      expect(f.fieldType).toBe('enum');
      expect(f.field).toBe(`variants.attributes.${f.name}.key`);
    }
  });

  it('every facet has a param', () => {
    for (const f of FACETS) expect(f.param).toMatch(/^(brand|attr\.[a-z-]+)$/);
    expect(new Set(FACETS.map((f) => f.param)).size).toBe(FACETS.length);
  });

  it('brand is the first facet and the others are attribute facets', () => {
    expect(FACETS[0].name).toBe('brand');
    expect(ATTRIBUTE_FACETS.map((f) => f.name)).toEqual(['quality-tier', 'position']);
    for (const f of ATTRIBUTE_FACETS) expect(f.param).toBe(`attr.${f.name}`);
  });
});
