// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import type { AddressInput } from '@/lib/types';

let shop: FakeShop;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (shop.apiRoot as Record<string, unknown>)[p as string] }) }));

const { RxNotFoundError, validateRxSelection } = vi.hoisted(() => ({ RxNotFoundError: class extends Error {}, validateRxSelection: vi.fn() }));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError, validateRxSelection: (...a: unknown[]) => validateRxSelection(...a) }));

import { readCheckout, setCheckoutAddress, setCheckoutShippingMethod, type CheckoutContext } from './checkout';

const patient = { patientRef: 'pt_sam', name: 'Sam Rivera' };
const MORNING = new Date('2026-10-08T09:00:00-04:00');
const AFTERNOON = new Date('2026-10-08T15:00:00-04:00');
const ctx = (cartId: string | undefined, now = MORNING): CheckoutContext => ({ patient, customerId: 'c-sam', cartId, rx: { locale: 'en-US', currency: 'USD', country: 'US' }, now });
const address = (state: string, zip = '10001'): AddressInput => ({ firstName: 'Sam', lastName: 'Rivera', street: '12 Elm St', street2: '', city: 'Town', state, zip, phone: '+15125550100' });

beforeEach(() => {
  shop = createFakeShop();
  validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [], refused: [] });
});

describe('checkout-page: Checkout re-reading totals after each shipping change', () => {
  it('Address change moves tax: after the address the summary shows the recalculated tax, shipping and total from the cart read', async () => {
    shop.taxPercent = { NY: 8 };
    const cart = shop.seedCart();
    const before = await readCheckout(ctx(cart.id));
    expect(before?.cart.total.centAmount).toBe(1875);
    expect(before?.cart.tax?.centAmount).toBe(0);

    const state = await setCheckoutAddress(ctx(cart.id), address('NY'));
    // 8% of 1875 = 150; the numbers are the platform's (fake) taxedPrice, not computed by the app.
    expect(state?.cart.tax?.centAmount).toBe(150);
    expect(state?.cart.total.centAmount).toBe(2025);
    expect(state?.cart.shipping?.price.centAmount).toBe(0);
    expect(state?.cart.shippingAddress).toMatchObject({ state: 'NY', street: '12 Elm St' });

    const second = await setCheckoutAddress(ctx(cart.id), address('CA', '90210'));
    expect(second?.cart.tax?.centAmount).toBe(0);
    expect(second?.cart.total.centAmount).toBe(1875);
  });

  it('Address change moves tax: a delivery option no longer valid for the new address is withdrawn and the cart falls back to standard', async () => {
    const cart = shop.seedCart();
    await setCheckoutAddress(ctx(cart.id), address('NY'));
    const sameDay = await setCheckoutShippingMethod(ctx(cart.id), 'mlv-same-day');
    expect(sameDay?.state.cart.shippingMethodKey).toBe('mlv-same-day');
    expect(sameDay?.state.cart.total.centAmount).toBe(2375);

    const moved = await setCheckoutAddress(ctx(cart.id), address('CA', '90210'));
    expect(moved?.options.map((o) => o.key)).toEqual(['mlv-standard']);
    expect(moved?.cart.shippingMethodKey).toBe('mlv-standard');
    expect(moved?.cart.total.centAmount).toBe(1875);
  });

  it('No delivery method for address: the state says nothing is deliverable and no method is selected', async () => {
    shop.unserved.add('AK');
    const cart = shop.seedCart();
    const state = await setCheckoutAddress(ctx(cart.id), address('AK', '99501'));
    expect(state?.deliverable).toBe(false);
    expect(state?.options).toEqual([]);
    expect(state?.cart.shippingMethodKey).toBeNull();
  });

  it('Address changes the total: the cart is read again after the update and the state is built from that read, not from the update', async () => {
    shop.taxPercent = { NY: 8 };
    const cart = shop.seedCart();
    const state = await setCheckoutAddress(ctx(cart.id), address('NY'));
    // The platform's current cart is exactly what is shown.
    const platform = shop.carts.get(cart.id);
    expect(state?.cart.version).toBe(platform?.version);
    expect(state?.cart.total.centAmount).toBe(platform?.taxedPrice?.totalGross.centAmount);
    expect(shop.updates.some((u) => u.actions.some((a) => a.action === 'setShippingAddress'))).toBe(true);
  });

  it('Change: selecting same-day shows $5.00 in the delivery row and the total includes it, from the recalculated cart', async () => {
    const cart = shop.seedCart();
    await setCheckoutAddress(ctx(cart.id), address('TX', '75201'));
    const outcome = await setCheckoutShippingMethod(ctx(cart.id), 'mlv-same-day');
    expect(outcome?.accepted).toBe(true);
    expect(outcome?.state.cart.shipping).toMatchObject({ price: { centAmount: 500 } });
    expect(outcome?.state.cart.total.centAmount).toBe(2375);
    expect(shop.updates.at(-1)?.actions).toEqual([{ action: 'setShippingMethod', shippingMethod: { typeId: 'shipping-method', key: 'mlv-same-day' } }]);
  });

  it('Same-day not available: after the cut-off the method is refused and the cart is untouched', async () => {
    const cart = shop.seedCart();
    await setCheckoutAddress(ctx(cart.id), address('NY'));
    const updates = shop.updates.length;
    const outcome = await setCheckoutShippingMethod(ctx(cart.id, AFTERNOON), 'mlv-same-day');
    expect(outcome?.accepted).toBe(false);
    expect(outcome?.state.options.map((o) => o.key)).toEqual(['mlv-standard']);
    expect(shop.updates).toHaveLength(updates);
  });

  it('Same-day not available: an out-of-state address refuses it', async () => {
    const cart = shop.seedCart();
    await setCheckoutAddress(ctx(cart.id), address('CA', '90210'));
    expect((await setCheckoutShippingMethod(ctx(cart.id), 'mlv-same-day'))?.accepted).toBe(false);
  });

  it('returns null without a cart or for a cart that is not the customer’s', async () => {
    expect(await readCheckout(ctx(undefined))).toBeNull();
    const other = shop.seedCart({ customerId: 'c-other' });
    expect(await readCheckout(ctx(other.id))).toBeNull();
    expect(await setCheckoutAddress(ctx(other.id), address('NY'))).toBeNull();
    expect(await setCheckoutShippingMethod(ctx(other.id), 'mlv-standard')).toBeNull();
  });

  it('flags lines that fail re-validation without removing them', async () => {
    validateRxSelection.mockResolvedValue({
      rxNumber: 'RX-77102',
      accepted: [],
      refused: [{ lineRef: 'RX-77102-1', name: '', sig: '', qty: 30, price: null, status: 'NO_REFILLS', selectable: false, remaining: 0, minShelfLifeMonths: null }],
    });
    const cart = shop.seedCart();
    const state = await readCheckout(ctx(cart.id));
    expect(state?.cart.unavailableCount).toBe(1);
    expect(state?.cart.lines).toHaveLength(1);
  });

  it('an empty cart has no options and is not deliverable', async () => {
    const cart = shop.seedCart({ lines: [] });
    const state = await readCheckout(ctx(cart.id));
    expect(state?.options).toEqual([]);
    expect(state?.cart.lineCount).toBe(0);
  });
});
