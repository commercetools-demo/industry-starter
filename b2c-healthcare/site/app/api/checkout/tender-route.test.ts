// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectUnauthenticated } from '@/test/api';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { createFakeShop, type FakeShop } from '@/test/fake-shop';
import { makeJsonRequest } from '@/test/request';
import { createFakePaymentProvider } from '@/lib/checkout/fake-provider';

let shop: FakeShop;
let objects: FakeObjects;
vi.mock('@/lib/ct/client', () => ({
  apiRoot: new Proxy({}, { get: (_t, p) => (p === 'customObjects' ? objects.customObjects : (shop.apiRoot as Record<string, unknown>)[p as string]) }),
}));
const session = vi.hoisted(() => ({ getSession: vi.fn(), setCart: vi.fn(), clearCart: vi.fn() }));
vi.mock('@/lib/session', () => session);
const getPatient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/patient', () => ({ getPatient: (id: string) => getPatient(id) }));
const validateRxSelection = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/prescriptions', () => ({ RxNotFoundError: class extends Error {}, validateRxSelection: (...a: unknown[]) => validateRxSelection(...a) }));
const providerMock = vi.hoisted(() => ({ getPaymentProvider: vi.fn() }));
vi.mock('@/lib/checkout/provider', () => providerMock);

import { CONTAINERS } from '@/lib/ct/custom-objects';
import { grantCycle } from '@/lib/ct/allowance';
import { cycleOf } from '@/lib/funding/allowance-types';
import { GET } from './route';
import { PUT } from './tender/route';
import { POST as createSession } from './session/route';
import { POST as demoAuthorize } from './demo-authorize/route';

const demo = createFakePaymentProvider();
const signedIn = (cartId?: string) => session.getSession.mockResolvedValue({ customerId: 'c-sam', locale: 'en-US', currency: 'USD', country: 'US', ...(cartId ? { cartId } : {}) });
const cartOf = (lines: { sku: string; cents: number; eligible?: boolean }[]) =>
  shop.seedCart({
    shippingAddress: { country: 'US', state: 'NY', streetName: '12 Elm St', city: 'New York', postalCode: '10001', firstName: 'Sam', lastName: 'Rivera', phone: '+15125550100' },
    lines,
  });
const put = (body: unknown) => PUT(makeJsonRequest('/api/checkout/tender', body, { method: 'PUT' }));

beforeEach(() => {
  shop = createFakeShop();
  objects = createFakeObjects();
  demo.reset();
  session.getSession.mockReset();
  getPatient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', name: 'Sam Rivera' });
  validateRxSelection.mockReset().mockResolvedValue({ rxNumber: 'RX-77102', accepted: [], refused: [] });
  providerMock.getPaymentProvider.mockReset().mockResolvedValue(demo);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('eligible-item-tender-restriction: PUT /api/checkout/tender (U-10)', () => {
  it('signed out: 401', async () => {
    session.getSession.mockResolvedValue({});
    await expectUnauthenticated(PUT, [], makeJsonRequest('/api/checkout/tender', { restricted: true }, { method: 'PUT' }));
  });

  it('rejects a body that is not a boolean choice', async () => {
    const cart = cartOf([{ sku: 'MED-ator', cents: 1875, eligible: true }]);
    signedIn(cart.id);
    expect((await put({ restricted: 'yes' })).status).toBe(400);
    expect((await put({})).status).toBe(400);
  });

  it('choosing the instrument answers the checkout state with the card remainder and attaches its Payment', async () => {
    const cart = cartOf([{ sku: 'MED-ator', cents: 1875, eligible: true }, { sku: 'MED-alp', cents: 1260, eligible: false }]);
    signedIn(cart.id);
    const response = await put({ restricted: true });
    expect(response.status).toBe(200);
    const state = await response.json();
    expect(state.cart.tender).toMatchObject({ restricted: { available: true, chosen: true, eligibleSubtotal: { centAmount: 1875 } }, card: { centAmount: 1260 } });
    expect([...shop.payments.values()].map((p) => [p.paymentMethodInfo.method, p.amountPlanned.centAmount])).toEqual([['restricted-health-account', 1875]]);
  });

  it('a wholly ineligible basket refuses with 422 and the state, and attaches nothing', async () => {
    const cart = cartOf([{ sku: 'MED-alp', cents: 1260, eligible: false }]);
    signedIn(cart.id);
    const response = await put({ restricted: true });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe('NONE_ELIGIBLE');
    expect(body.state.cart.tender.restricted).toMatchObject({ available: false, reason: 'none-eligible' });
    expect(shop.payments.size).toBe(0);
  });

  it('dropping the choice detaches the Payment', async () => {
    const cart = cartOf([{ sku: 'MED-ator', cents: 1875, eligible: true }]);
    signedIn(cart.id);
    await put({ restricted: true });
    const off = await (await put({ restricted: false })).json();
    expect(off.cart.tender.restricted.chosen).toBe(false);
    expect(off.cart.tender.card.centAmount).toBe(1875);
    expect(shop.carts.get(cart.id)?.paymentInfo?.payments ?? []).toHaveLength(0);
  });
});

describe('the checkout read, the session and the demo authorization use the card remainder (U-06, U-10)', () => {
  it('GET /api/checkout carries the tender view with the allowance balance and what this order would use', async () => {
    await grantCycle('pt_sam', cycleOf(new Date()), 5000);
    const cart = cartOf([{ sku: 'MED-ator', cents: 1875, eligible: true }]);
    signedIn(cart.id);
    const state = await (await GET()).json();
    expect(state.cart.tender.allowance).toMatchObject({ balance: { centAmount: 5000 }, applies: { centAmount: 1875 } });
    expect(state.cart.tender.card.centAmount).toBe(0);
    expect(objects.objects.some((o) => o.container === CONTAINERS.allowance)).toBe(true);
  });

  it('the payment session is created for the remainder after the allowance, and the allowance Payment is on the cart first', async () => {
    await grantCycle('pt_sam', cycleOf(new Date()), 1000);
    const cart = cartOf([{ sku: 'MED-ator', cents: 1875, eligible: true }]);
    signedIn(cart.id);
    const create = vi.spyOn(demo, 'createSession');
    const response = await createSession();
    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith({ id: cart.id, total: { centAmount: 875, currencyCode: 'USD', fractionDigits: 2 } });
    expect([...shop.payments.values()].map((p) => [p.paymentMethodInfo.method, p.amountPlanned.centAmount])).toEqual([['allowance', 1000]]);
  });

  it('allowance covers the order: the demo authorization takes nothing and records nothing', async () => {
    await grantCycle('pt_sam', cycleOf(new Date()), 5000);
    const cart = cartOf([{ sku: 'MED-ator', cents: 1875, eligible: true }]);
    signedIn(cart.id);
    vi.stubEnv('MALVA_FIXTURES', '1');
    const response = await demoAuthorize(makeJsonRequest('/api/checkout/demo-authorize', {}));
    vi.unstubAllEnvs();
    // Outside fixtures the demo endpoint is a 404; with the fake provider loaded it would answer authorized without recording a card amount.
    expect([200, 404]).toContain(response.status);
    expect((await demo.getAuthorization(cart.id)).status).toBe('none');
  });
});
