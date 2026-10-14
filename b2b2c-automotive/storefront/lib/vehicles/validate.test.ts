// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { validatePlate, validateVin } from './validate';

describe('Plate and VIN validation (before any provider is called)', () => {
  it('plate trimmed and upper-cased', () => {
    expect(validatePlate('  b-ab 1234 ')).toEqual({ ok: true, value: 'B-AB 1234' });
  });

  it('plate with symbols is invalid', () => {
    expect(validatePlate('B*AB 1234')).toEqual({ ok: false, reason: 'plate-format' });
    expect(validatePlate('<script>')).toEqual({ ok: false, reason: 'plate-format' });
  });

  it('plate length is 2 to 10 characters', () => {
    expect(validatePlate('A')).toEqual({ ok: false, reason: 'plate-format' });
    expect(validatePlate('')).toEqual({ ok: false, reason: 'plate-format' });
    expect(validatePlate('ABCDEFGHIJK')).toEqual({ ok: false, reason: 'plate-format' });
    expect(validatePlate('ZZ 0')).toEqual({ ok: true, value: 'ZZ 0' });
  });

  it('plate of only separators is invalid', () => {
    expect(validatePlate('- -')).toEqual({ ok: false, reason: 'plate-format' });
  });

  it('vin of 16 characters is invalid', () => {
    expect(validateVin('WVWZZZAUZGW00000')).toEqual({ ok: false, reason: 'vin-length' });
    expect(validateVin('WVWZZZAUZGW0000012')).toEqual({ ok: false, reason: 'vin-length' });
  });

  it('vin with letter I is invalid', () => {
    expect(validateVin('WVWZZZAUZGW00000I')).toEqual({ ok: false, reason: 'vin-characters' });
    expect(validateVin('WVWZZZAUZGW00000O')).toEqual({ ok: false, reason: 'vin-characters' });
    expect(validateVin('WVWZZZAUZGW00000Q')).toEqual({ ok: false, reason: 'vin-characters' });
    expect(validateVin('WVWZZZAUZGW0000-1')).toEqual({ ok: false, reason: 'vin-characters' });
  });

  it('valid vin passes, upper-cased and trimmed', () => {
    expect(validateVin(' wvwzzzauzgw000001 ')).toEqual({ ok: true, value: 'WVWZZZAUZGW000001' });
  });
});
