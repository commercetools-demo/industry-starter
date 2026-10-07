import { formatMoney, formatMoneyExact, getLocalizedString } from './format';

describe('formatMoney', () => {
  it('whole amounts drop the decimals in en-US', () => {
    expect(formatMoney({ centAmount: 2500, currencyCode: 'USD' }, 'en-US')).toBe('$25');
  });
  it('fractional amounts keep two decimals in en-US', () => {
    expect(formatMoney({ centAmount: 5999, currencyCode: 'USD' }, 'en-US')).toBe('$59.99');
  });
  it('de-DE formats EUR with a comma and a no-break space before the symbol', () => {
    expect(formatMoney({ centAmount: 5999, currencyCode: 'EUR' }, 'de-DE')).toBe('59,99 €');
  });
  it('de-DE whole euros', () => {
    expect(formatMoney({ centAmount: 6000, currencyCode: 'EUR' }, 'de-DE')).toBe('60 €');
  });
});

describe('getLocalizedString', () => {
  it('uses the exact locale first', () => {
    expect(getLocalizedString({ 'en-US': 'Cable', 'de-DE': 'Kabel' }, 'de-DE')).toBe('Kabel');
  });
  it('falls back to the same language in another region', () => {
    expect(getLocalizedString({ 'en-GB': 'Colour', 'de-DE': 'Farbe' }, 'en-US')).toBe('Colour');
  });
  it('falls back to en-US', () => {
    expect(getLocalizedString({ 'en-US': 'Cable' }, 'de-DE')).toBe('Cable');
  });
  it('falls back to the first non-empty value', () => {
    expect(getLocalizedString({ 'fr-FR': '', 'it-IT': 'Cavo' }, 'de-DE')).toBe('Cavo');
  });
  it('returns an empty string for nothing', () => {
    expect(getLocalizedString(undefined, 'en-US')).toBe('');
    expect(getLocalizedString(null, 'en-US')).toBe('');
    expect(getLocalizedString({}, 'en-US')).toBe('');
  });
});

describe('formatMoneyExact', () => {
  it('always shows two fraction digits, also for whole amounts', () => {
    expect(formatMoneyExact({ centAmount: 500, currencyCode: 'USD' }, 'en-US')).toBe('$5.00');
    expect(formatMoneyExact({ centAmount: 5999, currencyCode: 'USD' }, 'en-US')).toBe('$59.99');
  });
  it('de-DE uses the comma and the symbol after the amount', () => {
    expect(formatMoneyExact({ centAmount: 5999, currencyCode: 'EUR' }, 'de-DE').replace(/\s/g, ' ')).toBe('59,99 €');
    expect(formatMoneyExact({ centAmount: 2800, currencyCode: 'EUR' }, 'de-DE').replace(/\s/g, ' ')).toBe('28,00 €');
  });
});
