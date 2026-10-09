// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeCarts, type FakeCarts } from '@/test/fake-carts';

let fake: FakeCarts;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake.apiRoot as Record<string, unknown>)[p as string] }) }));
const { validateRxSelection } = vi.hoisted(() => ({ validateRxSelection: vi.fn() }));
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError: class extends Error {}, validateRxSelection: (...a: unknown[]) => validateRxSelection(...a) }));

import { addRxLines, getCartValidated, removeLine } from './cart';
import { applyFunding } from './cart-funding';
import { createDemoResolver } from '@/lib/funding/resolver';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
const sam = { patientRef: 'pt_sam', name: 'Sam Rivera', fundingScheme: 'Demo Health Plan' };
const alex = { patientRef: 'pt_alex', name: 'Alex Chen' };
const sel = (lineRef: string, sku: string) => ({ lineRef, sku, qty: 30, packs: 1, price: null, perOrderMax: null, periodCeiling: null });
const ATOR = 'MED-atorvastatin-20-mg';
const LIS = 'MED-lisinopril-10-mg';
const AMOX = 'MED-amoxicillin-500-mg';
const IBU = 'MED-ibuprofen-400-mg';

beforeEach(() => {
  fake = createFakeCarts({ [ATOR]: 1875, [LIS]: 1140, [AMOX]: 1450, [IBU]: 620 });
  validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [], refused: [] });
});
afterEach(() => {
  delete process.env.RESOLVER_FORCE_FAIL;
});

const priceActions = () => fake.updates.flatMap((u) => u.actions).filter((a) => a.action === 'setLineItemPrice');

describe('payer-and-patient-cost-share: cart integration (U-02)', () => {
  it('Covered line shows both figures: the external price is what the patient owes and the covered share is on the line', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR)], ctx, sam);
    expect(cart.lines[0]).toMatchObject({ cover: 'partly', unitPrice: { centAmount: 375 }, youOwe: { centAmount: 375 }, coveredAmount: { centAmount: 1500 } });
    expect(cart).toMatchObject({ youOwe: { centAmount: 375 }, planCovers: { centAmount: 1500 }, total: { centAmount: 375 } });
    const stored = fake.carts.get(cart.id)!.lineItems[0];
    expect(stored.priceMode).toBe('ExternalPrice');
    expect(stored.price.value.centAmount).toBe(375);
    expect((stored.custom!.fields as Record<string, unknown>).coveredAmount).toEqual({ currencyCode: 'USD', centAmount: 1500 });
  });

  it('the covered amount is not a cart discount', async () => {
    await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR)], ctx, sam);
    const actions = fake.updates.flatMap((u) => u.actions).map((a) => a.action);
    expect(actions.some((a) => /discount/i.test(a))).toBe(false);
    expect(priceActions()).toEqual([{ action: 'setLineItemPrice', lineItemId: expect.any(String), externalPrice: { currencyCode: 'USD', centAmount: 375 } }]);
  });

  it('Uncovered line in a covered basket: it stays at the platform price with a zero cover', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR), sel('RX-77102-2', IBU)], ctx, sam);
    expect(cart.lines[1]).toMatchObject({ cover: 'not-covered', unitPrice: { centAmount: 620 }, coveredAmount: { centAmount: 0 } });
    expect(fake.carts.get(cart.id)!.lineItems[1].priceMode).not.toBe('ExternalPrice');
    expect(cart.planCovers?.centAmount).toBe(1500);
    expect(cart.youOwe?.centAmount).toBe(375 + 620);
  });

  it('Basket change alters existing cover: adding an antibiotic line re-resolves the lines already in the cart', async () => {
    const first = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR), sel('RX-77102-2', LIS)], ctx, sam);
    expect(first.cart.lines.map((l) => l.coveredAmount?.centAmount)).toEqual([1500, 912]);
    const second = await addRxLines('c-sam', first.cart.id, 'RX-48213', [sel('RX-48213-1', AMOX)], ctx, sam);
    expect(second.cart.lines[0]!.coveredAmount!.centAmount).toBeLessThan(1500);
    expect(second.cart.lines[0]!.youOwe!.centAmount).toBeGreaterThan(375);
    expect(second.cart.planCovers!.centAmount).toBeLessThanOrEqual(3000);
    // Removing it again restores the first figures.
    const back = await removeLine('c-sam', second.cart.id, second.cart.lines[2]!.id, 'USD', sam);
    expect(back?.cart.lines.map((l) => l.coveredAmount?.centAmount)).toEqual([1500, 912]);
  });

  it('a patient without a funding scheme gets the list price and no cover fields', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR)], ctx, alex);
    expect(cart.lines[0]).not.toHaveProperty('cover');
    expect(cart.total.centAmount).toBe(1875);
    expect(cart.youOwe).toBeUndefined();
    expect(priceActions()).toHaveLength(0);
  });

  it('cart load re-resolves and picks up a changed catalog price (the list price, not the owed price)', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR)], ctx, sam);
    await getCartValidated(sam, 'c-sam', cart.id, ctx);
    fake.prices.set(ATOR, 2000);
    const out = await getCartValidated(sam, 'c-sam', cart.id, ctx);
    expect(out?.lines[0]).toMatchObject({ coveredAmount: { centAmount: 1600 }, youOwe: { centAmount: 400 }, priceUpdated: true });
  });

  it('cart load sends the external prices back to the platform price before recalculating', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR)], ctx, sam);
    fake.updates.length = 0;
    await getCartValidated(sam, 'c-sam', cart.id, ctx);
    const first = fake.updates[0].actions.map((a) => a.action);
    expect(first).toEqual(['setLineItemPrice', 'recalculate']);
    expect(fake.updates[0].actions[0]).not.toHaveProperty('externalPrice');
  });

  it('a second resolution with nothing changed writes nothing', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR)], ctx, sam);
    const raw = fake.carts.get(cart.id)!;
    const before = fake.updates.length;
    await applyFunding(structuredClone(raw) as never, sam);
    expect(fake.updates.length).toBe(before);
  });

  it('Resolver unavailable: the cart is unresolved, shows no cover, and the list price is never written as the answer', async () => {
    process.env.RESOLVER_FORCE_FAIL = '1';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR)], ctx, sam);
    expect(cart.unresolved).toBe(true);
    expect(cart.lines[0]).toMatchObject({ cover: 'unresolved' });
    expect(cart.lines[0]).not.toHaveProperty('coveredAmount');
    expect(cart).not.toHaveProperty('planCovers');
    const loaded = await getCartValidated(sam, 'c-sam', cart.id, ctx);
    expect(loaded?.unresolved).toBe(true);
    expect(priceActions().filter((a) => 'externalPrice' in a)).toHaveLength(0);
  });

  it('the resolver is asked with the list price of lines that already carry an external price', async () => {
    const { cart } = await addRxLines('c-sam', undefined, 'RX-77102', [sel('RX-77102-1', ATOR)], ctx, sam);
    const resolve = vi.fn().mockImplementation(createDemoResolver().resolve);
    await applyFunding(fake.carts.get(cart.id) as never, sam, { resolve });
    expect(resolve.mock.calls[0]![1]).toEqual([{ sku: ATOR, unit: 1875, quantity: 1 }]);
  });
});
