// @vitest-environment node
import { ApiError } from '@/lib/api-error';
import { ctCart } from '@/test/fixtures/ctCart';

const state = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./client', () => ({
  getApiRoot: () => ({
    carts: () => ({
      get: (args: unknown) => ({ execute: () => state.list(args) }),
      post: (args: unknown) => ({ execute: () => state.create(args) }),
      withId: (id: { ID: string }) => ({
        get: (args: unknown) => ({ execute: () => state.get(id.ID, args) }),
        post: (args: unknown) => ({ execute: () => state.post(id.ID, args) }),
      }),
    }),
  }),
}));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));

import { createCartForSession, getActiveCartForSession, getCartById, getSignInMergeArgs, withCartRetry } from './cart';

const us = { locale: 'en-US', currency: 'USD', country: 'US' } as const;
const de = { locale: 'de-DE', currency: 'EUR', country: 'DE' } as const;
const mine = (patch: object = {}) => ({ ...ctCart(), anonymousId: 'anon-1', ...patch });

beforeEach(() => {
  for (const fn of Object.values(state)) fn.mockReset();
});

describe('createCartForSession', () => {
  it('anonymous draft: anonymousId, inventoryMode None, taxMode Platform, typed malva-order', async () => {
    state.create.mockImplementation(async ({ body }: { body: object }) => ({ body: { ...mine(), ...body } }));
    await createCartForSession({ anonymousId: 'anon-1' }, us);
    const draft = state.create.mock.calls[0]?.[0].body;
    expect(draft).toMatchObject({
      currency: 'USD',
      country: 'US',
      locale: 'en-US',
      anonymousId: 'anon-1',
      inventoryMode: 'None',
      taxMode: 'Platform',
      origin: 'Customer',
      deleteDaysAfterLastModification: 90,
      custom: { type: { typeId: 'type', key: 'malva-order' } },
    });
    expect(draft).not.toHaveProperty('customerId');
    expect(draft).not.toHaveProperty('store');
  });

  it('mints an anonymous id when the session has none; signed-in draft has customerId', async () => {
    state.create.mockResolvedValue({ body: mine() });
    await createCartForSession({}, de);
    expect(state.create.mock.calls[0]?.[0].body.anonymousId).toMatch(/^[0-9a-f-]{36}$/);
    await createCartForSession({ customerId: 'cust-1' }, de);
    const draft = state.create.mock.calls[1]?.[0].body;
    expect(draft).toMatchObject({ customerId: 'cust-1', currency: 'EUR', country: 'DE' });
    expect(draft).not.toHaveProperty('anonymousId');
  });
});

describe('reading', () => {
  it('a cart that is not Active reads as null, a 404 too', async () => {
    state.get.mockResolvedValueOnce({ body: { ...mine(), cartState: 'Ordered' } });
    await expect(getCartById('c1')).resolves.toBeNull();
    state.get.mockRejectedValueOnce({ statusCode: 404 });
    await expect(getCartById('c1')).resolves.toBeNull();
  });

  it('currency mismatch returns null (a cart is ignored, not converted)', async () => {
    state.get.mockResolvedValue({ body: mine() });
    await expect(getActiveCartForSession({ anonymousId: 'anon-1', cartId: 'cart-1' }, us)).resolves.toMatchObject({ id: 'cart-1' });
    await expect(getActiveCartForSession({ anonymousId: 'anon-1', cartId: 'cart-1' }, de)).resolves.toBeNull();
  });

  it("another visitor's cart is refused (D-070): the cart id in the session is not enough", async () => {
    state.get.mockResolvedValue({ body: mine({ anonymousId: 'someone-else' }) });
    await expect(getActiveCartForSession({ anonymousId: 'anon-1', cartId: 'cart-1' }, us)).resolves.toBeNull();
    state.get.mockResolvedValue({ body: mine({ anonymousId: undefined, customerId: 'cust-2' }) });
    state.list.mockResolvedValue({ body: { results: [] } });
    await expect(getActiveCartForSession({ customerId: 'cust-1', cartId: 'cart-1' }, us)).resolves.toBeNull();
  });

  it('signed in without a cart id: the latest customer cart of the market, never filtered by anything the client sent', async () => {
    state.list.mockResolvedValue({ body: { results: [mine({ anonymousId: undefined, customerId: 'cust-1', id: 'eur', totalPrice: { currencyCode: 'EUR', centAmount: 0 }, country: 'DE' }), mine({ anonymousId: undefined, customerId: 'cust-1', id: 'usd' })] } });
    await expect(getActiveCartForSession({ customerId: 'cust-1' }, us)).resolves.toMatchObject({ id: 'usd' });
    expect(state.list.mock.calls[0]?.[0].queryArgs.where).toBe('customerId="cust-1" and cartState="Active" and origin="Customer"');
  });

  it('an anonymous session without a cart id has no cart and makes no call', async () => {
    await expect(getActiveCartForSession({ anonymousId: 'anon-1' }, us)).resolves.toBeNull();
    expect(state.get).not.toHaveBeenCalled();
    expect(state.list).not.toHaveBeenCalled();
  });
});

describe('withCartRetry', () => {
  it('retries once on a 409 with a fresh read, then succeeds', async () => {
    state.get.mockResolvedValueOnce({ body: mine({ version: 3 }) }).mockResolvedValueOnce({ body: mine({ version: 4 }) });
    const seen: number[] = [];
    const result = await withCartRetry('cart-1', async (fresh) => {
      seen.push(fresh.version);
      if (fresh.version === 3) throw { statusCode: 409 };
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(seen).toEqual([3, 4]);
  });

  it('a second 409 throws CART_CONFLICT', async () => {
    state.get.mockResolvedValue({ body: mine() });
    const err = await withCartRetry('cart-1', async () => {
      throw { statusCode: 409 };
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).details?.reason).toBe('CART_CONFLICT');
    expect(state.get).toHaveBeenCalledTimes(2);
  });

  it('other errors pass through and a missing cart is NOT_FOUND', async () => {
    state.get.mockResolvedValue({ body: mine() });
    await expect(withCartRetry('cart-1', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    state.get.mockRejectedValue({ statusCode: 404 });
    await expect(withCartRetry('cart-1', async () => 1)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('getSignInMergeArgs', () => {
  it('present only for an anonymous session with a cart id', () => {
    expect(getSignInMergeArgs({ anonymousId: 'a', cartId: 'c1' })).toEqual({ anonymousCart: { typeId: 'cart', id: 'c1' }, anonymousCartSignInMode: 'MergeWithExistingCustomerCart' });
    expect(getSignInMergeArgs({ anonymousId: 'a' })).toEqual({});
    expect(getSignInMergeArgs({ customerId: 'c', cartId: 'c1' })).toEqual({});
  });
});
