// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('@/lib/ct/rx-catalog', () => ({ getCatalogBySku: async () => new Map() }));
vi.mock('@/lib/ct/patient', () => ({ getPatient: async () => ({ patientRef: 'pt_sam', name: 'Sam Rivera' }) }));
// The draw can be forced short, as when another order takes the balance between the plan and the draw.
const drawOverride = vi.hoisted(() => ({ short: 0 }));
vi.mock('@/lib/ct/allowance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ct/allowance')>();
  return {
    ...actual,
    drawdown: async (patientRef: string, orderId: string, amount: number, now?: Date) => (drawOverride.short > 0 ? { applied: Math.max(0, amount - drawOverride.short), alreadyApplied: false, cycle: '2026-10' } : actual.drawdown(patientRef, orderId, amount, now)),
  };
});

import { CONTAINERS } from '@/lib/ct/custom-objects';
import type { CheckoutContext } from '@/lib/ct/checkout';
import { getBalance, grantCycle } from '@/lib/ct/allowance';
import { setRestrictedChoice } from '@/lib/ct/tender';
import * as ordersModule from './orders';
import { prepareCheckout } from './orders';
import { makePlaceOrder, type FlowInput } from '@/test/checkout-flow';

type PlaceOrderInput = FlowInput & { idempotencyKey?: string };
const placeOrder = (flow: PlaceOrderInput, provider: Parameters<ReturnType<typeof makePlaceOrder>>[1], options?: { cardCents?: number }) => makePlaceOrder(shop, ordersModule)(flow, provider, options);
import type { Cart as CtCart } from '@commercetools/platform-sdk';

const provider = createFakePaymentProvider();
const NOW = new Date('2026-10-08T09:00:00-04:00');
const ADDRESS = { country: 'US', state: 'NY', streetName: '12 Elm St', city: 'New York', postalCode: '10001', firstName: 'Sam', lastName: 'Rivera', phone: '+15125550100' };
const ATOR = 'MED-atorvastatin-20-mg';
const ALP = 'MED-alprazolam-0-5-mg';
const ctx = (): CheckoutContext => ({ patient: { patientRef: 'pt_sam', name: 'Sam Rivera' }, customerId: 'c-sam', cartId: undefined, rx: { locale: 'en-US', currency: 'USD', country: 'US' }, now: NOW });
const rx = (): Prescription => ({
  number: 'RX-77102', patientRef: 'pt_sam', prescriber: 'Dr. Test', issuedAt: '2026-09-24', refillsLeft: 3,
  lines: [
    { lineRef: 'RX-77102-1', sku: ATOR, name: 'A', sig: 'sig', qty: 30 },
    { lineRef: 'RX-77102-2', sku: ALP, name: 'B', sig: 'sig', qty: 30 },
  ],
});
const sel = (n: number, sku: string) => ({ lineRef: `RX-77102-${n}`, sku, qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null });
const totalOf = (cartId: string) => ({ centAmount: shop.carts.get(cartId)!.totalPrice.centAmount, currencyCode: 'USD' });
const input = (cartId: string): PlaceOrderInput => ({ ctx: ctx(), cartId, expectedTotal: totalOf(cartId), idempotencyKey: `${cartId}_${shop.carts.get(cartId)?.version}` });
const authorize = (cartId: string, centAmount: number) => provider.authorize({ id: cartId, total: { centAmount, currencyCode: 'USD' } });
const payments = (orderIndex = 0) => (shop.orders[orderIndex]?.paymentInfo?.payments ?? []).map((ref) => shop.payments.get(ref.id)!);
const byMethod = (method: string, orderIndex = 0) => payments(orderIndex).find((p) => p.paymentMethodInfo.method === method);

function cartOf(lines: { sku: string; cents: number; eligible?: boolean }[]) {
  return shop.seedCart({ shippingAddress: ADDRESS, lines: lines.map((l, i) => ({ ...l, rxNumber: 'RX-77102', lineRef: `RX-77102-${i + 1}` })) });
}
const asCt = (cartId: string) => structuredClone(shop.carts.get(cartId)) as unknown as CtCart;

beforeEach(async () => {
  shop = createFakeShop();
  objects = createFakeObjects();
  provider.reset();
  drawOverride.short = 0;
  objects.objects.push({ id: 'o-rx', container: CONTAINERS.rx, key: 'RX-77102', version: 1, value: rx(), createdAt: '', lastModifiedAt: '' });
  rxMocks.validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [sel(1, ATOR), sel(2, ALP)], refused: [] });
  rxMocks.findOwnPrescription.mockReset().mockImplementation(async () => rx());
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await grantCycle('pt_sam', '2026-10', 5000);
});

describe('benefit-allowance-drawdown: allowance as its own Payment before the card (U-06)', () => {
  it('Allowance covers the order: the whole total is drawn, no other tender is taken, the new balance is stated', async () => {
    const cart = cartOf([{ sku: ATOR, cents: 1875 }]);
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toMatchObject({ ok: true });
    const allowance = byMethod('allowance')!;
    expect(allowance).toMatchObject({ amountPlanned: { centAmount: 1875 }, transactions: [{ type: 'Charge', state: 'Success', amount: { centAmount: 1875 } }] });
    expect(allowance.paymentMethodInfo).toMatchObject({ method: 'allowance' });
    expect(payments()).toHaveLength(1);
    expect(provider.released).toHaveLength(0);
    expect(await getBalance('pt_sam', NOW)).toBe(3125);
    expect(shop.orders[0].custom?.fields).toMatchObject({ allowanceApplied: { centAmount: 1875 }, restrictedApplied: { centAmount: 0 } });
    expect(shop.orders[0].totalPrice.centAmount).toBe(1875);
  });

  it('Allowance partly covers the order: the allowance is consumed in full and the shortfall is the card payment', async () => {
    await (async () => {
      const { drawdown } = await import('@/lib/ct/allowance');
      await drawdown('pt_sam', 'earlier-order', 4125, NOW);
    })();
    const cart = cartOf([{ sku: ATOR, cents: 1875 }]);
    authorize(cart.id, 1000);
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toMatchObject({ ok: true });
    expect(byMethod('allowance')).toMatchObject({ amountPlanned: { centAmount: 875 }, transactions: [{ type: 'Charge', amount: { centAmount: 875 } }] });
    expect(await getBalance('pt_sam', NOW)).toBe(0);
  });

  it('partly covered: the allowance Payment is on the cart BEFORE Checkout runs and Checkout is started for the shortfall only', async () => {
    const { drawdown } = await import('@/lib/ct/allowance');
    await drawdown('pt_sam', 'earlier-order', 4125, NOW);
    const cart = cartOf([{ sku: ATOR, cents: 1875 }]);
    const gate = await prepareCheckout(input(cart.id), provider);
    expect(gate).toMatchObject({ ok: true, kind: 'demo', cardDue: 1000 });
    const onCart = (shop.carts.get(cart.id)?.paymentInfo?.payments ?? []).map((ref) => shop.payments.get(ref.id)!);
    expect(onCart.map((p) => [p.paymentMethodInfo.method, p.amountPlanned.centAmount])).toEqual([['allowance', 875]]);
    // Nothing is drawn until the order exists.
    expect(shop.orders).toHaveLength(0);
    expect(await getBalance('pt_sam', NOW)).toBe(875);
  });

  it('the allowance is drawn once for the order id, also when the same key is placed again', async () => {
    const cart = cartOf([{ sku: ATOR, cents: 1875 }]);
    const key = `${cart.id}_1`;
    const first = await placeOrder({ ...input(cart.id), idempotencyKey: key }, provider);
    const second = await placeOrder({ ...input(cart.id), idempotencyKey: key }, provider);
    expect(first.ok && second.ok).toBe(true);
    expect(await getBalance('pt_sam', NOW)).toBe(3125);
    expect(shop.orders).toHaveLength(1);
  });

  it('Checkout ignored the tender Payments and charged the whole total: the order is refused, the card is given back and the allowance is NOT drawn (no double charge)', async () => {
    const { drawdown } = await import('@/lib/ct/allowance');
    await drawdown('pt_sam', 'earlier-order', 4125, NOW);
    const cart = cartOf([{ sku: ATOR, cents: 1875 }]);
    const outcome = await placeOrder(input(cart.id), provider, { cardCents: 1875 });
    expect(outcome).toEqual({ ok: false, code: 'FUNDING_CHANGED' });
    expect(shop.orders[0].state?.key).toBe('mlv-cancelled');
    expect(provider.released).toHaveLength(1);
    expect(await getBalance('pt_sam', NOW)).toBe(875);
    expect((objects.objects.find((o) => o.container === CONTAINERS.rx)!.value as Prescription).refillsLeft).toBe(3);
  });

  it('the allowance covers everything: Checkout is not started, the storefront creates and finalizes the order itself', async () => {
    const cart = cartOf([{ sku: ATOR, cents: 1875 }]);
    const gate = await prepareCheckout(input(cart.id), provider);
    expect(gate).toMatchObject({ ok: true, kind: 'order', orderNumber: 'MLV-000001' });
    expect(shop.orders).toHaveLength(1);
    expect(payments().map((p) => p.paymentMethodInfo.method)).toEqual(['allowance']);
    expect(await getBalance('pt_sam', NOW)).toBe(3125);
  });

  it('the balance fell between plan and draw: the order is cancelled, the refill and the part draw are given back, the card is released', async () => {
    const cart = cartOf([{ sku: ATOR, cents: 1875 }]);
    authorize(cart.id, 1875);
    // Plan: allowance 1875, so the stale 1875 card authorization is voided; re-authorize nothing needed. The draw then comes back short.
    drawOverride.short = 500;
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toEqual({ ok: false, code: 'FUNDING_CHANGED' });
    expect(shop.orders[0].state?.key).toBe('mlv-cancelled');
    expect((objects.objects.find((o) => o.container === CONTAINERS.rx)!.value as Prescription).refillsLeft).toBe(3);
    expect(await getBalance('pt_sam', NOW)).toBe(5000);
  });

  it('a member without an allowance is placed exactly as before (card for the whole total, no tender payments)', async () => {
    objects.objects = objects.objects.filter((o) => o.container !== CONTAINERS.allowance);
    const cart = cartOf([{ sku: ATOR, cents: 1875 }]);
    authorize(cart.id, 1875);
    expect(await placeOrder(input(cart.id), provider)).toMatchObject({ ok: true });
    expect(payments().filter((p) => p.paymentMethodInfo.method !== 'card')).toHaveLength(0);
    expect(shop.orders[0].custom).toBeUndefined();
  });
});

describe('eligible-item-tender-restriction: restricted instrument Payment (U-09)', () => {
  beforeEach(() => {
    objects.objects = objects.objects.filter((o) => o.container !== CONTAINERS.allowance);
  });

  it('Wholly eligible basket: the restricted instrument settles the whole order and no card is taken', async () => {
    const cart = cartOf([{ sku: ATOR, cents: 1875, eligible: true }]);
    expect(await setRestrictedChoice(asCt(cart.id), true, { patientRef: 'pt_sam', now: NOW })).toMatchObject({ ok: true });
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toMatchObject({ ok: true });
    expect(byMethod('restricted-health-account')).toMatchObject({ amountPlanned: { centAmount: 1875 }, transactions: [{ type: 'Charge', state: 'Success', amount: { centAmount: 1875 } }] });
    expect(shop.orders[0].custom?.fields).toMatchObject({ restrictedApplied: { centAmount: 1875 }, allowanceApplied: { centAmount: 0 } });
  });

  it('Mixed basket splits: the instrument is charged the eligible subtotal only and the card the rest', async () => {
    const cart = cartOf([{ sku: ATOR, cents: 1875, eligible: true }, { sku: ALP, cents: 1260, eligible: false }]);
    await setRestrictedChoice(asCt(cart.id), true, { patientRef: 'pt_sam', now: NOW });
    expect(await prepareCheckout(input(cart.id), provider)).toMatchObject({ ok: true, kind: 'demo', cardDue: 1260 });
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toMatchObject({ ok: true });
    expect(byMethod('restricted-health-account')?.amountPlanned.centAmount).toBe(1875);
    // Checkout collected the card remainder only.
    expect(byMethod('card')?.amountPlanned.centAmount).toBe(1260);
  });

  it('Eligibility visible on the order: each line records whether it was eligible and which instrument settled it', async () => {
    const cart = cartOf([{ sku: ATOR, cents: 1875, eligible: true }, { sku: ALP, cents: 1260, eligible: false }]);
    await setRestrictedChoice(asCt(cart.id), true, { patientRef: 'pt_sam', now: NOW });
    authorize(cart.id, 1260);
    await placeOrder(input(cart.id), provider);
    const [eligible, ineligible] = shop.orders[0].lineItems.map((l) => l.custom!.fields as Record<string, unknown>);
    expect(eligible).toMatchObject({ eligibleForRestricted: true });
    expect(JSON.parse(String(eligible.settlement))).toEqual({ allowance: 0, 'restricted-health-account': 1875, card: 0 });
    expect(ineligible).toMatchObject({ eligibleForRestricted: false });
    expect(JSON.parse(String(ineligible.settlement))).toEqual({ allowance: 0, 'restricted-health-account': 0, card: 1260 });
  });

  it('Wholly ineligible basket: the instrument is refused with the reason and nothing is attached', async () => {
    const cart = cartOf([{ sku: ALP, cents: 1260, eligible: false }]);
    expect(await setRestrictedChoice(asCt(cart.id), true, { patientRef: 'pt_sam', now: NOW })).toEqual({ ok: false, reason: 'none-eligible' });
    expect(shop.payments.size).toBe(0);
  });

  it('Basket change re splits: an eligible line added after the choice raises the instrument amount before payment is taken', async () => {
    const cart = cartOf([{ sku: ATOR, cents: 1875, eligible: true }]);
    await setRestrictedChoice(asCt(cart.id), true, { patientRef: 'pt_sam', now: NOW });
    expect(byMethodOnCart(cart.id)?.amountPlanned.centAmount).toBe(1875);
    // Another eligible line arrives (the basket changed since the choice was made).
    const stored = shop.carts.get(cart.id)!;
    stored.lineItems.push({ ...structuredClone(stored.lineItems[0]), id: 'li-extra', price: { id: 'p2', value: { ...stored.lineItems[0].price.value, centAmount: 1000 } }, listCents: 1000, totalPrice: { ...stored.totalPrice, centAmount: 1000 } });
    stored.lineItems[1].variant = { id: 1, sku: ALP };
    stored.lineItems[1].custom = { type: { typeId: 'type', id: 't', key: 'mlv-rx-line' }, fields: { rxNumber: 'RX-77102', rxLineRef: 'RX-77102-2', prescribedQty: 30, eligibleForRestricted: true } };
    stored.totalPrice = { ...stored.totalPrice, centAmount: 2875 };
    stored.taxedPrice = { totalNet: stored.totalPrice, totalGross: stored.totalPrice, totalTax: { ...stored.totalPrice, centAmount: 0 } };
    stored.version += 1;
    const outcome = await placeOrder({ ctx: ctx(), cartId: cart.id, expectedTotal: { centAmount: 2875, currencyCode: 'USD' }, idempotencyKey: 'k-resplit' }, provider);
    expect(outcome).toMatchObject({ ok: true });
    expect(byMethod('restricted-health-account')?.amountPlanned.centAmount).toBe(2875);
  });

  it('dropping the instrument detaches its payment and the card is back to the whole total', async () => {
    const cart = cartOf([{ sku: ATOR, cents: 1875, eligible: true }]);
    await setRestrictedChoice(asCt(cart.id), true, { patientRef: 'pt_sam', now: NOW });
    const off = await setRestrictedChoice(asCt(cart.id), false, { patientRef: 'pt_sam', now: NOW });
    expect(off).toMatchObject({ ok: true, view: { card: { centAmount: 1875 }, restricted: { chosen: false } } });
    expect(shop.carts.get(cart.id)?.paymentInfo?.payments ?? []).toHaveLength(0);
  });

  it('allowance first, then the restricted instrument, then the card, in one order', async () => {
    await grantCycle('pt_sam', '2026-10', 1000);
    const cart = cartOf([{ sku: ATOR, cents: 1875, eligible: true }, { sku: ALP, cents: 1260, eligible: false }]);
    await setRestrictedChoice(asCt(cart.id), true, { patientRef: 'pt_sam', now: NOW });
    // Allowance 1000, restricted min(2135, 1875)=1875, card 260.
    authorize(cart.id, 260);
    const outcome = await placeOrder(input(cart.id), provider);
    expect(outcome).toMatchObject({ ok: true });
    expect(payments().map((p) => [p.paymentMethodInfo.method, p.amountPlanned.centAmount]).sort()).toEqual([['allowance', 1000], ['card', 260], ['restricted-health-account', 1875]]);
    expect(await getBalance('pt_sam', NOW)).toBe(0);
  });
});

const byMethodOnCart = (cartId: string) => (shop.carts.get(cartId)?.paymentInfo?.payments ?? []).map((r) => shop.payments.get(r.id)!).find((p) => p.paymentMethodInfo.method === 'restricted-health-account');
