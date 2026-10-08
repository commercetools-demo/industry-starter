// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const getActiveCartSafe = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('@/lib/ct/cart-read', () => ({ getActiveCartSafe: (id: string) => getActiveCartSafe(id) }));

import { KEY_ACCOUNT, KEY_CART } from './cache-keys';
import { getSwrFallback } from './swr-fallback';

describe('storefront-data-loading: Initial client state from the session', () => {
  beforeEach(() => {
    getSession.mockReset();
    getActiveCartSafe.mockReset();
  });

  it('Signed-in first paint: KEY_CART and a minimal KEY_ACCOUNT are in the fallback', async () => {
    getSession.mockResolvedValue({ customerId: 'c1', cartId: 'k1', locale: 'en-US' });
    getActiveCartSafe.mockResolvedValue({ id: 'k1', version: 1, itemCount: 2, currencyCode: 'USD' });
    const fallback = await getSwrFallback();
    expect(fallback[KEY_CART]).toEqual({ id: 'k1', version: 1, itemCount: 2, currencyCode: 'USD' });
    expect(fallback[KEY_ACCOUNT]).toEqual({ id: 'c1' });
    expect(JSON.parse(JSON.stringify(fallback))).toEqual(fallback);
  });

  it('anonymous first paint: empty fallback, no commercetools call', async () => {
    getSession.mockResolvedValue({ locale: 'en-US' });
    expect(await getSwrFallback()).toEqual({});
    expect(getActiveCartSafe).not.toHaveBeenCalled();
  });

  it('Stale cart reference: the page still gets a fallback (cart null)', async () => {
    getSession.mockResolvedValue({ cartId: 'gone' });
    getActiveCartSafe.mockResolvedValue(null);
    expect(await getSwrFallback()).toEqual({ [KEY_CART]: null });
  });

  it('User object source: the fallback user carries the id only, never a name', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    const user = (await getSwrFallback())[KEY_ACCOUNT] as unknown as Record<string, unknown>;
    expect(Object.keys(user)).toEqual(['id']);
  });
});
