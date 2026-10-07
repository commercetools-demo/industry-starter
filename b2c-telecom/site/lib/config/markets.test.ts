import { isLocale, MARKETS, marketFromLocale } from './markets';

describe('markets', () => {
  it('maps en-US to USD/US and de-DE to EUR/DE', () => {
    expect(marketFromLocale('en-US')).toEqual({ locale: 'en-US', currency: 'USD', country: 'US' });
    expect(marketFromLocale('de-DE')).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    expect(Object.keys(MARKETS)).toEqual(['en-US', 'de-DE']);
  });
  it('throws for an unsupported locale', () => {
    expect(() => marketFromLocale('en-GB')).toThrow('Unsupported locale');
    expect(() => marketFromLocale('')).toThrow('Unsupported locale');
  });
  it('isLocale narrows only supported locales', () => {
    expect(isLocale('de-DE')).toBe(true);
    expect(isLocale('fr-FR')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale('toString')).toBe(false);
  });
});
