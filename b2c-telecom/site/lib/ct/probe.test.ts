// @vitest-environment node
import type { CartDraft } from '@commercetools/platform-sdk';
import { PROBE_CART_KEY_PREFIX } from '@/lib/config/cart';

const { create, remove } = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn() }));
vi.mock('./cart', () => ({ createProbeCart: create, deleteCart: remove }));

import { probeKey, withProbeCart } from './probe';

const draft = { currency: 'USD' } as CartDraft;

beforeEach(() => {
  create.mockReset().mockResolvedValue({ id: 'c1', version: 3 });
  remove.mockReset().mockResolvedValue(undefined);
});

describe('withProbeCart', () => {
  it('hands the priced cart to the reader, returns its answer and deletes the cart', async () => {
    await expect(withProbeCart(draft, (cart) => cart.id)).resolves.toBe('c1');
    expect(remove).toHaveBeenCalledWith({ id: 'c1', version: 3 });
  });

  it('deletes the cart when the reader throws, and the reader error is the one that surfaces', async () => {
    await expect(withProbeCart(draft, () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('a failed delete is logged, never thrown over the answer', async () => {
    remove.mockRejectedValue(new Error('gone'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(withProbeCart(draft, () => 'ok')).resolves.toBe('ok');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('nothing to delete when the cart could not be created', async () => {
    create.mockRejectedValue(new Error('down'));
    await expect(withProbeCart(draft, () => 'x')).rejects.toThrow('down');
    expect(remove).not.toHaveBeenCalled();
  });

  it('probe keys carry the sweep prefix and are unique', () => {
    expect(probeKey().startsWith(PROBE_CART_KEY_PREFIX)).toBe(true);
    expect(probeKey()).not.toBe(probeKey());
  });
});
