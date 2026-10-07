import { safeReturnPath, stripLocalePrefix } from './return-target';

describe('safeReturnPath', () => {
  it('accepts allowed paths of the current locale', () => {
    expect(safeReturnPath('/en-US/account', 'en-US')).toBe('/en-US/account');
    expect(safeReturnPath('/en-US/bundle/checkout', 'en-US')).toBe('/en-US/bundle/checkout');
    expect(safeReturnPath('/en-US/shop/phone-plans?offer=x', 'en-US')).toBe('/en-US/shop/phone-plans?offer=x');
  });

  it('adds the locale prefix to an unprefixed path', () => {
    expect(safeReturnPath('/bundle', 'de-DE')).toBe('/de-DE/bundle');
  });

  it('rejects hosts, schemes and backslashes', () => {
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', '/en-US/account?next=https://evil.com', '/en-US//evil.com']) {
      expect(safeReturnPath(bad, 'en-US')).toBe('/en-US/account');
    }
  });

  it('rejects traversal, control characters and unknown first segments', () => {
    for (const bad of ['/en-US/../x', '/en-US/account/../../x', '/en-US/%2e%2e/x', '/en-US/acc\u0000ount', '/en-US/login', '/en-US/api/auth/logout', '/other', '']) {
      expect(safeReturnPath(bad, 'en-US')).toBe('/en-US/account');
    }
  });

  it('rejects another locale and a missing input', () => {
    expect(safeReturnPath('/de-DE/account', 'en-US')).toBe('/en-US/account');
    expect(safeReturnPath(undefined, 'de-DE')).toBe('/de-DE/account');
    expect(safeReturnPath(null, 'de-DE')).toBe('/de-DE/account');
  });

  it('rejects an overlong input', () => {
    expect(safeReturnPath(`/en-US/account?${'a'.repeat(600)}`, 'en-US')).toBe('/en-US/account');
  });
});

describe('stripLocalePrefix', () => {
  it('removes a leading locale only', () => {
    expect(stripLocalePrefix('/en-US/bundle?x=1')).toBe('/bundle?x=1');
    expect(stripLocalePrefix('/de-DE')).toBe('/');
    expect(stripLocalePrefix('/bundle')).toBe('/bundle');
  });
});
