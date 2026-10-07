import { COUNTRY_CONFIG, DEFAULT_LOCALE, formatMoney, getLocalizedString } from './utils';

describe('formatMoney', () => {
  it('formats USD for en-US', () => {
    expect(formatMoney(480, 'USD', 'en-US')).toBe('$4.80');
  });
  it('formats EUR for de-DE (NBSP normalised)', () => {
    expect(formatMoney(480, 'EUR', 'de-DE').replace(/ /g, ' ')).toBe('4,80 €');
  });
});

describe('getLocalizedString', () => {
  it('uses the exact locale first', () => {
    expect(getLocalizedString({ 'en-US': 'Milk', 'de-DE': 'Milch' }, 'de-DE')).toBe('Milch');
  });
  it('falls back to the same language', () => {
    expect(getLocalizedString({ en: 'Milk', 'de-DE': 'Milch' }, 'en-US')).toBe('Milk');
  });
  it('falls back to the first value, then to an empty string', () => {
    expect(getLocalizedString({ 'fr-FR': 'Lait' }, 'en-US')).toBe('Lait');
    expect(getLocalizedString(undefined, 'en-US')).toBe('');
    expect(getLocalizedString({}, 'en-US')).toBe('');
  });
});

describe('COUNTRY_CONFIG', () => {
  it('has exactly en-US (USD/US) and de-DE (EUR/DE), default en-US', () => {
    expect(Object.keys(COUNTRY_CONFIG)).toEqual(['en-US', 'de-DE']);
    expect(COUNTRY_CONFIG['de-DE']).toMatchObject({ currency: 'EUR', country: 'DE' });
    expect(DEFAULT_LOCALE.locale).toBe('en-US');
  });
});
