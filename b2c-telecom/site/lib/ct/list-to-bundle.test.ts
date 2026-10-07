// @vitest-environment node
import type { ShoppingList } from '@commercetools/platform-sdk';
import { BundleRefusal } from '@/lib/cart/errors';
import type { Market, Offer, OfferKind } from '@/lib/types';

const market: Market = { locale: 'en-US', currency: 'USD', country: 'US' };

const world = { list: undefined as unknown as ShoppingList, offers: [] as Offer[], listWrites: 0, bundleReads: 0 };

vi.mock('./client', () => ({
  getApiRoot: () => ({
    shoppingLists: () => ({
      withId: () => ({
        get: () => ({ execute: async () => ({ body: world.list }) }),
        post: () => ({ execute: async () => { world.listWrites += 1; return { body: world.list }; } }),
        delete: () => ({ execute: async () => { world.listWrites += 1; return { body: {} }; } }),
      }),
      post: () => ({ execute: async () => { world.listWrites += 1; return { body: world.list }; } }),
    }),
  }),
}));
vi.mock('./catalog', () => ({ getOffersByKeys: async (keys: string[]) => world.offers.filter((offer) => keys.includes(offer.key)) }));
vi.mock('./bundle', () => ({
  addToBundle: vi.fn(),
  readBundle: async () => {
    world.bundleReads += 1;
    return { cart: null, cartId: undefined };
  },
}));

import { moveListToBundle, type AddLine } from './list-to-bundle';
import { ListNotFoundError } from './lists';

const SESSION = { customerId: 'cust-1', cartId: 'cart-1' };
const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const offer = (key: string, kind: OfferKind, over: Partial<Offer> = {}): Offer =>
  ({ id: `p-${key}`, key, kind, name: `Name ${key}`, variants: [{ id: 1, sku: `SKU-${key}`, isMaster: true, term: null, termMonths: null, recurringPrice: usd(1000), images: [], attributes: {} }], ...over }) as unknown as Offer;
const line = (id: string, offerKey: string, quantity = 1) => ({ id, productId: `p-${offerKey}`, variantId: 1, quantity, name: { 'en-US': `Stored ${offerKey}` }, custom: { fields: { offerKey } } });
const listOf = (lines: unknown[], customerId = 'cust-1'): ShoppingList => ({ id: 'l1', version: 3, customer: { typeId: 'customer', id: customerId }, lineItems: lines }) as unknown as ShoppingList;
const ok: AddLine = vi.fn(async (_s, _m, input) => ({ cart: { id: 'cart-1', lines: [{ id: input.sku }] } as never, cartId: 'cart-1' }));

beforeEach(() => {
  vi.clearAllMocks();
  world.listWrites = 0;
  world.bundleReads = 0;
});

describe('moveListToBundle', () => {
  it('List converted in one operation: all twelve lines added and the list is unchanged', async () => {
    const kinds: OfferKind[] = ['addon', 'addon', 'equipment', 'device', 'addon', 'base-package', 'addon', 'equipment', 'addon', 'base-package', 'addon', 'device'];
    world.offers = kinds.map((kind, i) => offer(`o${i}`, kind));
    world.list = listOf(kinds.map((_k, i) => line(`l${i}`, `o${i}`, i === 5 ? 2 : 1)));
    const addLine = vi.fn(ok);
    const { result, cartId } = await moveListToBundle(SESSION, market, 'l1', addLine);
    expect(addLine).toHaveBeenCalledTimes(12);
    // plans first, then handsets, then add-ons and equipment; the list order is kept inside a rank
    expect(addLine.mock.calls.map((call) => call[2].offerKey)).toEqual(['o5', 'o9', 'o3', 'o11', 'o0', 'o1', 'o2', 'o4', 'o6', 'o7', 'o8', 'o10']);
    expect(addLine.mock.calls[0]?.[2]).toEqual({ offerKey: 'o5', sku: 'SKU-o5', quantity: 2 });
    expect(result.added).toHaveLength(12);
    expect(result.skipped).toEqual([]);
    expect(result.cart).toEqual({ id: 'cart-1', lines: [{ id: 'SKU-o10' }] });
    expect(cartId).toBe('cart-1');
    expect(world.listWrites).toBe(0);
  });

  it('Line no longer purchasable: remaining lines added and the excluded line named with its reason', async () => {
    world.offers = [offer('plan', 'base-package')]; // the add-on is not published any more
    world.list = listOf([line('l1', 'spotify'), line('l2', 'plan')]);
    const { result } = await moveListToBundle(SESSION, market, 'l1', vi.fn(ok));
    expect(result.added.map((a) => a.offerKey)).toEqual(['plan']);
    expect(result.skipped).toEqual([{ lineId: 'l1', offerKey: 'spotify', name: 'Stored spotify', reason: { code: 'NO_LONGER_AVAILABLE', message: 'No longer available.' } }]);
    expect(world.listWrites).toBe(0);
  });

  it('passes the rule verdict of a refused line through (code, text key and params)', async () => {
    world.offers = [offer('plan', 'base-package'), offer('spotify', 'addon')];
    world.list = listOf([line('l1', 'plan'), line('l2', 'spotify')]);
    const refuse: AddLine = vi.fn(async (_s, _m, input) => {
      if (input.offerKey === 'spotify') {
        throw new BundleRefusal(409, 'OFFER_BLOCKED', "That item can't be added to your bundle.", { kind: 'incompatible', offerKey: 'spotify', reasons: [{ code: 'PARENT_REQUIRED', messageKey: 'offers.reason.PARENT_REQUIRED', params: {}, offerKeys: [] }] });
      }
      return ok(_s, _m, input);
    });
    const { result } = await moveListToBundle(SESSION, market, 'l1', refuse);
    expect(result.added.map((a) => a.offerKey)).toEqual(['plan']);
    expect(result.skipped[0]).toMatchObject({ lineId: 'l2', name: 'Name spotify', reason: { code: 'PARENT_REQUIRED', messageKey: 'offers.reason.PARENT_REQUIRED' } });
  });

  it('a refusal that is not a rule verdict keeps its own code', async () => {
    world.offers = [offer('plan', 'base-package')];
    world.list = listOf([line('l1', 'plan')]);
    const stock: AddLine = vi.fn(async () => {
      throw new BundleRefusal(409, 'INSUFFICIENT_STOCK', 'Not enough stock.');
    });
    const { result } = await moveListToBundle(SESSION, market, 'l1', stock);
    expect(result.skipped[0]?.reason).toEqual({ code: 'INSUFFICIENT_STOCK', message: 'Not enough stock.' });
  });

  it('an unexpected error aborts and rethrows; lines already added stay in the bundle', async () => {
    world.offers = [offer('plan', 'base-package'), offer('spotify', 'addon')];
    world.list = listOf([line('l1', 'plan'), line('l2', 'spotify')]);
    const addLine = vi.fn<AddLine>().mockImplementationOnce(ok).mockRejectedValueOnce(new Error('boom'));
    await expect(moveListToBundle(SESSION, market, 'l1', addLine)).rejects.toThrow('boom');
    expect(addLine).toHaveBeenCalledTimes(2);
    expect(world.listWrites).toBe(0);
  });

  it('keeps the new cart id between adds so a cart created by the first add is reused', async () => {
    world.offers = [offer('plan', 'base-package'), offer('spotify', 'addon')];
    world.list = listOf([line('l1', 'plan'), line('l2', 'spotify')]);
    const seen: Array<string | undefined> = [];
    const addLine: AddLine = async (session, _m, input) => {
      seen.push(session.cartId);
      return { cart: { id: 'new-cart', lines: [{ id: input.sku }] } as never, cartId: 'new-cart' };
    };
    const { cartId } = await moveListToBundle({ customerId: 'cust-1' }, market, 'l1', addLine);
    expect(seen).toEqual([undefined, 'new-cart']);
    expect(cartId).toBe('new-cart');
  });

  it('reads the bundle when nothing could be added', async () => {
    world.offers = [];
    world.list = listOf([line('l1', 'gone')]);
    const { result } = await moveListToBundle(SESSION, market, 'l1', vi.fn(ok));
    expect(result.added).toEqual([]);
    expect(result.cart).toBeNull();
    expect(world.bundleReads).toBe(1);
  });

  it("another customer's list is refused before any read of the catalog or the bundle", async () => {
    world.list = listOf([line('l1', 'plan')], 'cust-2');
    const addLine = vi.fn(ok);
    await expect(moveListToBundle(SESSION, market, 'l1', addLine)).rejects.toBeInstanceOf(ListNotFoundError);
    expect(addLine).not.toHaveBeenCalled();
  });
});
