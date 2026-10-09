// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { createFakeShop, usd, type FakeShop } from '@/test/fake-shop';
import { createFakePaymentProvider } from '@/lib/checkout/fake-provider';
import type { Prescription } from '@/lib/clinical/types';
import type { Cart as CtCart } from '@commercetools/platform-sdk';

let shop: FakeShop;
let objects: FakeObjects;
vi.mock('@/lib/ct/client', () => ({
  apiRoot: new Proxy({}, {
    get: (_t, p) => (p === 'customObjects' ? objects.customObjects : (shop.apiRoot as Record<string, unknown>)[p as string]),
  }),
}));
const rxMocks = vi.hoisted(() => ({ validateRxSelection: vi.fn(), findOwnPrescription: vi.fn(), RxNotFoundError: class extends Error {} }));
vi.mock('@/lib/ct/prescriptions', () => rxMocks);
vi.mock('@/lib/ct/rx-catalog', () => ({ getCatalogBySku: async () => new Map() }));
vi.mock('@/lib/ct/patient', () => ({ getPatient: async () => ({ patientRef: 'pt_sam', name: 'Sam Rivera' }) }));

import { CONTAINERS } from '@/lib/ct/custom-objects';
import { getBalance, grantCycle } from '@/lib/ct/allowance';
import { cancelOrderForCustomer } from '@/lib/ct/order-cancel';
import * as ordersModule from '@/lib/ct/orders';
import { makePlaceOrder } from '@/test/checkout-flow';
import { setRestrictedChoice } from '@/lib/ct/tender';

const provider = createFakePaymentProvider();
const NOW = new Date('2026-10-08T09:00:00-04:00');
const ADDRESS = { country: 'US', state: 'NY', streetName: '12 Elm St', city: 'New York', postalCode: '10001', firstName: 'Sam', lastName: 'Rivera', phone: '+15125550100' };
const ATOR = 'MED-atorvastatin-20-mg';
const ALP = 'MED-alprazolam-0-5-mg';
const rx = (): Prescription => ({
  number: 'RX-77102', patientRef: 'pt_sam', prescriber: 'Dr. Test', issuedAt: '2026-09-24', refillsLeft: 3,
  lines: [{ lineRef: 'RX-77102-1', sku: ATOR, name: 'A', sig: 'sig', qty: 30 }, { lineRef: 'RX-77102-2', sku: ALP, name: 'B', sig: 'sig', qty: 30 }],
});
const sel = (n: number, sku: string) => ({ lineRef: `RX-77102-${n}`, sku, qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  shop = createFakeShop();
  objects = createFakeObjects();
  provider.reset();
  objects.objects.push({ id: 'o-rx', container: CONTAINERS.rx, key: 'RX-77102', version: 1, value: rx(), createdAt: '', lastModifiedAt: '' });
  rxMocks.validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [sel(1, ATOR), sel(2, ALP)], refused: [] });
  rxMocks.findOwnPrescription.mockReset().mockImplementation(async () => rx());
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await grantCycle('pt_sam', '2026-10', 1000);
});

/** A mixed order paid with all three tenders: allowance 1000, restricted instrument 1875, card 260. */
async function placeMixedOrder() {
  const cart = shop.seedCart({
    shippingAddress: ADDRESS,
    lines: [
      { sku: ATOR, cents: 1875, eligible: true, rxNumber: 'RX-77102', lineRef: 'RX-77102-1' },
      { sku: ALP, cents: 1260, eligible: false, rxNumber: 'RX-77102', lineRef: 'RX-77102-2' },
    ],
  });
  await setRestrictedChoice(structuredClone(cart) as unknown as CtCart, true, { patientRef: 'pt_sam', now: NOW });
  // Checkout collects the card remainder (260) and creates the order; the storefront then finalizes it.
  const outcome = await makePlaceOrder(shop, ordersModule)({ ctx: { patient: { patientRef: 'pt_sam', name: 'Sam Rivera' }, customerId: 'c-sam', cartId: undefined, rx: { locale: 'en-US', currency: 'USD', country: 'US' }, now: NOW }, cartId: cart.id, expectedTotal: { centAmount: 3135, currencyCode: 'USD' } }, provider);
  if (!outcome.ok) throw new Error(`placement failed: ${outcome.code}`);
  return outcome.orderId;
}

/** Plays the connector: Checkout's Payment Intents API records the cancel on the card Payment. */
const connector = () => ({
  kind: 'demo' as const,
  createSession: vi.fn(),
  release: vi.fn(async (id: string) => {
    shop.payments.get(id)!.transactions.push({ id: `c-${id}`, type: 'CancelAuthorization', state: 'Success', amount: usd(260) });
  }),
  refund: vi.fn(async () => undefined),
  listStoredMethods: vi.fn(async () => []),
  setDefaultStoredMethod: vi.fn(async () => undefined),
  removeStoredMethod: vi.fn(async () => undefined),
});
const cardPayment = () => [...shop.payments.values()].find((x) => x.paymentMethodInfo.method === 'card')!;

describe('eligible-item-tender-restriction: Refund returns to its own instrument (U-09)', () => {
  it('cancelling a mixed order: the allowance and the instrument return their own share at once, the card is cancelled through Checkout, the balance restored', async () => {
    const orderId = await placeMixedOrder();
    expect(await getBalance('pt_sam', NOW)).toBe(0);
    const p = connector();
    const outcome = await cancelOrderForCustomer(orderId, 'c-sam', p, 'en-US');
    expect(outcome.kind).toBe('cancelled');
    const refund = (id: string) => shop.payments.get(id)!.transactions.filter((t) => t.type === 'Refund');
    const [allowance, restricted] = shop.orders[0].paymentInfo!.payments.map((r) => shop.payments.get(r.id)!).filter((x) => x.paymentMethodInfo.method !== 'card');
    expect(allowance.paymentMethodInfo.method).toBe('allowance');
    expect(refund(allowance.id)).toEqual([expect.objectContaining({ state: 'Success', amount: expect.objectContaining({ centAmount: 1000 }) })]);
    expect(restricted.paymentMethodInfo.method).toBe('restricted-health-account');
    expect(refund(restricted.id)).toEqual([expect.objectContaining({ state: 'Success', amount: expect.objectContaining({ centAmount: 1875 }) })]);
    // The card share is Checkout's: no marker of ours, a cancel request through the seam.
    expect(refund(cardPayment().id)).toHaveLength(0);
    expect(p.release).toHaveBeenCalledWith(cardPayment().id);
    expect(await getBalance('pt_sam', NOW)).toBe(1000);
    // Nothing was captured on the card: "Payment released".
    if (outcome.kind === 'cancelled') expect(outcome.order.refund).toBe('released');
  });

  it('a second cancel adds no second refund, no second request to Checkout and restores nothing twice', async () => {
    const orderId = await placeMixedOrder();
    const p = connector();
    await cancelOrderForCustomer(orderId, 'c-sam', p, 'en-US');
    await cancelOrderForCustomer(orderId, 'c-sam', p, 'en-US');
    for (const payment of shop.payments.values()) expect(payment.transactions.filter((t) => t.type === 'Refund')).toHaveLength(payment.paymentMethodInfo.method === 'card' ? 0 : 1);
    expect(p.release).toHaveBeenCalledTimes(1);
    expect(await getBalance('pt_sam', NOW)).toBe(1000);
  });
});
