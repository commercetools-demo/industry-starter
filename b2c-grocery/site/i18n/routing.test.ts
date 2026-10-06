import { routing, getPathname } from './routing';

describe('routing', () => {
  it('Add a market: locales come from COUNTRY_CONFIG, default en-US, prefix always', () => {
    expect(routing.locales).toEqual(['en-US', 'de-DE']);
    expect(routing.defaultLocale).toBe('en-US');
    expect(routing.localePrefix).toBe('always');
  });

  it('Link preserves locale: getPathname adds the prefix', () => {
    expect(getPathname({ href: '/shop', locale: 'de-DE' })).toBe('/de-DE/shop');
    expect(getPathname({ href: '/shop', locale: 'en-US' })).toBe('/en-US/shop');
  });
});
