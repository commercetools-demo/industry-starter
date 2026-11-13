import { describe, expect, it } from 'vitest';
import { stripBrandAndLocale, withBrandAndLocale } from '@/i18n/paths';

describe('brand and locale paths', () => {
  it('prefixes brand and locale', () => {
    expect(withBrandAndLocale('/p/x?y=1#z', 'malva-drinks', 'en-CA')).toBe('/malva-drinks/en-CA/p/x?y=1#z');
    expect(withBrandAndLocale('/', 'malva-coffee', 'en-US')).toBe('/malva-coffee/en-US');
    expect(withBrandAndLocale('/?a=1', 'malva-coffee', 'en-US')).toBe('/malva-coffee/en-US?a=1');
  });

  it('leaves external, hash, query-only and already prefixed hrefs alone', () => {
    for (const h of ['https://example.com/a', '//cdn/x', '#top', '?page=2', 'mailto:a@b.c', '/malva-drinks/en-US/cart']) {
      expect(withBrandAndLocale(h, 'malva-coffee', 'en-US')).toBe(h);
    }
  });

  it('strips brand and locale from a pathname', () => {
    expect(stripBrandAndLocale('/malva-drinks/en-US/c/chic')).toBe('/c/chic');
    expect(stripBrandAndLocale('/malva-coffee/en-CA')).toBe('/');
    expect(stripBrandAndLocale('/something/else')).toBe('/something/else');
  });
});
