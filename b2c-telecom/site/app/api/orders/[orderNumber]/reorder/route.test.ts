// @vitest-environment node
import { ApiError } from '@/lib/api-error';
import { orderA } from '@/test/fixtures/orders';

const state = vi.hoisted(() => ({
  order: null as unknown,
  replicate: vi.fn(),
  getCart: vi.fn(),
  updateCart: vi.fn(),
  updateSession: vi.fn(),
  requireCustomer: vi.fn(),
  mapForMarket: vi.fn(),
  withOrderNumber: vi.fn(),
  published: vi.fn(),
  otherCalls: vi.fn(),
}));

vi.mock('@/lib/auth/guard', () => ({ requireCustomerApi: state.requireCustomer }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/session', () => ({ updateSession: state.updateSession }));
vi.mock('@/lib/ct/bundle', () => ({ mapForMarket: state.mapForMarket }));
vi.mock('@/lib/ct/cart', () => ({ getCartById: state.getCart, updateCart: state.updateCart }));
vi.mock('@/lib/ct/client', () => ({
  getApiRoot: () => ({
    orders: () => ({ withOrderNumber: (args: unknown) => ({ get: () => ({ execute: () => state.withOrderNumber(args) }) }) }),
    productProjections: () => ({ get: (args: unknown) => ({ execute: () => state.published(args) }) }),
    carts: () => ({
      replicate: () => ({ post: (args: unknown) => ({ execute: () => state.replicate(args) }) }),
      withId: (args: unknown) => state.otherCalls('withId', args), // any other cart call (the previous cart) would show up here
    }),
  }),
}));

import { POST } from './route';

const request = () => new Request('http://localhost/api/orders/QA-AAAA01/reorder', { method: 'POST', headers: { origin: 'http://localhost' } });
const call = (orderNumber = 'QA-AAAA01', req: Request = request()) => POST(req, { params: Promise.resolve({ orderNumber }) });

const PRODUCT_OF: Record<string, string> = { 'MLV-CBL-500-24M': 'malva-offer-cable-500', 'MLV-ADD-APPLETV-MTH': 'malva-offer-appletv' };
const line = (id: string, sku: string, recurring = true, parent?: string) => ({
  id,
  productKey: PRODUCT_OF[sku],
  variant: { sku },
  ...(recurring ? { recurrenceInfo: { priceSelectionMode: 'Fixed' } } : {}),
  custom: { fields: { ...(parent ? { parentLineItemId: parent } : {}) } },
});
const replicaWith = (lineItems: unknown[]) => ({ id: 'new-cart', version: 1, lineItems, customLineItems: [], custom: { fields: {} } });

beforeEach(() => {
  vi.clearAllMocks();
  state.requireCustomer.mockResolvedValue({ session: { customerId: 'cust-alex' } });
  state.withOrderNumber.mockResolvedValue({ body: orderA() });
  state.getCart.mockImplementation(async (id: string) => ({ id, version: 2, lineItems: [], customLineItems: [] }));
  state.updateCart.mockResolvedValue({});
  state.published.mockResolvedValue({ body: { results: [{ masterVariant: { sku: 'MLV-CBL-500-24M' }, variants: [] }, { masterVariant: { sku: 'MLV-ADD-APPLETV-MTH' }, variants: [] }] } });
  state.mapForMarket.mockImplementation(async (ct: { id: string }) => ({ cart: { id: ct.id, lines: [] }, ct }));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('POST /api/orders/[orderNumber]/reorder', () => {
  it('Reorder with an unavailable item: a new cart is created and the unavailable item is reported, not dropped silently', async () => {
    state.replicate.mockResolvedValue({ body: replicaWith([line('n1', 'MLV-CBL-500-24M')]) }); // Apple TV+ is gone
    const response = await call();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cart.id).toBe('new-cart');
    expect(body.unavailable).toEqual([{ sku: 'MLV-ADD-APPLETV-MTH', name: 'Apple TV+', reason: 'not-available' }]);
    expect(state.replicate).toHaveBeenCalledWith({ body: { reference: { typeId: 'order', id: 'id-QA-AAAA01' } } });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('an unpublished product that Replicate kept is removed from the new cart and reported', async () => {
    state.published.mockResolvedValue({ body: { results: [{ masterVariant: { sku: 'MLV-CBL-500-24M' }, variants: [] }] } });
    state.replicate.mockResolvedValue({ body: replicaWith([line('n1', 'MLV-CBL-500-24M'), line('n2', 'MLV-ADD-APPLETV-MTH', true, 'a1')]) });
    const body = await (await call()).json();
    expect(body.unavailable).toEqual([{ sku: 'MLV-ADD-APPLETV-MTH', name: 'Apple TV+', reason: 'not-available' }]);
    expect(state.updateCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-cart' }), [{ action: 'removeLineItem', lineItemId: 'n2' }]);
  });

  it('removes the unavailable line from the new cart and reports a lost recurrence', async () => {
    state.replicate.mockResolvedValue({ body: replicaWith([line('n1', 'MLV-CBL-500-24M'), line('n2', 'MLV-ADD-APPLETV-MTH', false, 'a1')]) });
    const body = await (await call()).json();
    expect(body.unavailable).toEqual([{ sku: 'MLV-ADD-APPLETV-MTH', name: 'Apple TV+', reason: 'recurrence-lost' }]);
    expect(state.updateCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-cart' }), [{ action: 'removeLineItem', lineItemId: 'n2' }]);
  });

  it('a complete reorder reports nothing and replaces the session cart; the previous cart is not touched', async () => {
    state.replicate.mockResolvedValue({ body: replicaWith([line('n1', 'MLV-CBL-500-24M'), line('n2', 'MLV-ADD-APPLETV-MTH', true, 'n1')]) });
    const body = await (await call()).json();
    expect(body.unavailable).toEqual([]);
    expect(state.updateSession).toHaveBeenCalledWith({ cartId: 'new-cart' }, expect.anything());
    expect(state.otherCalls).not.toHaveBeenCalled();
    expect(state.updateCart).not.toHaveBeenCalled();
  });

  it("another customer's or an unknown order is the same 404 and nothing is replicated", async () => {
    state.withOrderNumber.mockResolvedValue({ body: orderA({ customerId: 'cust-other' }) });
    const foreign = await call();
    expect(foreign.status).toBe(404);
    expect((await foreign.json()).error.details.reason).toBe('ORDER_NOT_FOUND');
    state.withOrderNumber.mockRejectedValue({ statusCode: 404 });
    expect((await call('NOPE')).status).toBe(404);
    expect(state.replicate).not.toHaveBeenCalled();
    expect(state.updateSession).not.toHaveBeenCalled();
  });

  it('anonymous visitors get 401 and a request from another origin 403, before any read', async () => {
    state.requireCustomer.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Sign in required'));
    expect((await call()).status).toBe(401);
    expect((await call('QA-AAAA01', new Request('http://localhost/api/x', { method: 'POST', headers: { origin: 'http://evil.example' } }))).status).toBe(403);
    expect(state.withOrderNumber).not.toHaveBeenCalled();
  });

  it('refuses an order placed in another currency than the market', async () => {
    const eur = orderA();
    (eur as unknown as { totalPrice: { currencyCode: string } }).totalPrice = { currencyCode: 'EUR' } as never;
    state.withOrderNumber.mockResolvedValue({ body: eur });
    const response = await call();
    expect(response.status).toBe(409);
    expect((await response.json()).error.details.reason).toBe('MARKET_MISMATCH');
    expect(state.replicate).not.toHaveBeenCalled();
  });
});
