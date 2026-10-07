// @vitest-environment node
const execute = vi.fn();
const get = vi.fn(() => ({ execute }));
const withId = vi.fn<(args: { ID: string }) => object>(() => ({ get, post: vi.fn(), delete: vi.fn() }));
vi.mock('./client', () => ({ getApiRoot: () => ({ carts: () => ({ withId, post: vi.fn() }) }) }));

import { getCartLineRefs } from './cart-context';

const cart = (lineItems: unknown[], cartState = 'Active') => ({ body: { cartState, lineItems } });

beforeEach(() => vi.clearAllMocks());

describe('getCartLineRefs', () => {
  it('maps line id, quantity and the custom fields offerKey and parentLineItemId', async () => {
    execute.mockResolvedValue(
      cart([
        { id: 'L1', quantity: 1, productKey: 'ignored', custom: { fields: { offerKey: 'malva-offer-cable-500' } } },
        { id: 'L2', quantity: 2, custom: { fields: { offerKey: 'malva-offer-spotify', parentLineItemId: 'L1' } } },
      ]),
    );
    expect(await getCartLineRefs('cart-1')).toEqual([
      { lineItemId: 'L1', offerKey: 'malva-offer-cable-500', quantity: 1 },
      { lineItemId: 'L2', offerKey: 'malva-offer-spotify', parentLineItemId: 'L1', quantity: 2 },
    ]);
    expect(withId).toHaveBeenCalledWith({ ID: 'cart-1' });
  });

  it('falls back to the product key when the offerKey field is missing', async () => {
    execute.mockResolvedValue(cart([{ id: 'L1', quantity: 1, productKey: 'malva-offer-cable-100' }]));
    expect((await getCartLineRefs('c'))[0].offerKey).toBe('malva-offer-cable-100');
  });

  it('returns no lines for a 404 and for a cart that is not Active', async () => {
    execute.mockRejectedValueOnce({ statusCode: 404 });
    expect(await getCartLineRefs('gone')).toEqual([]);
    execute.mockResolvedValueOnce(cart([{ id: 'L1', quantity: 1 }], 'Ordered'));
    expect(await getCartLineRefs('ordered')).toEqual([]);
  });

  it('rethrows other errors and only ever reads (no write method is touched)', async () => {
    execute.mockRejectedValueOnce({ statusCode: 500 });
    await expect(getCartLineRefs('x')).rejects.toEqual({ statusCode: 500 });
    expect(get).toHaveBeenCalledTimes(1);
  });
});
