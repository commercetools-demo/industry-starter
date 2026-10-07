import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from '../mappers/__fixtures__/cart.json';

const getCartCall = vi.fn();
const postCall = vi.fn();
const createCall = vi.fn();
const getExecute = vi.fn();
const postExecute = vi.fn();
const createExecute = vi.fn();
vi.mock('./client', () => ({
  getApiRoot: () => ({
    carts: () => ({
      post: (arg: unknown) => (createCall(arg), { execute: createExecute }),
      withId: (id: unknown) => ({
        get: (arg: unknown) => (getCartCall(id, arg), { execute: getExecute }),
        post: (arg: unknown) => (postCall(id, arg), { execute: postExecute }),
      }),
    }),
  }),
}));

import { addLineItem, changeLineItemQuantity, createCart, CartNotActiveError, getCart, getMappedCart, removeLineItem, setLineItemSubstitution, withCartRetry } from './cart';

const cart = (over: Record<string, unknown> = {}) => ({ ...(fixture as Record<string, unknown>), ...over }) as never;
const conflict = () => Object.assign(new Error('ConcurrentModification'), { statusCode: 409 });

beforeEach(() => {
  vi.clearAllMocks();
  getExecute.mockReset();
  postExecute.mockReset();
  createExecute.mockReset();
});

describe('getCart', () => {
  it('Active cart is returned', async () => {
    getExecute.mockResolvedValue({ body: cart() });
    expect((await getCart('cart-1'))?.id).toBe('cart-1');
    expect(getCartCall.mock.calls[0][0]).toEqual({ ID: 'cart-1' });
  });

  it('non-Active cart returns null', async () => {
    getExecute.mockResolvedValue({ body: cart({ cartState: 'Ordered' }) });
    expect(await getCart('cart-1')).toBeNull();
  });

  it('missing cart (404) returns null; other errors propagate', async () => {
    getExecute.mockRejectedValueOnce(Object.assign(new Error('nf'), { statusCode: 404 }));
    expect(await getCart('gone')).toBeNull();
    getExecute.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    await expect(getCart('x')).rejects.toThrow('boom');
  });

  it('getMappedCart maps the Active cart and passes through null', async () => {
    getExecute.mockResolvedValueOnce({ body: cart() });
    expect((await getMappedCart('cart-1', { locale: 'en-US', currency: 'USD', country: 'US' }))?.itemCount).toBe(2);
    getExecute.mockResolvedValueOnce({ body: cart({ cartState: 'Merged' }) });
    expect(await getMappedCart('cart-1', { locale: 'en-US', currency: 'USD', country: 'US' })).toBeNull();
  });
});

describe('createCart', () => {
  const market = { currency: 'USD', country: 'US', locale: 'en-US' };

  it('anonymous cart has an anonymousId, inventory None and platform tax', async () => {
    createExecute.mockResolvedValue({ body: cart() });
    await createCart(market);
    const body = createCall.mock.calls[0][0].body;
    expect(body).toMatchObject({ currency: 'USD', country: 'US', locale: 'en-US', inventoryMode: 'None', taxMode: 'Platform' });
    expect(typeof body.anonymousId).toBe('string');
    expect(body.anonymousId.length).toBeGreaterThan(10);
    expect(body.customerId).toBeUndefined();
  });

  it('keeps the session anonymousId', async () => {
    createExecute.mockResolvedValue({ body: cart() });
    await createCart({ ...market, anonymousId: 'anon-9' });
    expect(createCall.mock.calls[0][0].body.anonymousId).toBe('anon-9');
  });

  it('signed-in customer cart has customerId and no anonymousId', async () => {
    createExecute.mockResolvedValue({ body: cart() });
    await createCart({ ...market, customerId: 'c-1' });
    const body = createCall.mock.calls[0][0].body;
    expect(body.customerId).toBe('c-1');
    expect(body.anonymousId).toBeUndefined();
  });
});

describe('line item actions', () => {
  beforeEach(() => postExecute.mockResolvedValue({ body: cart() }));

  it('addLineItem sends the substitution custom field with the current version', async () => {
    await addLineItem('cart-1', 4, { sku: 'MILK-1L', quantity: 2, substitutionPreference: 'allow-similar' });
    const [id, arg] = postCall.mock.calls[0];
    expect(id).toEqual({ ID: 'cart-1' });
    expect(arg.body.version).toBe(4);
    expect(arg.body.actions).toEqual([
      {
        action: 'addLineItem',
        sku: 'MILK-1L',
        quantity: 2,
        custom: { type: { key: 'line-substitution', typeId: 'type' }, fields: { substitutionPreference: 'allow-similar' } },
      },
    ]);
  });

  it('addLineItem with a recurrence policy key adds Dynamic recurrence info', async () => {
    await addLineItem('cart-1', 4, { sku: 'MILK-1L', quantity: 1, recurrencePolicyKey: 'weekly', substitutionPreference: 'none' });
    expect(postCall.mock.calls[0][1].body.actions[0].recurrenceInfo).toEqual({
      recurrencePolicy: { typeId: 'recurrence-policy', key: 'weekly' },
      priceSelectionMode: 'Dynamic',
    });
  });

  it('changeLineItemQuantity and removeLineItem send their actions', async () => {
    await changeLineItemQuantity('cart-1', 5, 'line-1', 3);
    await removeLineItem('cart-1', 6, 'line-1');
    expect(postCall.mock.calls[0][1].body).toEqual({ version: 5, actions: [{ action: 'changeLineItemQuantity', lineItemId: 'line-1', quantity: 3 }] });
    expect(postCall.mock.calls[1][1].body).toEqual({ version: 6, actions: [{ action: 'removeLineItem', lineItemId: 'line-1' }] });
  });
});

describe('setLineItemSubstitution', () => {
  beforeEach(() => postExecute.mockResolvedValue({ body: cart() }));
  const withLine = (custom: unknown) => cart({ id: 'c9', version: 7, lineItems: [{ id: 'l1', custom }] });

  it('line with the custom type: sets the field', async () => {
    await setLineItemSubstitution(withLine({ fields: {} }), 'l1', 'none');
    const [id, arg] = postCall.mock.calls[0];
    expect(id).toEqual({ ID: 'c9' });
    expect(arg.body).toEqual({ version: 7, actions: [{ action: 'setLineItemCustomField', lineItemId: 'l1', name: 'substitutionPreference', value: 'none' }] });
  });

  it('line without custom type: sets type and field together', async () => {
    await setLineItemSubstitution(withLine(undefined), 'l1', 'allow-similar');
    expect(postCall.mock.calls[0][1].body.actions).toEqual([
      { action: 'setLineItemCustomType', lineItemId: 'l1', type: { key: 'line-substitution', typeId: 'type' }, fields: { substitutionPreference: 'allow-similar' } },
    ]);
  });
});

describe('withCartRetry', () => {
  it('Version conflict: refetches, retries once and returns the server cart', async () => {
    getExecute.mockResolvedValueOnce({ body: cart({ version: 4 }) }).mockResolvedValueOnce({ body: cart({ version: 5 }) });
    const fn = vi.fn().mockRejectedValueOnce(conflict()).mockImplementationOnce(async (c: { version: number }) => cart({ version: c.version + 1 }));
    const result = await withCartRetry('cart-1', fn);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[0][0].version).toBe(4);
    expect(fn.mock.calls[1][0].version).toBe(5);
    expect((result as { version: number }).version).toBe(6);
    expect(getExecute).toHaveBeenCalledTimes(2);
  });

  it('second 409 throws (retries only once)', async () => {
    getExecute.mockResolvedValue({ body: cart() });
    const fn = vi.fn().mockRejectedValue(conflict());
    await expect(withCartRetry('cart-1', fn)).rejects.toThrow('ConcurrentModification');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('other errors are not retried', async () => {
    getExecute.mockResolvedValue({ body: cart() });
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { statusCode: 400 }));
    await expect(withCartRetry('cart-1', fn)).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('non-Active cart throws CartNotActiveError', async () => {
    getExecute.mockResolvedValue({ body: cart({ cartState: 'Ordered' }) });
    await expect(withCartRetry('cart-1', vi.fn())).rejects.toBeInstanceOf(CartNotActiveError);
  });
});
