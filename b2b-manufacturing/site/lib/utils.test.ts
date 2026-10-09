import { describe, expect, it } from 'vitest';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, formatMoney, getLocalizedString, isSupportedLocale, LOCALES } from './utils';

describe('malva-locale-routing › Single source of truth', () => {
  it('lists en-US (US, USD) and de-DE (DE, EUR) with the default en-US', () => {
    expect(LOCALES).toEqual(['en-US', 'de-DE']);
    expect(COUNTRY_CONFIG['en-US']).toMatchObject({ country: 'US', currency: 'USD', locale: 'en-US' });
    expect(COUNTRY_CONFIG['de-DE']).toMatchObject({ country: 'DE', currency: 'EUR', locale: 'de-DE' });
    expect(DEFAULT_LOCALE).toBe('en-US');
  });
  it('recognises only configured locales', () => {
    expect(isSupportedLocale('de-DE')).toBe(true);
    expect(isSupportedLocale('fr-FR')).toBe(false);
    expect(isSupportedLocale('toString')).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
  });
});

describe('getLocalizedString', () => {
  it('prefers the exact locale, then the language, then en-US, then any value', () => {
    expect(getLocalizedString({ 'en-US': 'Drain', 'de-DE': 'Kanal' }, 'de-DE')).toBe('Kanal');
    expect(getLocalizedString({ 'de-AT': 'Kanal AT', 'en-US': 'Drain' }, 'de-DE')).toBe('Kanal AT');
    expect(getLocalizedString({ 'en-US': 'Drain', 'fr-FR': 'Egout' }, 'de-DE')).toBe('Drain');
    expect(getLocalizedString({ 'fr-FR': 'Egout' }, 'de-DE')).toBe('Egout');
  });
  it('never throws', () => {
    expect(getLocalizedString(undefined, 'en-US')).toBe('');
    expect(getLocalizedString(null, 'en-US')).toBe('');
    expect(getLocalizedString({}, 'weird')).toBe('');
  });
});

describe('formatMoney', () => {
  it('formats by currency and locale', () => {
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
    expect(formatMoney(123456, 'EUR', 'de-DE')).toMatch(/1\.234,56\s€/);
  });
});

import { sizedImage } from './utils';
describe('image sizing', () => {
  it('asks the image host for the width a slot needs and leaves other hosts alone', () => {
    expect(sizedImage('https://images.pexels.com/photos/1/pexels-photo-1.jpeg', 800)).toBe('https://images.pexels.com/photos/1/pexels-photo-1.jpeg?auto=compress&cs=tinysrgb&w=800');
    expect(sizedImage('https://x.commercetools.com/a.jpg', 800)).toBe('https://x.commercetools.com/a.jpg');
    expect(sizedImage('not a url', 800)).toBe('not a url');
  });
});
