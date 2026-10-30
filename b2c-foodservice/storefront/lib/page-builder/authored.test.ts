import { describe, expect, it } from 'vitest';
import { authoredImage, authoredLink, categoryHrefOf, itemsPerRow, productHref, tilePrice } from './authored';

describe('authoredLink', () => {
  it.each([
    ['/category/pods', { kind: 'internal', href: '/category/pods' }],
    ['/en-US/category/pods', { kind: 'internal', href: '/category/pods' }],
    ['/en-CA', { kind: 'internal', href: '/' }],
    ['  /about  ', { kind: 'internal', href: '/about' }],
    ['https://example.com/x?y=1', { kind: 'external', href: 'https://example.com/x?y=1' }],
    ['mailto:hello@example.com', { kind: 'external', href: 'mailto:hello@example.com' }],
  ])('accepts %s', (value, expected) => {
    expect(authoredLink(value)).toEqual(expected);
  });

  it.each(['', '   ', 'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//evil.example', 'about', 42, null, undefined])(
    'rejects %j',
    (value) => {
      expect(authoredLink(value)).toBeNull();
    },
  );
});

describe('authoredImage', () => {
  it('keeps an https URL', () => {
    expect(authoredImage('https://img.example.com/a.jpg')).toBe('https://img.example.com/a.jpg');
  });
  it.each(['http://img.example.com/a.jpg', 'data:image/png;base64,AAAA', 'javascript:1', '', '/relative.jpg', 3, undefined])('drops %j', (v) => {
    expect(authoredImage(v)).toBeUndefined();
  });
});

describe('tilePrice', () => {
  it('maps a plain price', () => {
    expect(tilePrice({ centAmount: 495, currencyCode: 'USD' })).toEqual({ from: { centAmount: 495, currencyCode: 'USD' }, fromIsRange: false });
  });
  it('pays the discounted amount and strikes the list price', () => {
    expect(tilePrice({ centAmount: 1000, currencyCode: 'USD', discounted: { centAmount: 800, currencyCode: 'USD', discountName: 'Autumn' } })).toEqual({
      from: { centAmount: 800, currencyCode: 'USD' },
      fromIsRange: false,
      old: { centAmount: 1000, currencyCode: 'USD' },
      discountName: 'Autumn',
    });
  });
  it('is null without a price', () => {
    expect(tilePrice(undefined)).toBeNull();
    expect(tilePrice(null)).toBeNull();
  });
});

describe('hrefs and items per row', () => {
  it('builds locale-less hrefs and encodes the parts', () => {
    expect(productHref({ slug: 'ember ristretto', sku: 'A/1' })).toBe('/p/ember%20ristretto/A%2F1');
    expect(categoryHrefOf('pods')).toBe('/category/pods');
  });
  it('accepts 2, 3 or 4 as a number or string, otherwise the fallback', () => {
    expect(itemsPerRow('3')).toBe(3);
    expect(itemsPerRow(2)).toBe(2);
    expect(itemsPerRow('7')).toBe(4);
    expect(itemsPerRow(undefined, 3)).toBe(3);
  });
});
