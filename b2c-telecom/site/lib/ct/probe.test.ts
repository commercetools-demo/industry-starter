// @vitest-environment node
import type { CartDraft } from '@commercetools/platform-sdk';
import { PROBE_CART_KEY_PREFIX } from '@/lib/config/cart';

const { create, remove, update } = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn(), update: vi.fn() }));
vi.mock('./cart', () => ({ createProbeCart: create, deleteCart: remove, updateCart: update }));

import { probeKey, withProbeCart } from './probe';

const draft = { currency: 'USD' } as CartDraft;

beforeEach(() => {
  create.mockReset().mockResolvedValue({ id: 'c1', version: 3 });
  remove.mockReset().mockResolvedValue(undefined);
  update.mockReset().mockResolvedValue({ id: 'c1', version: 4 });
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

  it('a probe that was updated is deleted with the version the update left', async () => {
    await withProbeCart(draft, async (_probe, tools) => {
      await tools.update([{ action: 'setCountry', country: 'US' }]);
    });
    expect(update).toHaveBeenCalledWith({ id: 'c1', version: 3 }, [{ action: 'setCountry', country: 'US' }]);
    expect(remove).toHaveBeenCalledWith({ id: 'c1', version: 4 });
  });

  it('a failed update still deletes the cart', async () => {
    update.mockRejectedValue(new Error('conflict'));
    await expect(withProbeCart(draft, (_probe, tools) => tools.update([]))).rejects.toThrow('conflict');
    expect(remove).toHaveBeenCalledWith({ id: 'c1', version: 3 });
  });

  it('nothing to delete when the cart could not be created', async () => {
    create.mockRejectedValue(new Error('down'));
    await expect(withProbeCart(draft, () => 'x')).rejects.toThrow('down');
    expect(remove).not.toHaveBeenCalled();
  });

  it('probe keys carry the sweep prefix and are unique', () => {
    expect(probeKey().startsWith(PROBE_CART_KEY_PREFIX)).toBe(true);
    expect(probeKey('preview-probe-').startsWith('preview-probe-')).toBe(true);
    expect(probeKey()).not.toBe(probeKey());
  });
});
