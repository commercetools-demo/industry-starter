// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
vi.mock('@/lib/ct/client', () => ({
  apiRoot: { carts: () => ({ withId: () => ({ get: () => ({ execute }) }) }) },
}));
const clearCart = vi.fn();
vi.mock('@/lib/session', () => ({ clearCart: () => clearCart() }));

import { getActiveCartSafe } from './cart-read';

const cart = (cartState: string) => ({
  body: { id: 'k1', version: 3, cartState, lineItems: [{ quantity: 2 }, { quantity: 1 }], totalPrice: { currencyCode: 'USD' } },
});

describe('storefront-data-loading: Initial client state from the session', () => {
  beforeEach(() => {
    execute.mockReset();
    clearCart.mockReset().mockResolvedValue({});
  });

  it('active cart: summary with item count, session untouched', async () => {
    execute.mockResolvedValue(cart('Active'));
    expect(await getActiveCartSafe('k1')).toEqual({ id: 'k1', version: 3, itemCount: 3, currencyCode: 'USD' });
    expect(clearCart).not.toHaveBeenCalled();
  });

  it('Stale cart reference: a missing cart yields null and clears cartId', async () => {
    execute.mockRejectedValue({ statusCode: 404 });
    expect(await getActiveCartSafe('gone')).toBeNull();
    expect(clearCart).toHaveBeenCalledTimes(1);
  });

  it('Stale cart reference: a cart that is not active yields null and clears cartId', async () => {
    execute.mockResolvedValue(cart('Ordered'));
    expect(await getActiveCartSafe('k1')).toBeNull();
    expect(clearCart).toHaveBeenCalledTimes(1);
  });

  it('Stale cart reference: still renders when the cookie is read-only (clear throws)', async () => {
    execute.mockRejectedValue({ statusCode: 404 });
    clearCart.mockRejectedValue(new Error('Cookies can only be modified in a Server Action or Route Handler'));
    await expect(getActiveCartSafe('gone')).resolves.toBeNull();
  });

  it('a commercetools outage returns null without clearing the cart reference', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    execute.mockRejectedValue({ statusCode: 503 });
    expect(await getActiveCartSafe('k1')).toBeNull();
    expect(clearCart).not.toHaveBeenCalled();
  });
});
