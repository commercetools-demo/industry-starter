/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { buildPartSearchBody, catalogHref, OE_ATTRIBUTE, PART_NUMBER_ATTRIBUTE, resolveEnter, MIN_QUERY } from './search';

const hits = [
  { sku: 'FX-BRAKE-001', name: 'Brake disc', oe: 'OE-34116-001' },
  { sku: 'FX-BRAKE-002', name: 'Brake pad set' },
];

describe('portal search', () => {
  it('exact SKU navigates to the catalog filter', () => {
    expect(resolveEnter('fx-brake-001', hits)).toEqual({ kind: 'navigate', href: '/catalog?tab=assortment&sku=FX-BRAKE-001' });
  });

  it('exact OE number navigates to the part it belongs to', () => {
    expect(resolveEnter('OE-34116-001', hits)).toEqual({ kind: 'navigate', href: catalogHref('FX-BRAKE-001') });
  });

  it('1 character returns nothing', () => {
    expect(MIN_QUERY).toBe(2);
    expect(resolveEnter('b', hits)).toEqual({ kind: 'none' });
    expect(resolveEnter('   ', hits)).toEqual({ kind: 'none' });
  });

  it('VIN shows info', () => {
    expect(resolveEnter('WVWZZZ1JZXW000001', [])).toEqual({ kind: 'vin' });
    // contains I, O and Q: not VIN-shaped
    expect(resolveEnter('WVWZZZ1JZXW00OIQ1', [])).toEqual({ kind: 'palette', prefill: 'WVWZZZ1JZXW00OIQ1' });
  });

  it('anything without an exact match opens the palette prefilled', () => {
    expect(resolveEnter('brake', hits)).toEqual({ kind: 'palette', prefill: 'brake' });
  });

  it('the SKU in the link is URL-encoded', () => {
    expect(catalogHref('A B&C')).toBe('/catalog?tab=assortment&sku=A%20B%26C');
  });

  it('Product Search body matches SKU, part number and OE number exactly plus a name full-text match', () => {
    const body = buildPartSearchBody('brake', 'de');
    expect(PART_NUMBER_ATTRIBUTE).toBe('part-number');
    expect(OE_ATTRIBUTE).toBe('oem-numbers');
    expect(body.limit).toBe(8);
    expect(JSON.stringify(body.query)).toContain('variants.sku');
    expect(JSON.stringify(body.query)).toContain(`variants.attributes.${PART_NUMBER_ATTRIBUTE}`);
    expect(JSON.stringify(body.query)).toContain(`variants.attributes.${OE_ATTRIBUTE}`);
    expect(body.query.or.at(-1)).toEqual({ fullText: { field: 'name', language: 'de', value: 'brake' } });
  });
});
