// @vitest-environment node
import type { BuyerContext } from '@/lib/types';

const state = vi.hoisted(() => ({
  buyer: undefined as unknown,
  session: {} as { cartId?: string },
  cart: null as unknown,
  groupCalls: [] as (string | null)[],
}));

vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/buyer-context', () => ({ getBuyerContext: async () => state.buyer }));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/cart', () => ({
  getActiveCartForSession: async () => state.cart,
  setCartCustomerGroup: async (_cart: unknown, key: string | null) => {
    state.groupCalls.push(key);
  },
}));

import * as route from './route';

const buyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({ customerType: 'consumer', isExistingCustomer: false, existingUnspecified: true, channel: 'online', now: new Date(), held: [], signedIn: false, ...patch });
const post = (body: unknown, origin: string | null = 'http://localhost') =>
  route.POST(new Request('http://localhost/api/buyer-context', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => {
  state.buyer = buyer();
  state.session = {};
  state.cart = null;
  state.groupCalls = [];
});

describe('GET /api/buyer-context', () => {
  it('anonymous defaults: consumer, not specified, no location', async () => {
    expect((await (await route.GET()).json()).context).toEqual({ customerType: 'consumer', existingCustomer: 'unspecified', fromAccount: false, location: null });
  });

  it('signed in: the account values, labelled as from the account', async () => {
    state.buyer = buyer({ signedIn: true, customerType: 'small-business', isExistingCustomer: true, existingUnspecified: false });
    expect((await (await route.GET()).json()).context).toMatchObject({ customerType: 'small-business', existingCustomer: 'yes', fromAccount: true });
  });
});

describe('POST /api/buyer-context', () => {
  it('stores the declaration in an HttpOnly cookie and answers the new context', async () => {
    const res = await post({ customerType: 'employee', existingCustomer: 'no' });
    expect(res.status).toBe(200);
    expect((await res.json()).context).toMatchObject({ customerType: 'employee', existingCustomer: 'no', fromAccount: false });
    const cookie = res.cookies.get('malva-buyer-context');
    expect(cookie).toMatchObject({ value: 'employee:no', httpOnly: true });
  });

  it('a partial body keeps the other half', async () => {
    state.buyer = buyer({ customerType: 'small-business', existingUnspecified: false, isExistingCustomer: true });
    const res = await post({ existingCustomer: 'no' });
    expect(res.cookies.get('malva-buyer-context')?.value).toBe('small-business:no');
  });

  it('applies the declared audience to the anonymous cart as its customer group', async () => {
    state.session = { cartId: 'c1' };
    state.cart = { id: 'c1', version: 1 };
    await post({ customerType: 'employee' });
    await post({ customerType: 'consumer', existingCustomer: 'yes' });
    await post({ customerType: 'consumer', existingCustomer: 'no' });
    expect(state.groupCalls).toEqual(['employee', 'existing-customer', null]);
  });

  it('a signed-in customer is not changed: no cookie, no cart write', async () => {
    state.buyer = buyer({ signedIn: true, customerType: 'consumer', existingUnspecified: false });
    state.session = { cartId: 'c1' };
    state.cart = { id: 'c1', version: 1 };
    const res = await post({ customerType: 'employee' });
    expect((await res.json()).context).toMatchObject({ customerType: 'consumer', fromAccount: true });
    expect(res.cookies.get('malva-buyer-context')).toBeUndefined();
    expect(state.groupCalls).toEqual([]);
  });

  it('400 for values outside the allowed ones or a body that is not a JSON object; 403 for another origin', async () => {
    for (const body of [{ customerType: 'admin' }, { existingCustomer: 'maybe' }, '{', '[]']) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    expect((await post({ customerType: 'employee' }, 'https://evil.example')).status).toBe(403);
    expect((await post({ customerType: 'employee' }, null)).status).toBe(403);
  });
});
