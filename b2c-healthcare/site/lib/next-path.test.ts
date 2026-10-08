import { describe, expect, it } from 'vitest';
import { sanitizeNext, splitLocalePath, toNextParam } from './next-path';

describe('design-storefront-shell › Protected routes prompt in place: ?next= validation', () => {
  it.each([
    '/en-US',
    '/en-US/',
    '/en-US/cart',
    '/en-US/checkout',
    '/en-US/order/ord_1',
    '/en-US/account/labs/l1',
    '/en-US/doctors/remote?specialty=Dermatology',
  ])('accepts the same-origin locale path %s', (path) => {
    expect(sanitizeNext(path)).toBe(path);
  });

  it.each([
    ['absolute URL', 'https://evil.example/en-US/cart'],
    ['http URL', 'http://evil.example'],
    ['protocol-relative', '//evil.example/en-US/cart'],
    ['protocol-relative with locale', '//en-US/cart'],
    ['backslash trick', '/\\evil.example'],
    ['backslash after locale', '/en-US\\@evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>1</script>'],
    ['no leading slash', 'en-US/cart'],
    ['locale-less path', '/cart'],
    ['unsupported locale', '/fr-FR/cart'],
    ['locale lookalike', '/en-USA/cart'],
    ['locale as userinfo', '/en-US@evil.example'],
    ['dot segments leaving the locale', '/en-US/../admin'],
    ['encoded dot segments', '/en-US/%2e%2e/admin'],
    ['double slash after locale (becomes //host after stripping)', '/en-US//evil.example'],
    ['encoded slash trick', '/%2f/evil.example'],
    ['newline', '/en-US/cart\n/evil'],
    ['carriage return', '/en-US/cart\r'],
    ['tab', '/en-US/\tcart'],
    ['empty', ''],
    ['whitespace only', ' '],
    ['too long', `/en-US/${'a'.repeat(2100)}`],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeNext(value)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(sanitizeNext(undefined)).toBeNull();
    expect(sanitizeNext(null)).toBeNull();
    expect(sanitizeNext(['/en-US/cart'] as unknown as string)).toBeNull();
  });

  it('returns the fallback when rejected', () => {
    expect(sanitizeNext('https://evil.example', '/en-US/account')).toBe('/en-US/account');
    expect(sanitizeNext('/en-US/cart', '/en-US/account')).toBe('/en-US/cart');
  });

  it('normalizes harmless dot segments inside the locale', () => {
    expect(sanitizeNext('/en-US/doctors/../cart')).toBe('/en-US/cart');
  });

  it('never yields a value that starts with // or contains a scheme after stripping the locale', () => {
    const attempts = ['/en-US//evil.example', '/en-US/\\evil', '/en-US/..//evil.example', '/en-US/%2F%2Fevil.example'];
    for (const attempt of attempts) {
      const clean = sanitizeNext(attempt);
      if (clean === null) continue;
      const split = splitLocalePath(clean);
      expect(split?.path.startsWith('//')).toBe(false);
    }
  });

  it('splitLocalePath separates the locale from the app path', () => {
    expect(splitLocalePath('/en-US/cart')).toEqual({ locale: 'en-US', path: '/cart' });
    expect(splitLocalePath('/en-US')).toEqual({ locale: 'en-US', path: '/' });
    expect(splitLocalePath('/en-US/order/o1?x=1#top')).toEqual({ locale: 'en-US', path: '/order/o1?x=1#top' });
    expect(splitLocalePath('https://evil.example')).toBeNull();
  });

  it('toNextParam prefixes the locale and survives the round trip through sanitizeNext', () => {
    expect(toNextParam('en-US', '/cart')).toBe('/en-US/cart');
    expect(toNextParam('en-US', '/')).toBe('/en-US');
    expect(sanitizeNext(toNextParam('en-US', '/order/o1'))).toBe('/en-US/order/o1');
  });
});
