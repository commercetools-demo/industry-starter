import { describe, it, expect, vi, beforeEach } from 'vitest';

const getKey = vi.fn();
const getExecute = vi.fn();
const createCall = vi.fn();
const createExecute = vi.fn();
const postCall = vi.fn();
const postExecute = vi.fn();
vi.mock('./client', () => ({
  getApiRoot: () => ({
    shoppingLists: () => ({
      post: (arg: unknown) => (createCall(arg), { execute: createExecute }),
      withKey: (k: unknown) => ({ get: () => (getKey(k), { execute: getExecute }) }),
      withId: (id: unknown) => ({ post: (arg: unknown) => (postCall(id, arg), { execute: postExecute }) }),
    }),
  }),
}));
const getProductsByIds = vi.fn();
vi.mock('./search', () => ({ getProductsByIds: (...a: unknown[]) => getProductsByIds(...a) }));

import { addProduct, getOrCreateWishlist, getSavedProductIds, getSavedProducts, removeProduct, saveProduct, unsaveProduct, wishlistKey } from './shopping-lists';

const line = (id: string, productId: string) => ({ id, productId, quantity: 1 });
const list = (lineItems: ReturnType<typeof line>[] = [], version = 3) => ({ id: 'sl-1', version, lineItems }) as never;
const notFound = () => Object.assign(new Error('nf'), { statusCode: 404 });
const status = (statusCode: number) => Object.assign(new Error('e'), { statusCode });

beforeEach(() => {
  vi.clearAllMocks();
  getExecute.mockReset();
  createExecute.mockReset();
  postExecute.mockReset();
});

describe('wishlistKey', () => {
  it('key format is wishlist-<customerId>', () => expect(wishlistKey('c-9')).toBe('wishlist-c-9'));
});

describe('getOrCreateWishlist', () => {
  it('existing list is returned and nothing is created', async () => {
    getExecute.mockResolvedValue({ body: list() });
    await getOrCreateWishlist('c-1');
    expect(getKey).toHaveBeenCalledWith({ key: 'wishlist-c-1' });
    expect(createCall).not.toHaveBeenCalled();
  });

  it('first use: created once with the key, localized name and customer reference', async () => {
    getExecute.mockRejectedValue(notFound());
    createExecute.mockResolvedValue({ body: list() });
    await getOrCreateWishlist('c-1');
    expect(createCall).toHaveBeenCalledTimes(1);
    expect(createCall.mock.calls[0][0].body).toEqual({
      key: 'wishlist-c-1',
      name: { 'en-US': 'Saved', 'de-DE': 'Gemerkt' },
      customer: { typeId: 'customer', id: 'c-1' },
    });
  });

  it('lost creation race (duplicate key): reads the list the other request created', async () => {
    getExecute.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({ body: list([], 7) });
    createExecute.mockRejectedValue(status(400));
    expect((await getOrCreateWishlist('c-1') as unknown as { version: number }).version).toBe(7);
  });

  it('other read errors propagate', async () => {
    getExecute.mockRejectedValue(status(500));
    await expect(getOrCreateWishlist('c-1')).rejects.toThrow();
  });
});

describe('addProduct / removeProduct', () => {
  it('add sends an addLineItem by productId with the list version', async () => {
    postExecute.mockResolvedValue({ body: list() });
    await addProduct(list(), 'p-1');
    expect(postCall).toHaveBeenCalledWith({ ID: 'sl-1' }, { body: { version: 3, actions: [{ action: 'addLineItem', productId: 'p-1', quantity: 1 }] } });
  });

  it('add skips a product that is already on the list', async () => {
    const l = list([line('li-1', 'p-1')]);
    expect(await addProduct(l, 'p-1')).toBe(l);
    expect(postCall).not.toHaveBeenCalled();
  });

  it('remove uses the line item id', async () => {
    postExecute.mockResolvedValue({ body: list() });
    await removeProduct(list([line('li-1', 'p-1'), line('li-2', 'p-2')]), 'p-2');
    expect(postCall.mock.calls[0][1].body.actions).toEqual([{ action: 'removeLineItem', lineItemId: 'li-2' }]);
  });

  it('remove of an unsaved product sends nothing', async () => {
    await removeProduct(list([line('li-1', 'p-1')]), 'p-9');
    expect(postCall).not.toHaveBeenCalled();
  });
});

describe('saveProduct / unsaveProduct', () => {
  it('a version conflict is retried once with a fresh list', async () => {
    getExecute.mockResolvedValueOnce({ body: list([], 3) }).mockResolvedValueOnce({ body: list([], 4) });
    postExecute.mockRejectedValueOnce(status(409)).mockResolvedValueOnce({ body: list([line('li-1', 'p-1')], 5) });
    await saveProduct('c-1', 'p-1');
    expect(postCall.mock.calls.map((c) => c[1].body.version)).toEqual([3, 4]);
  });

  it('unsave removes the line', async () => {
    getExecute.mockResolvedValue({ body: list([line('li-1', 'p-1')]) });
    postExecute.mockResolvedValue({ body: list() });
    await unsaveProduct('c-1', 'p-1');
    expect(postCall.mock.calls[0][1].body.actions).toEqual([{ action: 'removeLineItem', lineItemId: 'li-1' }]);
  });
});

describe('reads', () => {
  it('ids are newest first and a missing list is empty without creating one', async () => {
    getExecute.mockResolvedValueOnce({ body: list([line('a', 'p-1'), line('b', 'p-2')]) });
    expect(await getSavedProductIds('c-1')).toEqual(['p-2', 'p-1']);
    getExecute.mockRejectedValueOnce(notFound());
    expect(await getSavedProductIds('c-1')).toEqual([]);
    expect(createCall).not.toHaveBeenCalled();
  });

  it('getSavedProducts resolves the ids through getProductsByIds with the market', async () => {
    getExecute.mockResolvedValue({ body: list([line('a', 'p-1')]) });
    getProductsByIds.mockResolvedValue([{ id: 'p-1' }]);
    const ctx = { locale: 'en-US', currency: 'USD', country: 'US' };
    expect(await getSavedProducts('c-1', ctx)).toEqual([{ id: 'p-1' }]);
    expect(getProductsByIds).toHaveBeenCalledWith(['p-1'], ctx);
  });
});
