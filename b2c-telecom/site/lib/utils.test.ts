import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale, LOCALES, marketFor } from './utils';

describe('market definition', () => {
  it('marketFor("de-DE") returns the EUR/DE market', () => {
    expect(marketFor('de-DE')).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
  });
  it('marketFor falls back to en-US/USD/US for unknown or empty locales', () => {
    expect(marketFor('xx-XX')).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
    expect(marketFor('')).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
    expect(marketFor('toString')).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
  });
  it('isSupportedLocale rejects fr-FR and non-strings', () => {
    expect(isSupportedLocale('fr-FR')).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
    expect(isSupportedLocale('en-US')).toBe(true);
  });
  it('LOCALES equals en-US and de-DE and the default is en-US', () => {
    expect(LOCALES).toEqual(['en-US', 'de-DE']);
    expect(DEFAULT_LOCALE).toBe('en-US');
    expect(COUNTRY_CONFIG['de-DE'].label).toBe('Deutschland');
  });
});
