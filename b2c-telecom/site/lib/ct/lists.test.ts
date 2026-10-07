// @vitest-environment node
import type { ShoppingList } from '@commercetools/platform-sdk';
import type { Cart, Market, Offer } from '@/lib/types';

const market: Market = { locale: 'en-US', currency: 'USD', country: 'US' };

type Post = { id: string; version: number; actions: Array<Record<string, unknown>> };
const world = {
  lists: [] as ShoppingList[],
  posts: [] as Post[],
  created: [] as Array<Record<string, unknown>>,
  deleted: [] as string[],
  failStatus: undefined as number | undefined,
  failCount: 0,
  offers: [] as Offer[],
  offerReads: 0,
};

vi.mock('./catalog', () => ({
  getOffersByKeys: async (keys: string[]) => {
    world.offerReads += 1;
    return world.offers.filter((offer) => keys.includes(offer.key));
  },
}));
vi.mock('./client', () => ({
  getApiRoot: () => ({
    shoppingLists: () => ({
      get: () => ({ execute: async () => ({ body: { results: world.lists } }) }),
      post: ({ body }: { body: Record<string, unknown> }) => ({
        execute: async () => {
          world.created.push(body);
          return { body: { id: 'new', version: 1, lineItems: [], ...body } };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({
          execute: async () => {
            const found = world.lists.find((list) => list.id === ID);
            if (!found) throw Object.assign(new Error('nf'), { statusCode: 404 });
            return { body: found };
          },
        }),
        post: ({ body }: { body: { version: number; actions: Array<Record<string, unknown>> } }) => ({
          execute: async () => {
            world.posts.push({ id: ID, ...body });
            const found = world.lists.find((list) => list.id === ID) as unknown as { version: number };
            if (world.failStatus && world.failCount > 0) {
              world.failCount -= 1;
              found.version += 1;
              throw Object.assign(new Error('conflict'), { statusCode: world.failStatus });
            }
            return { body: found };
          },
        }),
        delete: ({ queryArgs }: { queryArgs: { version: number } }) => ({
          execute: async () => {
            world.deleted.push(`${ID}@${queryArgs.version}`);
            return { body: {} };
          },
        }),
      }),
    }),
  }),
}));

import { addOffer, createList, createListFromCart, deleteList, getList, getLists, InvalidListNameError, ListFullError, ListLimitError, ListNotFoundError, removeLine, renameList, UnknownOfferError } from './lists';

const usd = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const line = (id: string, offerKey: string, variantId = 1, extra: Record<string, unknown> = {}) => ({
  id, productId: `p-${offerKey}`, variantId, quantity: 1, name: { 'en-US': `Name ${offerKey}` },
  custom: { fields: { offerKey, savedAmountCents: 5499, savedCurrency: 'USD', ...extra } },
});
const list = (id: string, customerId: string | undefined, lineItems: unknown[] = [], over: Record<string, unknown> = {}): ShoppingList =>
  ({ id, version: 1, name: { 'en-US': `List ${id}` }, ...(customerId ? { customer: { typeId: 'customer', id: customerId } } : {}), lineItems, lastModifiedAt: '2026-10-07T10:00:00Z', ...over }) as unknown as ShoppingList;
const offer = (key: string, over: Partial<Offer> = {}): Offer =>
  ({ id: `p-${key}`, key, kind: 'base-package', name: `Name ${key}`, variants: [{ id: 1, sku: `SKU-${key}`, isMaster: true, term: '24-months', termMonths: 24, recurringPrice: usd(5999), images: [], attributes: {} }], ...over }) as unknown as Offer;

beforeEach(() => {
  world.lists = [list('mine', 'cust-1', [line('l1', 'cable')]), list('theirs', 'cust-2', [line('x1', 'cable')]), list('guest', undefined)];
  world.posts = [];
  world.created = [];
  world.deleted = [];
  world.failStatus = undefined;
  world.failCount = 0;
  world.offers = [offer('cable'), offer('spotify', { kind: 'addon' })];
  world.offerReads = 0;
});

describe('ownership', () => {
  it('returns only the lists of the session customer', async () => {
    expect((await getLists('cust-1')).map((l) => l.id)).toEqual(['mine']);
  });
  it('another customer list, a guest list and an unknown id are the same ListNotFoundError and nothing is written', async () => {
    for (const id of ['theirs', 'guest', 'nope']) {
      await expect(getList('cust-1', id, market)).rejects.toBeInstanceOf(ListNotFoundError);
      await expect(renameList('cust-1', id, 'x')).rejects.toBeInstanceOf(ListNotFoundError);
      await expect(addOffer('cust-1', id, { offerKey: 'cable' }, market)).rejects.toBeInstanceOf(ListNotFoundError);
      await expect(removeLine('cust-1', id, 'l1')).rejects.toBeInstanceOf(ListNotFoundError);
      await expect(deleteList('cust-1', id)).rejects.toBeInstanceOf(ListNotFoundError);
    }
    expect(world.posts).toEqual([]);
    expect(world.deleted).toEqual([]);
  });
});

describe('getList', () => {
  it('prices the lines now with one batched catalog read and reports the delta against the saved price', async () => {
    world.lists = [list('mine', 'cust-1', [line('l1', 'cable'), line('l2', 'spotify', 1, { savedAmountCents: 5999 })])];
    const detail = await getList('cust-1', 'mine', market);
    expect(world.offerReads).toBe(1);
    expect(detail.lines[0]).toMatchObject({ lineId: 'l1', name: 'Name cable', term: '24-months', saved: usd(5499), current: usd(5999), delta: { status: 'up', deltaCents: 500 }, available: true });
    expect(detail.lines[1]?.delta).toEqual({ status: 'same', deltaCents: 0 });
  });
  it('marks a line whose offer is not sold any more unavailable with the stored name and no price', async () => {
    world.offers = [];
    const detail = await getList('cust-1', 'mine', market);
    expect(detail.lines[0]).toMatchObject({ available: false, reason: 'NOT_PUBLISHED', name: 'Name cable', current: null, delta: { status: 'unknown' } });
  });
});

describe('createList', () => {
  it('creates a customer-owned list with a malva- key', async () => {
    await createList('cust-1', '  Home setup ');
    const body = world.created[0] as { key: string; name: Record<string, string>; customer: { id: string } };
    expect(body.key).toMatch(/^malva-list-[0-9a-f-]{36}$/);
    expect(body.name['en-US']).toBe('Home setup');
    expect(body.customer).toEqual({ typeId: 'customer', id: 'cust-1' });
  });
  it('LIST_LIMIT: refuses the 21st list before writing', async () => {
    world.lists = Array.from({ length: 20 }, (_, i) => list(`l${i}`, 'cust-1'));
    await expect(createList('cust-1', 'One more')).rejects.toBeInstanceOf(ListLimitError);
    expect(world.created).toEqual([]);
  });
  it('refuses an empty or too long name', async () => {
    await expect(createList('cust-1', '   ')).rejects.toBeInstanceOf(InvalidListNameError);
    await expect(createList('cust-1', 'x'.repeat(61))).rejects.toBeInstanceOf(InvalidListNameError);
    await expect(createList('cust-1', 5)).rejects.toBeInstanceOf(InvalidListNameError);
  });
  it('fromCart copies all lines with their saved price and skips fees, included lines and unknown offers', async () => {
    const cartLine = (id: string, offerKey: string, sku: string | null, over: Record<string, unknown> = {}) => ({ id, source: 'line-item', offerKey, sku, kind: 'plan', quantity: 2, unitPrice: usd(4999), includedAtNoCharge: false, ...over });
    const cart = {
      lines: [
        cartLine('a', 'cable', 'SKU-cable'),
        cartLine('b', 'spotify', 'SKU-spotify', { kind: 'addon', quantity: 1 }),
        cartLine('c', 'cable', null, { source: 'custom-line-item', kind: 'fee' }),
        cartLine('d', 'spotify', 'SKU-spotify', { includedAtNoCharge: true }),
        cartLine('e', 'ghost', 'SKU-ghost'),
      ],
    } as unknown as Cart;
    await createListFromCart('cust-1', 'Home setup', cart, market);
    const lineItems = (world.created[0] as { lineItems: Array<{ productId: string; variantId: number; quantity: number; custom: { fields: Record<string, unknown> } }> }).lineItems;
    expect(lineItems.map((l) => [l.productId, l.variantId, l.quantity])).toEqual([['p-cable', 1, 2], ['p-spotify', 1, 1]]);
    expect(lineItems[0]?.custom.fields).toMatchObject({ offerKey: 'cable', savedAmountCents: 4999, savedCurrency: 'USD' });
  });
});

describe('addOffer', () => {
  it('writes the saved price into the custom fields of the new line (master variant, quantity 1)', async () => {
    await addOffer('cust-1', 'mine', { offerKey: 'spotify' }, market);
    const action = world.posts[0]?.actions[0] as { action: string; productId: string; variantId: number; quantity: number; custom: { type: { key: string }; fields: Record<string, unknown> } };
    expect(action).toMatchObject({ action: 'addLineItem', productId: 'p-spotify', variantId: 1, quantity: 1 });
    expect(action.custom.type.key).toBe('malva-list-line');
    expect(action.custom.fields).toMatchObject({ offerKey: 'spotify', savedAmountCents: 5999, savedCurrency: 'USD' });
  });
  it('the same offer and variant already on the list is not added twice', async () => {
    await addOffer('cust-1', 'mine', { offerKey: 'cable', variantId: 1 }, market);
    expect(world.posts).toEqual([]);
  });
  it('LIST_FULL at 25 lines', async () => {
    world.lists = [list('mine', 'cust-1', Array.from({ length: 25 }, (_, i) => line(`l${i}`, `o${i}`)))];
    await expect(addOffer('cust-1', 'mine', { offerKey: 'spotify' }, market)).rejects.toBeInstanceOf(ListFullError);
    expect(world.posts).toEqual([]);
  });
  it('refuses an unknown offer or variant', async () => {
    await expect(addOffer('cust-1', 'mine', { offerKey: 'ghost' }, market)).rejects.toBeInstanceOf(UnknownOfferError);
    await expect(addOffer('cust-1', 'mine', { offerKey: 'spotify', variantId: 9 }, market)).rejects.toBeInstanceOf(UnknownOfferError);
  });
  it('re-reads and retries once on a version conflict', async () => {
    world.failStatus = 409;
    world.failCount = 1;
    await addOffer('cust-1', 'mine', { offerKey: 'spotify' }, market);
    expect(world.posts.map((p) => p.version)).toEqual([1, 2]);
  });
});

describe('rename and remove', () => {
  it('renames and removes a line of an own list', async () => {
    await renameList('cust-1', 'mine', 'Office');
    await removeLine('cust-1', 'mine', 'l1');
    expect(world.posts.map((p) => p.actions[0])).toEqual([{ action: 'changeName', name: { 'en-US': 'Office', 'de-DE': 'Office' } }, { action: 'removeLineItem', lineItemId: 'l1' }]);
    await expect(removeLine('cust-1', 'mine', 'nope')).rejects.toBeInstanceOf(ListNotFoundError);
  });
  it('deletes with the current version', async () => {
    await deleteList('cust-1', 'mine');
    expect(world.deleted).toEqual(['mine@1']);
  });
});
