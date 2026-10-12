// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { fitExpression, fitScope, getFitState, resolveFitMode } from './fitment';

const golf2016 = { make: 'Volkswagen', model: 'Golf', year: 2016, engine: '2.0 TDI' };
const KEY = 'Volkswagen|Golf|2012|2019|2.0 TDI';

describe('Fit scope (search expression)', () => {
  it('fit-only builds an or of the expanded keys and universal-fit', () => {
    expect(fitScope([KEY], 'fit-only')).toEqual({
      or: [
        { exact: { field: 'variants.attributes.fitment-keys', fieldType: 'set_text', values: [KEY] } },
        { exact: { field: 'variants.attributes.universal-fit', fieldType: 'boolean', value: true } },
      ],
    });
  });

  it('two keys go into one values list', () => {
    const two = [KEY, 'Volkswagen|Golf|2019|2024|2.0 TDI'];
    const expr = fitExpression(two);
    expect(expr.or?.[0]).toEqual({ exact: { field: 'variants.attributes.fitment-keys', fieldType: 'set_text', values: two } });
    expect(expr.or).toHaveLength(2);
  });

  it('no vehicle builds nothing', () => {
    expect(fitScope(null, 'fit-only')).toBeNull();
    expect(fitScope(null, 'all')).toBeNull();
  });

  it('mode all builds nothing', () => {
    expect(fitScope([KEY], 'all')).toBeNull();
  });

  it('vehicle missing from the table gets only the universal branch', () => {
    expect(fitScope([], 'fit-only')).toEqual({ or: [{ exact: { field: 'variants.attributes.universal-fit', fieldType: 'boolean', value: true } }] });
  });

  it('fit=0 turns the filter off', () => {
    expect(resolveFitMode({ id: 'x' }, '0')).toBe('all');
    expect(resolveFitMode({ id: 'x' }, undefined)).toBe('fit-only');
    expect(resolveFitMode({ id: 'x' }, '1')).toBe('fit-only');
    expect(resolveFitMode(null, undefined)).toBe('all');
  });
});

describe('Fit state (pure)', () => {
  it('getFitState fits inside the range', () => {
    expect(getFitState({ fitmentKeys: [KEY], universalFit: false }, golf2016)).toBe('fits');
  });

  it('getFitState does not fit a year outside the range', () => {
    expect(getFitState({ fitmentKeys: [KEY], universalFit: false }, { ...golf2016, year: 2020 })).toBe('does-not-fit');
  });

  it('getFitState fits by universal-fit', () => {
    expect(getFitState({ fitmentKeys: [], universalFit: true }, golf2016)).toBe('fits');
  });

  it('getFitState does not fit another engine', () => {
    expect(getFitState({ fitmentKeys: [KEY], universalFit: false }, { ...golf2016, engine: '1.4 TSI' })).toBe('does-not-fit');
  });

  it('getFitState is unknown without a vehicle', () => {
    expect(getFitState({ fitmentKeys: [KEY], universalFit: false }, null)).toBe('unknown');
    expect(getFitState({ fitmentKeys: [], universalFit: true }, null)).toBe('unknown');
  });

  it('local part without keys does not fit and is not universal', () => {
    expect(getFitState({ fitmentKeys: [], universalFit: false }, golf2016)).toBe('does-not-fit');
  });

  it('ignores a malformed key', () => {
    expect(getFitState({ fitmentKeys: ['broken'], universalFit: false }, golf2016)).toBe('does-not-fit');
  });
});
