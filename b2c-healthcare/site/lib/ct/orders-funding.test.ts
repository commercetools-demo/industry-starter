// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import { createFakePaymentProvider } from '@/lib/checkout/fake-provider';
import type { Prescription } from '@/lib/clinical/types';

let shop: FakeShop;
let objects: FakeObjects;
vi.mock('@/lib/ct/client', () => ({
  apiRoot: new Proxy({}, {
    get: (_t, p) => (p === 'customObjects' ? objects.customObjects : (shop.apiRoot as Record<string, unknown>)[p as string]),
  }),
}));
const rxMocks = vi.hoisted(() => ({ validateRxSelection: vi.fn(), findOwnPrescription: vi.fn(), RxNotFoundError: class extends Error {} }));
vi.mock('@/lib/ct/prescriptions', () => rxMocks);

import { CONTAINERS } from '@/lib/ct/custom-objects';
import type { CheckoutContext } from '@/lib/ct/checkout';
import { placeOrder, type PlaceOrderInput } from './orders';

const provider = createFakePaymentProvider();
const NOW = new Date('2026-10-08T09:00:00-04:00');
const ADDRESS = { country: 'US', state: 'NY', streetName: '12 Elm St', city: 'New York', postalCode: '10001', firstName: 'Sam', lastName: 'Rivera', phone: '+15125550100' };
const ATOR = 'MED-atorvastatin-20-mg';
const ctx = (fundingScheme?: string): CheckoutContext => ({
  patient: { patientRef: 'pt_sam', name: 'Sam Rivera', ...(fundingScheme ? { fundingScheme } : {}) },
  customerId: 'c-sam', cartId: undefined, rx: { locale: 'en-US', currency: 'USD', country: 'US' }, now: NOW,
});
const rx = (): Prescription => ({ number: 'RX-77102', patientRef: 'pt_sam', prescriber: 'Dr. Test', issuedAt: '2026-09-24', refillsLeft: 3, lines: [{ lineRef: 'RX-77102-1', sku: ATOR, name: 'A', sig: 'sig', qty: 30 }] });
const selected = { lineRef: 'RX-77102-1', sku: ATOR, qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null };
const totalOf = (cartId: string) => ({ centAmount: shop.carts.get(cartId)!.totalPrice.centAmount, currencyCode: 'USD' });
const input = (cartId: string, expectedTotal: { centAmount: number; currencyCode: string }, scheme?: string): PlaceOrderInput => ({
  ctx: ctx(scheme), cartId, expectedTotal, idempotencyKey: `${cartId}_${shop.carts.get(cartId)?.version}`,
});

beforeEach(() => {
  shop = createFakeShop();
  objects = createFakeObjects();
  provider.reset();
  objects.objects.push({ id: 'o-rx', container: CONTAINERS.rx, key: 'RX-77102', version: 1, value: rx(), createdAt: '', lastModifiedAt: '' });
  rxMocks.validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [selected], refused: [] });
  rxMocks.findOwnPrescription.mockReset().mockImplementation(async () => rx());
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  delete process.env.RESOLVER_FORCE_FAIL;
});

/** A cart the patient reviewed: atorvastatin at the owed price 375 (list 1875, plan covers 1500). */
const reviewed = (over: { owed?: number; covered?: number } = {}) =>
  shop.seedCart({ shippingAddress: ADDRESS, lines: [{ sku: ATOR, cents: 1875, owed: over.owed ?? 375, covered: over.covered ?? 1500 }] });

describe('payer-and-patient-cost-share: pre-order re-resolution (U-03)', () => {
  it('Figures unchanged between review and payment: the order is created at the owed price', async () => {
    const cart = reviewed();
    provider.authorize({ id: cart.id, total: totalOf(cart.id) });
    const outcome = await placeOrder(input(cart.id, { centAmount: 375, currencyCode: 'USD' }, 'Demo Health Plan'), provider);
    expect(outcome).toMatchObject({ ok: true });
    expect(shop.orders[0].totalPrice.centAmount).toBe(375);
    expect(shop.orders[0].lineItems[0].priceMode).toBe('ExternalPrice');
    expect((shop.orders[0].lineItems[0].custom?.fields as Record<string, unknown>).coveredAmount).toEqual({ currencyCode: 'USD', centAmount: 1500 });
  });

  it('the split moved between review and payment: the order is refused and the cart already shows the new split', async () => {
    // The patient saw 500 owed (plan 1375); the resolver now says 375.
    const cart = reviewed({ owed: 500, covered: 1375 });
    provider.authorize({ id: cart.id, total: totalOf(cart.id) });
    const outcome = await placeOrder(input(cart.id, { centAmount: 500, currencyCode: 'USD' }, 'Demo Health Plan'), provider);
    expect(outcome).toEqual({ ok: false, code: 'TOTALS_MOVED' });
    expect(shop.orders).toHaveLength(0);
    expect(shop.carts.get(cart.id)?.cartState).toBe('Active');
    expect(shop.carts.get(cart.id)?.lineItems[0].price.value.centAmount).toBe(375);
    expect(provider.released).toHaveLength(1);
  });

  it('Resolver unavailable: the order is refused as COVER_UNRESOLVED, nothing is created and no list price is written', async () => {
    process.env.RESOLVER_FORCE_FAIL = '1';
    const cart = reviewed();
    provider.authorize({ id: cart.id, total: totalOf(cart.id) });
    const outcome = await placeOrder(input(cart.id, { centAmount: 375, currencyCode: 'USD' }, 'Demo Health Plan'), provider);
    expect(outcome).toEqual({ ok: false, code: 'COVER_UNRESOLVED' });
    expect(shop.orders).toHaveLength(0);
    expect(shop.orderCreates).toHaveLength(0);
    expect(objects.objects.filter((o) => o.container === CONTAINERS.orderAttempt)).toHaveLength(0);
  });

  it('a patient without a scheme is not re-resolved at all', async () => {
    process.env.RESOLVER_FORCE_FAIL = '1';
    const cart = shop.seedCart({ shippingAddress: ADDRESS, lines: [{ sku: ATOR, cents: 1875 }] });
    provider.authorize({ id: cart.id, total: totalOf(cart.id) });
    const outcome = await placeOrder(input(cart.id, { centAmount: 1875, currencyCode: 'USD' }), provider);
    expect(outcome).toMatchObject({ ok: true });
    expect(shop.updates.flatMap((u) => u.actions).some((a) => a.action === 'setLineItemPrice')).toBe(false);
  });
});
