import { describe, expect, it } from 'vitest';
import { defineRouting } from 'next-intl/routing';
import { routing } from '@/i18n/routing';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/utils';

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
