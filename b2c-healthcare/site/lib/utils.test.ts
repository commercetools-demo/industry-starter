import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, formatMoney, getLocalizedString, isSupportedLocale } from './utils';

describe('storefront-locale-routing: Region configuration as one table', () => {
  it('Single source: COUNTRY_CONFIG holds en-US with US, USD, en', () => {
    expect(COUNTRY_CONFIG['en-US']).toEqual({ country: 'US', currency: 'USD', language: 'en' });
    expect(DEFAULT_LOCALE).toBe('en-US');
    expect(isSupportedLocale('en-US')).toBe(true);
    expect(isSupportedLocale('fr-FR')).toBe(false);
    expect(isSupportedLocale('toString')).toBe(false);
  });

  it('Single source: no component or page hard-codes en-US or USD', () => {
    const root = resolve(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) {
          if (/['"`](en-US|USD)['"`]/.test(readFileSync(path, 'utf8'))) offenders.push(path);
        }
      }
    };
    for (const dir of ['components', 'app']) walk(join(root, dir));
    expect(offenders).toEqual([]);
  });
});

describe('getLocalizedString', () => {
  it('prefers the exact locale, then the language, then en-US, then the first value', () => {
    expect(getLocalizedString({ 'en-US': 'US', en: 'EN' }, 'en-US')).toBe('US');
    expect(getLocalizedString({ en: 'EN', 'en-US': 'US' }, 'en-GB')).toBe('EN');
    expect(getLocalizedString({ de: 'DE', 'en-US': 'US' }, 'fr-FR')).toBe('US');
    expect(getLocalizedString({ de: 'DE', it: 'IT' }, 'fr-FR')).toBe('DE');
  });

  it('missing locale falls back; empty field gives an empty string', () => {
    expect(getLocalizedString({ de: 'DE' }, 'en-US')).toBe('DE');
    expect(getLocalizedString({}, 'en-US')).toBe('');
    expect(getLocalizedString(undefined, 'en-US')).toBe('');
    expect(getLocalizedString(null, 'en-US')).toBe('');
    expect(getLocalizedString({ 'en-US': '', de: 'DE' }, 'en-US')).toBe('DE');
  });
});

describe('formatMoney', () => {
  it('formats a 2-decimal currency', () => {
    expect(formatMoney(12345, 'USD', 'en-US')).toBe('$123.45');
    expect(formatMoney(0, 'USD', 'en-US')).toBe('$0.00');
  });

  it('uses the currency fraction digits, not /100 (JPY has none)', () => {
    expect(formatMoney(1234, 'JPY', 'en-US')).toMatch(/1,234$/);
  });

  it('handles 3-decimal currencies', () => {
    expect(formatMoney(1234, 'KWD', 'en-US')).toMatch(/1\.234$/);
  });
});
