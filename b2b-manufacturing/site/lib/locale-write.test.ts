import { describe, expect, it } from 'vitest';
import { applyLocale } from './locale-write';

const us = { locale: 'en-US', currency: 'USD', country: 'US', cartId: 'cart-1' };

describe('malva-locale-routing › Atomic locale write', () => {
  it('Partial update refused', () => {
    expect(() => applyLocale(us, { locale: 'de-DE' })).toThrow(/together/);
    expect(() => applyLocale(us, { locale: 'de-DE', currency: 'EUR' })).toThrow(/together/);
    expect(() => applyLocale(us, {})).toThrow(/together/);
  });
  it('refuses unsupported or inconsistent combinations', () => {
    expect(() => applyLocale(us, { locale: 'fr-FR', currency: 'EUR', country: 'FR' })).toThrow(/Unsupported/);
    expect(() => applyLocale(us, { locale: 'de-DE', currency: 'USD', country: 'DE' })).toThrow(/uses DE\/EUR/);
  });
  it('Currency change', () => {
    const result = applyLocale(us, { locale: 'de-DE', currency: 'EUR', country: 'DE' });
    expect(result).toEqual({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    expect(us.cartId).toBe('cart-1');
  });
  it('keeps the cart when the currency stays the same', () => {
    expect(applyLocale(us, { locale: 'en-US', currency: 'USD', country: 'US' }).cartId).toBe('cart-1');
  });
});
