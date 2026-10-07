// @vitest-environment node
import { jsonRequest, resetRouteState, routeState } from '@/test/fixtures/bundleMocks';
import { makeApiRoot, resetWorld, world } from '@/test/fixtures/bundleWorld';
import { POST as addLine } from '../line-items/route';
import { DELETE as removeLine } from '../line-items/[lineId]/route';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/client', () => ({ getApiRoot: () => makeApiRoot() }));
vi.mock('@/lib/ct/session', async () => (await import('@/test/fixtures/bundleMocks')).sessionMock);
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/catalog', async () => ({ getAllOffers: async () => (await import('@/test/fixtures/bundleMocks')).routeState.offers }));
vi.mock('@/lib/ct/buyer-context', async () => ({ getBuyerContext: async () => (await import('@/test/fixtures/bundleMocks')).routeState.buyer }));

import { DELETE, POST } from './route';

const apply = (code: unknown) => POST(jsonRequest('/api/cart/discount-code', 'POST', { code }));
const drop = (code: string) => DELETE(jsonRequest(`/api/cart/discount-code?code=${code}`, 'DELETE'));
const cable = { offerKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M' };

beforeEach(async () => {
  resetWorld({
    codes: {
      'MALVA-CABLE5': { id: 'dc-1', state: 'MatchesCart' },
      OLD: { id: 'dc-2', state: 'NotValid' },
      OFF: { id: 'dc-3', state: 'NotActive' },
      PHONEONLY: { id: 'dc-4', state: 'DoesNotMatchCart' },
      LIMIT: { id: 'dc-5', state: 'MaxApplicationReached' },
    },
  });
  resetRouteState();
  routeState.session = {};
  await addLine(jsonRequest('/api/cart/line-items', 'POST', cable));
});

describe('POST /api/cart/discount-code', () => {
  it('Discount code rejected: a code that does not match is removed again and totals are unchanged', async () => {
    const before = (await (await (await import('../route')).GET()).json()).cart.summary.total;
    const res = await apply('PHONEONLY');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: 'DISCOUNT_CODE_REJECTED', details: { reason: 'not-applicable', code: 'PHONEONLY' } });
    expect(body.cart.summary.total).toEqual(before);
    expect(body.cart.discountCodes).toEqual([]);
    const sent = world.handle?.updates.flatMap((update) => update.actions.map((action) => action.action)) ?? [];
    expect(sent.slice(-2)).toEqual(['addDiscountCode', 'removeDiscountCode']);
    expect(world.handle?.cart.discountCodes).toEqual([]);
  });

  it('each refusal carries its reason', async () => {
    const cases: [string, string][] = [
      ['OLD', 'not-valid'],
      ['OFF', 'not-active'],
      ['LIMIT', 'max-reached'],
      ['NOPE-CODE', 'unknown-code'],
    ];
    for (const [code, reason] of cases) {
      const res = await apply(code);
      expect(res.status).toBe(422);
      expect((await res.json()).error.details.reason).toBe(reason);
    }
  });

  it('a matching code stays on the cart and is reported as applied', async () => {
    const res = await apply('MALVA-CABLE5');
    expect(res.status).toBe(200);
    const { cart } = await res.json();
    expect(cart.discountCodes).toEqual([{ code: 'MALVA-CABLE5', state: 'applied', reason: null }]);
  });

  it('400 for an empty or missing code', async () => {
    expect((await apply('')).status).toBe(400);
    expect((await apply(undefined)).status).toBe(400);
  });

  it('Discount stops applying: after the cable plan is removed the code is still listed, as no longer applicable, until it is removed', async () => {
    await apply('MALVA-CABLE5');
    const lineId = world.handle?.cart.lineItems[0]?.id as string;
    // the engine re-evaluates the code after the line change
    const state = world.handle?.cart as unknown as { discountCodes: { state: string }[] };
    await removeLine(jsonRequest(`/api/cart/line-items/${lineId}?cascade=true`, 'DELETE'), { params: Promise.resolve({ lineId }) });
    state.discountCodes[0]!.state = 'DoesNotMatchCart';
    const { cart } = await (await (await import('../route')).GET()).json();
    expect(cart.discountCodes).toEqual([{ code: 'MALVA-CABLE5', state: 'not-applicable', reason: 'not-applicable' }]);
    const removed = await drop('MALVA-CABLE5');
    expect(removed.status).toBe(200);
    expect((await removed.json()).cart.discountCodes).toEqual([]);
  });
});

describe('DELETE /api/cart/discount-code', () => {
  it('404 CODE_NOT_FOUND when the cart does not carry the code, 400 without ?code', async () => {
    const res = await drop('MALVA-CABLE5');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('CODE_NOT_FOUND');
    expect((await DELETE(jsonRequest('/api/cart/discount-code', 'DELETE'))).status).toBe(400);
  });
});
