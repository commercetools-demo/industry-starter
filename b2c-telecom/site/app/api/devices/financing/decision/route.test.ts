// @vitest-environment node
import { NOVA_5G_OFFER, NOVA_PRO_OFFER } from '@/lib/devices/__fixtures__/offers';
import { jsonRequest, resetRouteState, routeState, sessionMock } from '@/test/fixtures/bundleMocks';
import { deviceWorld, makeDeviceApiRoot, resetDeviceWorld, seedDeviceCart } from '@/test/fixtures/deviceWorld';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => makeDeviceApiRoot() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/bundleMocks')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/catalog', async () => ({ getAllOffers: async () => (await import('@/test/fixtures/bundleMocks')).routeState.offers }));
vi.mock('@/lib/ct/buyer-context', async () => ({ getBuyerContext: async () => (await import('@/test/fixtures/bundleMocks')).routeState.buyer }));
const customer = { creditApproved: undefined as boolean | undefined };
vi.mock('@/lib/ct/customer', () => ({ getCustomerById: async () => ({ custom: { fields: customer.creditApproved === undefined ? {} : { creditApproved: customer.creditApproved } } }) }));

import { POST as addDevice } from '../../../cart/devices/route';
import { POST } from './route';

const PRO_512 = 'MLV-DEV-NOVAPRO-BLK-512';
const PRO_256 = 'MLV-DEV-NOVAPRO-BLK-256';
const add = (sku: string, mode: string, termMonths: number | undefined, quantity = 1) =>
  addDevice(jsonRequest('/api/cart/devices', 'POST', { offerKey: 'malva-offer-phone-nova-pro', sku, quantity, mode, ...(termMonths === undefined ? {} : { termMonths }) }));
const signIn = () => {
  seedDeviceCart({ customerId: 'cust-1' });
  routeState.session = { customerId: 'cust-1', cartId: 'cart-1' };
};

beforeEach(() => {
  resetDeviceWorld();
  resetRouteState();
  routeState.offers = [NOVA_5G_OFFER, NOVA_PRO_OFFER];
  routeState.session = {};
  customer.creditApproved = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  void sessionMock;
});

describe('POST /api/devices/financing/decision', () => {
  it('an anonymous visitor with a financed line gets 200 with sign-in-required (never a 401)', async () => {
    await add(PRO_256, 'installments', 24);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).decision).toMatchObject({ outcome: 'sign-in-required', reason: 'sign-in-required' });
  });

  it('an anonymous visitor with only outright lines is approved, no financed lines', async () => {
    await add(PRO_256, 'outright', undefined);
    expect((await (await POST()).json()).decision).toMatchObject({ outcome: 'approved', reason: 'no-financed-lines' });
  });

  it('a visitor without a cart is approved, no financed lines', async () => {
    expect((await (await POST()).json()).decision).toMatchObject({ outcome: 'approved', reason: 'no-financed-lines' });
    expect(deviceWorld.created).toBe(0);
  });

  it('approved: the financing decision id and the end date are written on the financed line only', async () => {
    signIn();
    await add(PRO_256, 'outright', undefined);
    await add(PRO_256, 'installments', 24);
    await add(PRO_512, 'lease', 24);
    const body = (await (await POST()).json()) as { decision: { decisionId: string; outcome: string; reason: string } };
    expect(body.decision).toMatchObject({ outcome: 'approved', reason: 'ok' });
    const [outright, installments, lease] = deviceWorld.cart?.lineItems.map((line) => line.custom.fields) ?? [];
    expect(outright?.financingDecisionId).toBeUndefined();
    expect(outright?.acquisitionEndDate).toBeUndefined();
    expect(installments).toMatchObject({ financingDecisionId: body.decision.decisionId });
    expect(String(installments?.acquisitionEndDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(lease).toMatchObject({ financingDecisionId: body.decision.decisionId });
    // the lease must be returned 30 days after its final payment: later than the installments end date, which has the same term
    expect(String(lease?.acquisitionEndDate) > String(installments?.acquisitionEndDate)).toBe(true);
  });

  it('asking again with the same bundle changes nothing (idempotent)', async () => {
    signIn();
    await add(PRO_256, 'installments', 24);
    await POST();
    const updates = deviceWorld.updates.length;
    await POST();
    expect(deviceWorld.updates).toHaveLength(updates);
  });

  it('a customer flagged to decline is declined and nothing is written', async () => {
    signIn();
    customer.creditApproved = false;
    await add(PRO_256, 'installments', 12);
    const updates = deviceWorld.updates.length;
    expect((await (await POST()).json()).decision).toMatchObject({ outcome: 'declined', reason: 'customer-declined' });
    expect(deviceWorld.updates).toHaveLength(updates);
    expect(deviceWorld.cart?.lineItems[0]?.custom.fields.financingDecisionId).toBeUndefined();
  });

  it('over the limit: 3 x Nova Pro 512 GB over 36 months is declined with the total and the limit', async () => {
    signIn();
    await add(PRO_512, 'installments', 36, 3);
    const { decision } = (await (await POST()).json()) as { decision: { outcome: string; reason: string; financedTotal: { centAmount: number }; limit: { centAmount: number } } };
    expect(decision).toMatchObject({ outcome: 'declined', reason: 'amount-over-limit', financedTotal: { centAmount: 356400 }, limit: { centAmount: 250000 } });
  });

  it('2 x Nova Pro 512 GB over 36 months is still approved (237600)', async () => {
    signIn();
    await add(PRO_512, 'installments', 36, 2);
    expect((await (await POST()).json()).decision).toMatchObject({ outcome: 'approved', financedTotal: { centAmount: 237600 } });
  });
});
