import { describe, expect, it } from 'vitest';
import { reasonForPath } from './sign-in-reason';
import { resolveLoginDestination } from './login-destination';

describe('account-sign-in: redirect after sign-in', () => {
  it('lands on the stored next route, without the locale prefix', () => {
    expect(resolveLoginDestination('/en-US/cart')).toEqual({ path: '/cart', locale: 'en-US', reason: 'cart' });
    expect(resolveLoginDestination('/en-US/order/ORD-1?tab=1')).toMatchObject({ path: '/order/ORD-1?tab=1', reason: 'order' });
  });

  it('default destination is /account', () => {
    for (const raw of [undefined, '', '   ']) expect(resolveLoginDestination(raw)).toEqual({ path: '/account', reason: null });
  });

  it('Open redirect rejected: external, protocol-relative, scheme, backslash and traversal values fall back to /account', () => {
    const evil = [
      '//evil.com',
      '//evil.com/en-US/cart',
      'https://evil.com',
      'http://localhost:3000/en-US/cart',
      'javascript:alert(1)',
      '/\\evil.com',
      '/en-US//evil.com',
      '/en-US/../../evil.com',
      '/fr-FR/cart',
      'en-US/cart',
      '/en-US/cart\nSet-Cookie: x=1',
      '/%2F%2Fevil.com',
    ];
    for (const raw of evil) expect(resolveLoginDestination(raw), raw).toEqual({ path: '/account', reason: null });
  });

  it('a repeated next parameter uses the first value', () => {
    expect(resolveLoginDestination(['/en-US/cart', '//evil.com']).path).toBe('/cart');
    expect(resolveLoginDestination(['//evil.com', '/en-US/cart']).path).toBe('/account');
  });

  it('the sign-in page is never its own destination', () => {
    expect(resolveLoginDestination('/en-US/login').path).toBe('/account');
    expect(resolveLoginDestination('/en-US/login?next=/en-US/cart').path).toBe('/account');
  });

  it('reason line follows the destination', () => {
    expect(reasonForPath('/prescriptions')).toBe('prescriptions');
    expect(reasonForPath('/checkout/payment')).toBe('checkout');
    expect(reasonForPath('/account/labs')).toBe('labs');
    expect(reasonForPath('/account')).toBe('account');
    expect(reasonForPath('/accounting')).toBeNull();
    expect(reasonForPath('/doctors/remote')).toBeNull();
    expect(reasonForPath(null)).toBeNull();
  });
});
