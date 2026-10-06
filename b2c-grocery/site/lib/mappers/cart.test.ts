import { describe, it, expect } from 'vitest';
import type { Cart as CtCart } from '@commercetools/platform-sdk';
import fixture from './__fixtures__/cart.json';
import { mapCart } from './cart';

const us = { locale: 'en-US', currency: 'USD', country: 'US' };
type Json = Record<string, unknown>;
const cart = (edit?: (c: Json) => void): CtCart => {
  const copy = JSON.parse(JSON.stringify(fixture)) as Json;
  edit?.(copy);
  return copy as unknown as CtCart;
};

describe('mapCart', () => {
  it('maps lines, totals and distinct line count', () => {
    const mapped = mapCart(cart(), us);
    expect(mapped.id).toBe('cart-1');
    expect(mapped.version).toBe(4);
    expect(mapped.itemCount).toBe(2);
    expect(mapped.subtotal).toEqual({ centAmount: 745, currencyCode: 'USD' });
    expect(mapped.total).toEqual({ centAmount: 1047, currencyCode: 'USD' });
    expect(mapped.tax).toEqual({ centAmount: 175, currencyCode: 'USD' });
    const [bananas, milk] = mapped.lines;
    expect(bananas).toMatchObject({
      id: 'line-bananas',
      sku: 'BANANAS-500G',
      name: 'Bananas',
      slug: 'bananas',
      quantity: 2,
      image: 'https://picsum.photos/seed/bananas-500g/800/800',
      increment: { value: 500, unit: 'g', label: '500 g' },
      availableQuantity: 50,
      inStock: true,
    });
    expect(bananas.total).toEqual({ centAmount: 298, currencyCode: 'USD' });
    expect(milk.unitPrice).toEqual({ centAmount: 199, currencyCode: 'USD', discounted: { centAmount: 149, currencyCode: 'USD' } });
    expect(milk.inStock).toBe(false);
    expect(milk.image).toBeUndefined();
  });

  it('is provisional when any line is an approximate weight', () => {
    expect(mapCart(cart(), us).isProvisional).toBe(true);
    const exact = cart((c) => {
      (c.lineItems as Json[]).splice(0, 1);
    });
    expect(mapCart(exact, us).isProvisional).toBe(false);
  });

  it('free shipping flag is set when the shipping price is 0', () => {
    expect(mapCart(cart(), us).shipping).toEqual({ name: 'Standard', price: { centAmount: 302, currencyCode: 'USD' }, free: false });
    const free = cart((c) => {
      (c.shippingInfo as { price: { centAmount: number } }).price.centAmount = 0;
    });
    expect(mapCart(free, us).shipping?.free).toBe(true);
  });

  it('no shipping info: shipping is omitted', () => {
    const none = cart((c) => {
      delete c.shippingInfo;
    });
    expect(mapCart(none, us).shipping).toBeUndefined();
  });

  it('substitution preference defaults to none', () => {
    const [bananas, milk] = mapCart(cart(), us).lines;
    expect(bananas.substitutionPreference).toBe('allow-similar');
    expect(milk.substitutionPreference).toBe('none');
  });

  it('maps the delivery slot from the cart-delivery custom fields', () => {
    expect(mapCart(cart(), us).slot).toEqual({
      id: '2026-10-12-09',
      start: '2026-10-12T09:00:00.000Z',
      end: '2026-10-12T11:00:00.000Z',
      holdExpires: '2026-10-12T08:15:00.000Z',
    });
    const without = cart((c) => {
      delete c.custom;
    });
    expect(mapCart(without, us).slot).toBeUndefined();
  });

  it('maps recurrence from the line recurrence info (expanded key, else id)', () => {
    const [bananas, milk] = mapCart(cart(), us).lines;
    expect(bananas.recurrence).toBeUndefined();
    expect(milk.recurrence).toEqual({ policyKey: 'weekly', priceSelectionMode: 'Dynamic' });
    const unexpanded = cart((c) => {
      const line = (c.lineItems as { recurrenceInfo?: { recurrencePolicy: Json } }[])[1];
      delete line.recurrenceInfo!.recurrencePolicy.obj;
    });
    expect(mapCart(unexpanded, us).lines[1].recurrence?.policyKey).toBe('rp-1');
  });

  it('maps the shipping address and localizes names', () => {
    const mapped = mapCart(cart(), { locale: 'de-DE', currency: 'EUR', country: 'DE' });
    expect(mapped.shippingAddress).toMatchObject({ country: 'US', city: 'Austin' });
    expect(mapped.lines[0].name).toBe('Bananen');
    expect(mapped.lines[0].slug).toBe('bananas-de');
  });
});
