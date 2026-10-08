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

import { CONTAINERS } from '@/lib/ct/custom-objects';
import { getBalance, grantCycle } from '@/lib/ct/allowance';
import { cancelOrderForCustomer } from '@/lib/ct/order-cancel';
import { placeOrder } from '@/lib/ct/orders';
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
  // The card Payment Checkout would have created for the remainder.
  shop.payments.set('pay-card', { id: 'pay-card', version: 1, createdAt: '2026-10-08T12:00:00Z', amountPlanned: usd(260), paymentMethodInfo: { paymentInterface: 'stripe', method: 'card' }, transactions: [{ id: 't1', type: 'Authorization', state: 'Success', amount: usd(260) }] });
  const stored = shop.carts.get(cart.id)!;
  stored.paymentInfo = { payments: [...(stored.paymentInfo?.payments ?? []), { typeId: 'payment', id: 'pay-card' }] };
  stored.version += 1;
  provider.authorize({ id: cart.id, total: { centAmount: 260, currencyCode: 'USD' } });
  const outcome = await placeOrder({ ctx: { patient: { patientRef: 'pt_sam', name: 'Sam Rivera' }, customerId: 'c-sam', cartId: undefined, rx: { locale: 'en-US', currency: 'USD', country: 'US' }, now: NOW }, cartId: cart.id, expectedTotal: { centAmount: 3135, currencyCode: 'USD' }, idempotencyKey: `${cart.id}_x` }, provider);
  if (!outcome.ok) throw new Error(`placement failed: ${outcome.code}`);
  return outcome.orderId;
}

describe('eligible-item-tender-restriction: Refund returns to its own instrument (U-09)', () => {
  it('cancelling a mixed order: each Payment refunds the amount it took, the card share for the payment service, the balance restored', async () => {
    const orderId = await placeMixedOrder();
    expect(await getBalance('pt_sam', NOW)).toBe(0);
    const p = { kind: 'demo' as const, createSession: vi.fn(), getAuthorization: vi.fn(), release: vi.fn(async () => undefined) };
    const outcome = await cancelOrderForCustomer(orderId, 'c-sam', p, 'en-US');
    expect(outcome.kind).toBe('cancelled');
    const refund = (id: string) => shop.payments.get(id)!.transactions.filter((t) => t.type === 'Refund');
    const [allowance, restricted] = shop.orders[0].paymentInfo!.payments.map((r) => shop.payments.get(r.id)!).filter((x) => x.paymentMethodInfo.method !== 'card');
    expect(allowance.paymentMethodInfo.method).toBe('allowance');
    expect(refund(allowance.id)).toEqual([expect.objectContaining({ state: 'Success', amount: expect.objectContaining({ centAmount: 1000 }) })]);
    expect(restricted.paymentMethodInfo.method).toBe('restricted-health-account');
    expect(refund(restricted.id)).toEqual([expect.objectContaining({ state: 'Success', amount: expect.objectContaining({ centAmount: 1875 }) })]);
    expect(refund('pay-card')).toEqual([expect.objectContaining({ state: 'Initial', amount: expect.objectContaining({ centAmount: 260 }) })]);
    expect(await getBalance('pt_sam', NOW)).toBe(1000);
    // Only the card share is open: the order page says refund requested, not refunded.
    if (outcome.kind === 'cancelled') expect(outcome.order.refund).toBe('requested');
  });

  it('a second cancel adds no second refund and restores nothing twice', async () => {
    const orderId = await placeMixedOrder();
    const p = { kind: 'demo' as const, createSession: vi.fn(), getAuthorization: vi.fn(), release: vi.fn(async () => undefined) };
    await cancelOrderForCustomer(orderId, 'c-sam', p, 'en-US');
    await cancelOrderForCustomer(orderId, 'c-sam', p, 'en-US');
    for (const payment of shop.payments.values()) expect(payment.transactions.filter((t) => t.type === 'Refund')).toHaveLength(1);
    expect(await getBalance('pt_sam', NOW)).toBe(1000);
  });
});
