// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Credential, Prescription } from '@/lib/clinical/types';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import { createFakePaymentProvider } from '@/lib/checkout/fake-provider';
import { CATALOG, usd } from '@/test/rx-fixtures-for-tests';
import type { Medication } from '@/lib/types';

let shop: FakeShop;
let objects: FakeObjects;
vi.mock('@/lib/ct/client', () => ({
  apiRoot: new Proxy({}, { get: (_t, p) => (p === 'customObjects' ? objects.customObjects : (shop.apiRoot as Record<string, unknown>)[p as string]) }),
}));

const TRAMADOL = 'MED-tram';
const ator = CATALOG['MED-ator']!;
const catalog: Record<string, Medication> = { 'MED-ator': ator, [TRAMADOL]: { ...ator, id: TRAMADOL, key: TRAMADOL, sku: TRAMADOL, name: 'Tramadol', price: usd(1310), hsaEligible: false, controlClass: 'schedule-iv', maxQtyPerOrder: 1 } };
const rxFor = (patientRef: string, number: string): Prescription => ({
  number, patientRef, prescriber: 'Dr. Test', issuedAt: '2026-10-01', refillsLeft: 2,
  lines: [
    { lineRef: `${number}-1`, sku: 'MED-ator', name: 'Atorvastatin', sig: 'sig', qty: 30 },
    { lineRef: `${number}-2`, sku: TRAMADOL, name: 'Tramadol', sig: 'sig', qty: 30 },
  ],
});
const state = vi.hoisted(() => ({ credentials: [] as Credential[], rx: [] as Prescription[] }));
vi.mock('@/lib/ct/clinical-store', () => ({
  prescriptionSource: {
    listForPatient: async (ref: string) => state.rx.filter((r) => r.patientRef === ref),
    getByNumber: async (n: string) => state.rx.find((r) => r.number === n) ?? null,
  },
  credentialSource: {
    listForPatient: async (ref: string) => state.credentials.filter((c) => c.patientRef === ref),
    get: async (ref: string, cls: string) => state.credentials.find((c) => c.patientRef === ref && c.class === cls) ?? null,
  },
}));
vi.mock('@/lib/ct/shelf-life', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ct/shelf-life')>()),
  getSupplyBySku: async (skus: string[]) => new Map(skus.map((sku) => [sku, { sku, available: 600 }])),
}));
vi.mock('@/lib/ct/rx-catalog', () => ({
  getCatalogBySku: async (skus: string[]) => new Map(skus.filter((s) => catalog[s]).map((s) => [s, { medication: catalog[s], shortDatedPrice: null }])),
}));

import { checkLines } from '@/lib/ct/cart-validation';
import { CONTAINERS } from '@/lib/ct/custom-objects';
import type { CheckoutContext } from '@/lib/ct/checkout';
import { getRxView, validateRxSelection } from '@/lib/ct/prescriptions';
import { placeOrder } from '@/lib/ct/orders';

const NOW = new Date('2026-10-08T12:00:00Z');
const ctxRx = { locale: 'en-US', currency: 'USD', country: 'US', now: NOW };
const sam = { patientRef: 'pt_sam', name: 'Sam Rivera' };
const alex = { patientRef: 'pt_alex', name: 'Alex Chen' };
const jordan = { patientRef: 'pt_jordan', name: 'Jordan Lee' };
const credential = (patientRef: string, over: Partial<Credential> = {}): Credential => ({ patientRef, class: 'schedule-iv', issuer: 'Demo', validFrom: '2026-01-01', validTo: '2027-01-01', status: 'active', ...over });
const TRAM_LINE = 'RX-61044-2';

beforeEach(() => {
  objects = createFakeObjects();
  shop = createFakeShop();
  state.rx = [rxFor('pt_sam', 'RX-61044'), rxFor('pt_alex', 'RX-42017'), rxFor('pt_jordan', 'RX-58833')];
  state.credentials = [credential('pt_sam'), credential('pt_jordan', { status: 'pending' })];
});
afterEach(() => vi.useRealTimers());

describe('credentialed-purchase-scope: enforced at add (U-12)', () => {
  it('Credential in scope permits purchase: the controlled line is accepted and carries the credential id and expiry', async () => {
    const result = await validateRxSelection(sam, 'RX-61044', [TRAM_LINE], ctxRx);
    expect(result.refused).toEqual([]);
    expect(result.accepted[0]).toMatchObject({ sku: TRAMADOL, hsaEligible: false, credential: { id: 'pt_sam.schedule-iv', validTo: '2027-01-01' } });
  });

  it('No credential refuses purchase: the row is shown but unavailable, naming the class required', async () => {
    const result = await validateRxSelection(alex, 'RX-42017', ['RX-42017-2'], ctxRx);
    expect(result.accepted).toEqual([]);
    expect(result.refused[0]).toMatchObject({ lineRef: 'RX-42017-2', status: 'CREDENTIAL', credential: 'NONE', controlClass: 'schedule-iv', selectable: false });
  });

  it('Credential out of scope: WRONG_SCOPE, distinct from none', async () => {
    state.credentials = [credential('pt_sam', { class: 'schedule-ii' })];
    const result = await validateRxSelection(sam, 'RX-61044', [TRAM_LINE], ctxRx);
    expect(result.refused[0]).toMatchObject({ status: 'CREDENTIAL', credential: 'WRONG_SCOPE' });
  });

  it('Verification still pending: told verification is outstanding', async () => {
    const result = await validateRxSelection(jordan, 'RX-58833', ['RX-58833-2'], ctxRx);
    expect(result.refused[0]).toMatchObject({ status: 'CREDENTIAL', credential: 'PENDING' });
  });

  it('Uncontrolled goods unaffected: a buyer with no credential adds the uncontrolled line normally', async () => {
    const result = await validateRxSelection(alex, 'RX-42017', ['RX-42017-1', 'RX-42017-2'], ctxRx);
    expect(result.accepted.map((a) => a.sku)).toEqual(['MED-ator']);
    expect(result.accepted[0]).not.toHaveProperty('credential');
    expect(result.refused.map((r) => r.lineRef)).toEqual(['RX-42017-2']);
  });

  it('the prescription card shows the controlled row with its requirement, it is not hidden', async () => {
    const view = await getRxView(alex, state.rx[1]!, ctxRx);
    expect(view.lines).toHaveLength(2);
    expect(view.lines[1]).toMatchObject({ status: 'CREDENTIAL', selectable: false, credential: 'NONE', controlClass: 'schedule-iv' });
    expect(view.lines[0]).toMatchObject({ status: 'ok', selectable: true });
  });

  it('a row refused for another reason keeps that reason', async () => {
    state.rx = [{ ...rxFor('pt_alex', 'RX-42017'), refillsLeft: 0 }];
    const result = await validateRxSelection(alex, 'RX-42017', ['RX-42017-2'], ctxRx);
    expect(result.refused[0]).toMatchObject({ status: 'NO_REFILLS' });
  });
});

describe('credentialed-purchase-scope: enforced at cart load (U-12)', () => {
  it('a cart line whose credential has lapsed is flagged with the reason EXPIRED', async () => {
    state.credentials = [credential('pt_sam', { validTo: '2026-10-07' })];
    const problems = await checkLines(sam, [{ id: 'li-1', rx: { rxNumber: 'RX-61044', rxLineRef: TRAM_LINE } }], ctxRx);
    expect(problems.get('li-1')).toEqual({ reason: 'CREDENTIAL', credential: 'EXPIRED', credentialClass: 'schedule-iv' });
  });
});

describe('credentialed-purchase-scope: enforced at order placement (U-12)', () => {
  const provider = createFakePaymentProvider();
  const checkout = (): CheckoutContext => ({ patient: sam, customerId: 'c-sam', cartId: undefined, rx: { locale: 'en-US', currency: 'USD', country: 'US' }, now: NOW });
  const cartWithControlledLine = () =>
    shop.seedCart({
      shippingAddress: { country: 'US', state: 'NY', streetName: '12 Elm St', city: 'New York', postalCode: '10001', firstName: 'Sam', lastName: 'Rivera', phone: '+15125550100' },
      lines: [{ sku: TRAMADOL, cents: 1310, rxNumber: 'RX-61044', lineRef: TRAM_LINE, eligible: false }],
    });
  const place = async (cartId: string) => {
    provider.authorize({ id: cartId, total: { centAmount: 1310, currencyCode: 'USD' } });
    return placeOrder({ ctx: checkout(), cartId, expectedTotal: { centAmount: 1310, currencyCode: 'USD' }, idempotencyKey: `${cartId}_1` }, provider);
  };
  beforeEach(() => {
    provider.reset();
    objects.objects.push({ id: 'o-rx', container: CONTAINERS.rx, key: 'RX-61044', version: 1, value: state.rx[0], createdAt: '', lastModifiedAt: '' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('Credential in scope permits purchase: the order is accepted and the line records the credential id and expiry, not a live reference', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const cart = cartWithControlledLine();
    const outcome = await place(cart.id);
    expect(outcome).toMatchObject({ ok: true });
    expect(shop.orders[0].lineItems[0].custom?.fields).toMatchObject({ credentialRef: 'pt_sam.schedule-iv', credentialValidTo: '2027-01-01' });
  });

  it('Credential expired between cart and order: the order is refused on that line (the cart says why on the next read)', async () => {
    state.credentials = [credential('pt_sam', { validTo: '2026-10-10' })];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    const cart = cartWithControlledLine();
    // It was fine when the line was added...
    expect((await validateRxSelection(sam, 'RX-61044', [TRAM_LINE], { ...ctxRx })).refused).toEqual([]);
    // ...and has lapsed by the time the order is submitted.
    vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
    const outcome = await place(cart.id);
    expect(outcome).toEqual({ ok: false, code: 'LINES_UNAVAILABLE', lineIds: [shop.carts.get(cart.id)!.lineItems[0].id] });
    expect(shop.orders).toHaveLength(0);
    const problems = await checkLines(sam, [{ id: 'li', rx: { rxNumber: 'RX-61044', rxLineRef: TRAM_LINE } }], { ...ctxRx, now: new Date('2026-10-12T12:00:00Z') });
    expect(problems.get('li')).toEqual({ reason: 'CREDENTIAL', credential: 'EXPIRED', credentialClass: 'schedule-iv' });
  });

  it('No credential at placement: refused, and no refill is consumed', async () => {
    state.credentials = [];
    const cart = cartWithControlledLine();
    expect(await place(cart.id)).toMatchObject({ ok: false, code: 'LINES_UNAVAILABLE' });
    expect((objects.objects.find((o) => o.container === CONTAINERS.rx)!.value as Prescription).refillsLeft).toBe(2);
  });
});
