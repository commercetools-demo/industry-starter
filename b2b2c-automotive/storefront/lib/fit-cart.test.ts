// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { cart, line } from '@/test/cart-view-model';
import { countMisfits, getLineFit } from './fit';

const golf2016 = { make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI' };
const golf2020 = { ...golf2016, year: 2020 };
const lines = cart().lines;

describe('Cart fit: lib/fit', () => {
  it('no vehicle means no warning', () => {
    const fits = getLineFit(lines, null);
    expect(Object.values(fits).every((f) => f === 'unknown')).toBe(true);
    expect(countMisfits(fits)).toBe(0);
  });
  it('vehicle change flags a line that no longer fits', () => {
    expect(getLineFit(lines, golf2016)['li-1']).toBe('fits');
    const after = getLineFit(lines, golf2020);
    expect(after['li-1']).toBe('does-not-fit');
    expect(countMisfits(after)).toBeGreaterThan(0);
  });
  it('one year outside the part range is flagged, the last year inside is not', () => {
    expect(getLineFit(lines, { ...golf2016, year: 2019 })['li-1']).toBe('fits');
    expect(getLineFit(lines, { ...golf2016, year: 2020 })['li-1']).toBe('does-not-fit');
    expect(getLineFit(lines, { ...golf2016, year: 2011 })['li-1']).toBe('does-not-fit');
  });
  it('universal parts fit every vehicle', () => {
    const universal = [line({ id: 'u', fitment: { fitmentKeys: [], universalFit: true } })];
    expect(getLineFit(universal, golf2020).u).toBe('fits');
  });
  it('warning does not disable checkout: the fit result carries no blocking flag', () => {
    const fits = getLineFit(lines, golf2020);
    expect(Object.values(fits).every((f) => ['fits', 'does-not-fit', 'unknown'].includes(f))).toBe(true);
    // the cart page keeps Checkout enabled for a misfit (asserted in components/cart: "keeps Checkout enabled")
  });
});
