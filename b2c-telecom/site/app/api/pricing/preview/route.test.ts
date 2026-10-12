// @vitest-environment node
import { CART_OFFERS } from '@/lib/cart/__fixtures__/offers';
import { fakeCart, type FakeCartHandle, type FakePrice } from '@/test/fixtures/fakeCart';
import type { BuyerContext, Offer } from '@/lib/types';

const PRICES: Record<string, FakePrice> = {
  'MLV-CBL-500-24M': { recurring: 5999, oneTime: 2500 },
  'MLV-CBL-500-M2M': { recurring: 6999, oneTime: 2500 },
  'MLV-PHN-UNL-M2M': { recurring: 5500 },
  'MLV-PHN-UNL-12M': { recurring: 5000 },
  'MLV-ADD-APPLETV-MTH': { recurring: 999 },
  'MLV-ADD-SPOTIFY-MTH': { recurring: 1000 },
  'MLV-ADD-DEVCARE-MTH': { recurring: 1200 },
  'MLV-EQP-AX3000-RENT': { recurring: 800 },
  'MLV-EQP-AX3000-BUY': { oneTime: 12999 },
  'MLV-EQP-MODEM-DOCSIS31-RENT': { recurring: 600 },
};

const world = vi.hoisted(() => ({
  handle: undefined as unknown,
  created: 0,
  deleted: [] as { id: string; version: number }[],
  keys: [] as string[],
  drafts: [] as Record<string, unknown>[],
  failUpdate: false,
  firstMonthFree: false,
  session: {} as { customerId?: string; cartId?: string },
  buyer: undefined as unknown,
  offers: [] as unknown[],
}));
const h = (): FakeCartHandle => world.handle as FakeCartHandle;

vi.mock('@/lib/ct/client', () => ({
  getApiRoot: () => ({
    carts: () => ({
      post: ({ body }: { body: Record<string, unknown> }) => ({
        execute: async () => {
          world.created += 1;
          world.drafts.push(body);
          world.keys.push(String(body.key));
          const handle = fakeCart(PRICES, { id: 'probe-1', version: 1, anonymousId: String(body.anonymousId ?? ''), currencyCode: 'USD', lineItems: [], customLineItems: [], discountCodes: [] } as never);
          const lineActions = ((body.lineItems as Record<string, unknown>[]) ?? []).map((line) => ({ action: 'addLineItem', ...line }));
          const feeActions = ((body.customLineItems as Record<string, unknown>[]) ?? []).map((item) => ({ action: 'addCustomLineItem', ...item }));
          world.handle = handle;
          handle.apply(1, [...lineActions, ...feeActions]);
          return { body: structuredClone(handle.cart) };
        },
      }),
      withId: () => ({
        get: () => ({ execute: async () => ({ body: structuredClone(h().cart) }) }),
        post: ({ body }: { body: { version: number; actions: { action: string }[] } }) => ({
          execute: async () => {
            if (world.failUpdate) throw { statusCode: 500 };
            const cart = h().apply(body.version, body.actions) as unknown as { lineItems: { id: string; totalPrice: { centAmount: number }; price: { value: { centAmount: number } }; discountedPricePerQuantity?: unknown[]; custom: { fields: { offerKey?: string } }; quantity: number }[]; totalPrice: { centAmount: number } };
            if (world.firstMonthFree) {
              // the engine's first-order promotion on the plan line: the first month is free
              const plan = cart.lineItems.find((line) => line.custom.fields.offerKey === 'malva-offer-cable-500');
              if (plan && (plan.discountedPricePerQuantity ?? []).length === 0) {
                plan.discountedPricePerQuantity = [{ quantity: plan.quantity, discountedPrice: { value: { centAmount: 0, currencyCode: 'USD' }, includedDiscounts: [{ discount: { typeId: 'cart-discount', id: 'cd-intro' }, discountedAmount: { centAmount: plan.price.value.centAmount, currencyCode: 'USD' } }] } }];
                plan.totalPrice = { ...plan.totalPrice, centAmount: 0 };
                cart.totalPrice = { ...cart.totalPrice, centAmount: cart.totalPrice.centAmount - plan.price.value.centAmount * plan.quantity };
              }
            }
            return { body: structuredClone(cart) };
          },
        }),
        delete: ({ queryArgs }: { queryArgs: { version: number } }) => ({
          execute: async () => {
            world.deleted.push({ id: 'probe-1', version: queryArgs.version });
            return { body: {} };
          },
        }),
      }),
    }),
  }),
}));
vi.mock('@/lib/ct/timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock('@/lib/ct/catalog', () => ({ getAllOffers: async () => world.offers }));
vi.mock('@/lib/ct/buyer-context', () => ({ getBuyerContext: async () => world.buyer }));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => world.session }));
vi.mock('@/lib/market/server', () => ({ getMarket: async () => ({ locale: 'en-US', currency: 'USD', country: 'US' }) }));
vi.mock('@/lib/ct/discount-keys', () => ({
  getCartDiscountKeys: async () => ({ 'cd-intro': 'malva-cd-intro-free-month' }),
  getCartDiscountNames: async () => ({ 'cd-intro': { 'en-US': 'First month free' } }),
}));
vi.mock('@/lib/ct/recurring', async (original) => ({ ...(await original<typeof import('@/lib/ct/recurring')>()), getMonthlyPolicy: async () => ({ id: 'pol-1', key: 'malva-monthly', version: 1 }) }));

import { resetRateLimitForTests } from '@/test/fixtures/rateLimit';
import * as route from './route';

const buyer = (patch: Partial<BuyerContext> = {}): BuyerContext => ({ customerType: 'consumer', isExistingCustomer: false, existingUnspecified: false, groupKeys: [], channel: 'online', now: new Date('2026-10-12T12:00:00Z'), held: [], signedIn: false, ...patch });
const post = (body: unknown, headers: Record<string, string> = {}) =>
  route.POST(new Request('http://localhost/api/pricing/preview', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const CABLE = { planKey: 'malva-offer-cable-500', sku: 'MLV-CBL-500-24M' };

beforeEach(() => {
  resetRateLimitForTests();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  world.handle = undefined;
  world.created = 0;
  world.deleted = [];
  world.keys = [];
  world.drafts = [];
  world.failUpdate = false;
  world.firstMonthFree = false;
  world.session = {};
  world.buyer = buyer();
  world.offers = CART_OFFERS as Offer[];
});

describe('POST /api/pricing/preview', () => {
  it('prices the plan and an extra: due today has the plan, its fee and the rental; then monthly is the standing prices; the probe is deleted', async () => {
    const res = await post({ ...CABLE, extras: [{ offerKey: 'malva-offer-router-ax3000', sku: 'MLV-EQP-AX3000-RENT' }] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dueToday.centAmount).toBe(5999 + 2500 + 800);
    expect(body.thenMonthly.centAmount).toBe(5999 + 800);
    expect(body.lines.map((line: { kind: string }) => line.kind)).toEqual(['plan', 'equipment', 'equipment']);
    expect(body.lines.find((line: { offerKey: string }) => line.offerKey === 'malva-offer-modem-docsis31')).toMatchObject({ includedAtNoCharge: true, total: { centAmount: 0 } });
    expect(body.issues).toEqual([]);
    expect(world.created).toBe(1);
    expect(world.deleted).toHaveLength(1);
    expect(world.keys[0]).toMatch(/^preview-probe-/);
  });

  it('the first-month promotion: due today excludes the free first month, then monthly keeps the standing price, and the promotion is named with its amount', async () => {
    world.firstMonthFree = true;
    const body = await (await post({ ...CABLE, extras: [{ offerKey: 'malva-offer-router-ax3000', sku: 'MLV-EQP-AX3000-RENT' }] })).json();
    expect(body.dueToday.centAmount).toBe(2500 + 800);
    expect(body.thenMonthly.centAmount).toBe(5999 + 800);
    expect(body.promotions).toEqual([{ key: 'malva-cd-intro-free-month', name: 'First month free', amount: { centAmount: 5999, currencyCode: 'USD' }, lineIds: expect.any(Array) }]);
  });

  it('a refused extra is listed in issues with its reason and the figures cover the accepted items only', async () => {
    const body = await (await post({ ...CABLE, extras: [{ offerKey: 'malva-offer-device-protect', sku: 'MLV-ADD-DEVCARE-MTH' }, { offerKey: 'malva-offer-appletv', sku: 'MLV-ADD-APPLETV-MTH' }] })).json();
    expect(body.issues).toMatchObject([{ offerKey: 'malva-offer-device-protect', kind: 'blocked', reasons: [{ code: 'FAMILY_MISMATCH', message: expect.any(String) }] }]);
    expect(body.dueToday.centAmount).toBe(5999 + 2500 + 999);
    expect(body.lines.map((line: { offerKey: string }) => line.offerKey)).not.toContain('malva-offer-device-protect');
  });

  it('an extra that replaces another (negated offer) prices only the replacement', async () => {
    const pro: Offer = { ...(CART_OFFERS.find((o) => o.key === 'malva-offer-spotify') as Offer), key: 'malva-offer-pro', name: 'Pro', negatesOffers: ['malva-offer-appletv'] };
    world.offers = [...CART_OFFERS, { ...pro, variants: pro.variants }];
    const body = await (await post({ ...CABLE, extras: [{ offerKey: 'malva-offer-appletv', sku: 'MLV-ADD-APPLETV-MTH' }, { offerKey: 'malva-offer-pro', sku: 'MLV-ADD-SPOTIFY-MTH' }] })).json();
    expect(body.replaced).toEqual(['Apple TV+']);
    expect(body.lines.map((line: { offerKey: string }) => line.offerKey)).toContain('malva-offer-pro');
    expect(body.lines.map((line: { offerKey: string }) => line.offerKey)).not.toContain('malva-offer-appletv');
  });

  it('preview equals the bundle: the same plan and extras mapped from a cart give the same due today and then monthly', async () => {
    const { mapCart } = await import('@/lib/mappers/cart');
    const { ctCart } = await import('@/test/fixtures/ctCart');
    const { cartOffersByKey } = await import('@/lib/cart/__fixtures__/offers');
    const body = await (await post({ ...CABLE, extras: [{ offerKey: 'malva-offer-appletv', sku: 'MLV-ADD-APPLETV-MTH' }] })).json();
    const bundle = mapCart(
      ctCart({ lines: [{ id: 'L1', sku: 'MLV-CBL-500-24M', offerKey: 'malva-offer-cable-500', price: 5999, mode: 'Fixed' }, { id: 'L2', sku: 'MLV-ADD-APPLETV-MTH', offerKey: 'malva-offer-appletv', price: 999, mode: 'Dynamic', parent: 'L1' }], fees: [{ id: 'F1', offerKey: 'malva-offer-cable-500', money: 2500 }] }),
      { locale: 'en-US', currency: 'USD', country: 'US' },
      { offersByKey: cartOffersByKey(), stock: {}, issues: [], today: '2026-10-12', discountKeyById: {} },
    );
    expect(body.dueToday).toEqual(bundle.summary.dueToday);
    expect(body.thenMonthly).toEqual(bundle.summary.thenMonthly);
  });

  it('validation: unknown plan, bad quantity, bad body: 400 with a typed code and nothing created', async () => {
    const cases: [unknown, string][] = [
      [{ planKey: 'malva-offer-nothing' }, 'INVALID_PLAN'],
      [{ planKey: 'not-a-key' }, 'INVALID_PLAN'],
      [{ ...CABLE, sku: 'MLV-NOPE' }, 'INVALID_PLAN'],
      [{ ...CABLE, quantity: 0 }, 'INVALID_QUANTITY'],
      [{ ...CABLE, quantity: 1.5 }, 'INVALID_QUANTITY'],
      [{ ...CABLE, quantity: 2 }, 'INVALID_QUANTITY'],
      [{ planKey: 'malva-offer-appletv' }, 'INVALID_PLAN'],
      [{ ...CABLE, extras: 'x' }, 'INVALID_REQUEST'],
      [{ ...CABLE, extras: [{}] }, 'INVALID_REQUEST'],
      ['{', 'INVALID_REQUEST'],
      ['[]', 'INVALID_REQUEST'],
    ];
    for (const [body, code] of cases) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error.code, JSON.stringify(body)).toBe(code);
    }
    expect(world.created).toBe(0);
  });

  it('a plan this buyer may not buy is INVALID_PLAN, not a leak of why', async () => {
    world.offers = (CART_OFFERS as Offer[]).map((offer) => (offer.key === 'malva-offer-cable-500' ? { ...offer, audience: ['employee' as const] } : offer));
    const res = await post(CABLE);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_PLAN');
    expect(world.created).toBe(0);
  });

  it('another origin or no origin is 403 and above the rate is 429, both before any commercetools call', async () => {
    expect((await post(CABLE, { origin: 'https://evil.example' })).status).toBe(403);
    expect(world.created).toBe(0);
    for (let i = 0; i < 30; i += 1) await post({ planKey: 'malva-offer-nothing' });
    const limited = await post(CABLE);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect(world.created).toBe(0);
  });

  it('cleanup under failure: a failure after the probe was created still deletes it, and the answer is a generic 502', async () => {
    world.failUpdate = true;
    const res = await post({ ...CABLE, extras: [{ offerKey: 'malva-offer-appletv', sku: 'MLV-ADD-APPLETV-MTH' }] });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('statusCode');
    expect(world.created).toBe(1);
    expect(world.deleted).toHaveLength(1);
  });

  it('the declared audience is the probe\'s customer group and a signed-in buyer\'s customer id brings their groups; the buyer\'s own cart is not touched', async () => {
    world.buyer = buyer({ customerType: 'small-business', groupKeys: ['small-business'] });
    await post(CABLE);
    expect(world.drafts[0]).toMatchObject({ customerGroup: { typeId: 'customer-group', key: 'small-business' }, origin: 'Merchant' });
    world.drafts = [];
    world.buyer = buyer({ signedIn: true });
    world.session = { customerId: 'cust-1' };
    await post(CABLE);
    expect(world.drafts[0]).toMatchObject({ customerId: 'cust-1' });
    expect(world.drafts[0]).not.toHaveProperty('anonymousId');
  });
});
