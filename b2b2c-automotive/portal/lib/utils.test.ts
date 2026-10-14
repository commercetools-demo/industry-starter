/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, formatMoney, getLocalizedString } from './utils';

describe('COUNTRY_CONFIG', () => {
  it('COUNTRY_CONFIG has exactly the two locales', () => {
    expect(Object.keys(COUNTRY_CONFIG).sort()).toEqual(['de-DE', 'en-US']);
    expect(DEFAULT_LOCALE.locale).toBe('de-DE');
  });
  it('de-DE is EUR and DE', () => {
    expect(COUNTRY_CONFIG['de-DE']).toMatchObject({ currency: 'EUR', country: 'DE' });
  });
  it('en-US is USD and US', () => {
    expect(COUNTRY_CONFIG['en-US']).toMatchObject({ currency: 'USD', country: 'US' });
  });
});

describe('formatMoney', () => {
  it('formatMoney de-DE EUR', () => {
    const s = formatMoney(1999, 'EUR', 'de-DE');
    expect(s).toContain('19,99');
    expect(s).toContain('€');
  });
  it('formatMoney en-US USD', () => {
    expect(formatMoney(1999, 'USD', 'en-US')).toBe('$19.99');
  });
  it('formatMoney zero-decimal currency', () => {
    expect(formatMoney(1500, 'JPY', 'de-DE')).toContain('1.500');
  });
  it('formatMoney high precision', () => {
    expect(formatMoney(123456, 'EUR', 'de-DE', 4)).toContain('12,3456');
  });
});

describe('getLocalizedString', () => {
  it('getLocalizedString exact', () => {
    expect(getLocalizedString({ 'de-DE': 'Hallo', 'en-US': 'Hello' }, 'en-US')).toBe('Hello');
  });
  it('getLocalizedString language match', () => {
    expect(getLocalizedString({ de: 'Hallo' }, 'de-DE')).toBe('Hallo');
    expect(getLocalizedString({ 'de-AT': 'Servus' }, 'de-DE')).toBe('Servus');
  });
  it('getLocalizedString falls back to de-DE then en-US then first', () => {
    expect(getLocalizedString({ 'en-US': 'Hello', 'de-DE': 'Hallo' }, 'fr-FR')).toBe('Hallo');
    expect(getLocalizedString({ 'en-US': 'Hello' }, 'fr-FR')).toBe('Hello');
    expect(getLocalizedString({ 'it-IT': 'Ciao' }, 'fr-FR')).toBe('Ciao');
  });
  it('getLocalizedString null returns empty string', () => {
    expect(getLocalizedString(null, 'de-DE')).toBe('');
    expect(getLocalizedString(undefined, 'de-DE')).toBe('');
  });
});
