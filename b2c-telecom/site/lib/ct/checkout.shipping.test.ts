// @vitest-environment node
import type { ShippingMethod } from '@commercetools/platform-sdk';
import { optionOf } from './checkout';

vi.mock('./client', () => ({ getApiRoot: () => ({}) }));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));

const money = (centAmount: number, currencyCode = 'USD') => ({ type: 'centPrecision' as const, centAmount, currencyCode, fractionDigits: 2 });
const method = (rate: Record<string, unknown>): ShippingMethod =>
  ({ id: 'sm1', key: 'malva-shipping-standard', name: 'Standard', zoneRates: [{ zone: { typeId: 'zone', id: 'z' }, shippingRates: [rate] }] }) as unknown as ShippingMethod;

describe('shipping option price', () => {
  it('is the rate price the platform returned', () => {
    expect(optionOf(method({ price: money(500), isMatching: true }), 'en-US', 'USD').price).toEqual({ centAmount: 500, currencyCode: 'USD' });
  });

  it('free shipping is a matching tier of the rate, evaluated by the platform: the tier wins, the storefront compares no threshold', () => {
    const rate = { price: money(500), isMatching: true, tiers: [{ type: 'CartValue', minimumCentAmount: 5000, price: money(0), isMatching: true }] };
    expect(optionOf(method(rate), 'en-US', 'USD').price.centAmount).toBe(0);
    const notMatching = { ...rate, tiers: [{ ...rate.tiers[0], isMatching: false }] };
    expect(optionOf(method(notMatching), 'en-US', 'USD').price.centAmount).toBe(500);
  });

  it('a freeAbove value is not evaluated here (it is the platform that applies it once the method is set)', () => {
    expect(optionOf(method({ price: money(500), freeAbove: money(1), isMatching: true }), 'en-US', 'USD').price.centAmount).toBe(500);
  });

  it('a method with no rate for the cart reads as zero in the cart currency, not in a hard-coded one', () => {
    const none = { id: 'sm2', name: 'None', zoneRates: [] } as unknown as ShippingMethod;
    expect(optionOf(none, 'de-DE', 'EUR').price).toEqual({ centAmount: 0, currencyCode: 'EUR' });
  });
});
