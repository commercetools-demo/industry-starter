import { describe, expect, it } from 'vitest';
import { defineRouting } from 'next-intl/routing';
import { routing } from '@/i18n/routing';
import {
  COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALE_COOKIE, formatMoney, getLocalizedString,
  isLocaleKey, marketForCountry, marketForLocale, roundRating,
} from '@/lib/utils';

describe('test harness', () => {
  it('Fresh clone builds: the test runner starts', () => {
    expect(COUNTRY_CONFIG['en-US'].currency).toBe('USD');
  });
});

describe('Locales, countries and currencies from one source', () => {
  it('Routing locales equal the COUNTRY_CONFIG keys', () => {
    expect([...routing.locales]).toEqual(Object.keys(COUNTRY_CONFIG));
    expect(Object.keys(COUNTRY_CONFIG)).toEqual(['en-US', 'en-CA']);
  });

  it('Default locale is en-US and prefix is always', () => {
    expect(routing.defaultLocale).toBe('en-US');
    expect(routing.localePrefix).toBe('always');
    expect(DEFAULT_LOCALE).toBe(COUNTRY_CONFIG['en-US']);
  });

  it('Markets are US/USD and CA/CAD only', () => {
    expect(COUNTRY_CONFIG['en-US']).toMatchObject({ country: 'US', currency: 'USD' });
    expect(COUNTRY_CONFIG['en-CA']).toMatchObject({ country: 'CA', currency: 'CAD' });
    expect(LOCALE_COOKIE).toBe('malva-locale');
  });

  it('Adding a market: a test entry derives routing without code changes', () => {
    const extended = {
      ...COUNTRY_CONFIG,
      'fr-FR': { locale: 'fr-FR', currency: 'EUR', country: 'FR', label: 'France' },
    };
    const derived = defineRouting({
      locales: Object.keys(extended) as [string, ...string[]],
      defaultLocale: 'en-US',
      localePrefix: 'always',
    });
    expect(derived.locales).toContain('fr-FR');
  });
});

describe('Price display', () => {
  it('Price display: 1999 CAD in en-CA renders $19.99', () => {
    expect(formatMoney(1999, 'CAD', 'en-CA')).toBe('$19.99');
  });
  it('Price display: 1999 USD in en-US renders $19.99', () => {
    expect(formatMoney(1999, 'USD', 'en-US')).toBe('$19.99');
  });
  it('Price display: 495 USD renders $4.95 and never $5', () => {
    expect(formatMoney(495, 'USD')).toBe('$4.95');
  });
  it('Rating rounds to one decimal for display only: 4.58333 gives 4.6', () => {
    expect(roundRating(4.58333)).toBe(4.6);
  });
});

describe('getLocalizedString', () => {
  it('getLocalizedString exact match', () => {
    expect(getLocalizedString({ 'en-US': 'a', 'en-CA': 'b' }, 'en-CA')).toBe('b');
  });
  it('getLocalizedString falls back to the same language', () => {
    expect(getLocalizedString({ 'en-US': 'a' }, 'en-CA')).toBe('a');
  });
  it('getLocalizedString falls back to the default locale then the first value', () => {
    expect(getLocalizedString({ 'fr-FR': 'f', 'en-US': 'a' }, 'de-DE')).toBe('a');
    expect(getLocalizedString({ 'fr-FR': 'f' }, 'de-DE')).toBe('f');
  });
  it('getLocalizedString of undefined is empty', () => {
    expect(getLocalizedString(undefined, 'en-US')).toBe('');
  });
});

describe('markets', () => {
  it('marketForLocale falls back to en-US', () => {
    expect(marketForLocale('xx')).toBe(COUNTRY_CONFIG['en-US']);
    expect(marketForLocale('en-CA').country).toBe('CA');
  });
  it('marketForCountry finds a market or undefined', () => {
    expect(marketForCountry('CA')?.currency).toBe('CAD');
    expect(marketForCountry('DE')).toBeUndefined();
  });
  it('isLocaleKey accepts only configured keys', () => {
    expect(isLocaleKey('en-US')).toBe(true);
    expect(isLocaleKey('toString')).toBe(false);
  });
  it('Collection flag: US true, Canada false (D-035, Q-A-17)', () => {
    expect(COUNTRY_CONFIG['en-US'].collection).toBe(true);
    expect(COUNTRY_CONFIG['en-CA'].collection).toBe(false);
  });
});
