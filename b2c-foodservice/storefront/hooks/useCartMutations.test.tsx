import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/hooks/fetcher';
import { useCart } from '@/hooks/useCart';
import { CART_PENDING, useCartMutations } from '@/hooks/useCartMutations';
import { useCartCount } from '@/hooks/useCartCount';
import type { Cart } from '@/lib/types';
import { usd, viewCart, viewLine } from '@/test/cart';
import { stubFetch } from '@/test/shell';

afterEach(() => vi.unstubAllGlobals());

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);
const one = viewCart([viewLine({ id: 'a', quantity: 1 })]);
const three = viewCart([viewLine({ id: 'a', quantity: 3 })]);

function setup(routes: Parameters<typeof stubFetch>[0]) {
  const stub = stubFetch({ '/api/cart/count': () => ({ count: 1 }), ...routes });
  const hook = renderHook(
    () => ({ cart: useCart(), mut: useCartMutations(), count: useCartCount() }),
    { wrapper },
  );
  return { stub, hook };
}

describe('useCartMutations', () => {
  it('mutations update KEY_CART from the response body without a refetch', async () => {
    const { stub, hook } = setup({ '/api/cart/lines/a': () => ({ cart: three }), '/api/cart': () => ({ cart: one }) });
    await waitFor(() => expect(hook.result.current.cart.cart?.count).toBe(1));
    const getsBefore = stub.calls.filter((c) => c.url === '/api/cart').length;
    await act(async () => {
      await hook.result.current.mut.setQuantity('a', 3);
    });
    expect(hook.result.current.cart.cart?.count).toBe(3);
    expect(stub.calls.filter((c) => c.url === '/api/cart')).toHaveLength(getsBefore); // no GET after the write
    const write = stub.calls.find((c) => c.url === '/api/cart/lines/a');
    expect(write?.init?.method).toBe('PATCH');
    expect(JSON.parse(String(write?.init?.body))).toEqual({ quantity: 3 });
  });

  it('count updated with the cart', async () => {
    const { hook } = setup({ '/api/cart/lines/a': () => ({ cart: three }), '/api/cart': () => ({ cart: one }) });
    await waitFor(() => expect(hook.result.current.count).toBe(1));
    await act(async () => {
      await hook.result.current.mut.setQuantity('a', 3);
    });
    expect(hook.result.current.count).toBe(3);
  });

  it('mutations throw on error and keep the previous cart', async () => {
    const { hook } = setup({
      '/api/cart/lines/a': () => Response.json({ error: { code: 'quantity_exceeds_stock', message: 'x', available: 2 } }, { status: 409 }),
      '/api/cart': () => ({ cart: one }),
    });
    await waitFor(() => expect(hook.result.current.cart.cart?.count).toBe(1));
    let error: unknown;
    await act(async () => {
      error = await hook.result.current.mut.setQuantity('a', 9).catch((e: unknown) => e);
    });
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'quantity_exceeds_stock', status: 409, extra: { available: 2 } });
    expect(hook.result.current.cart.cart?.count).toBe(1);
  });

  it('a refused code replaces the cart with the unchanged one from the error', async () => {
    const unchanged: Cart = viewCart([viewLine({ id: 'a', quantity: 1 })], { total: usd(1815) });
    const { hook } = setup({
      '/api/cart': (init) =>
        init?.method === 'PATCH'
          ? Response.json({ error: { code: 'code_not_applied', message: 'x', details: { reason: 'NotActive', cart: unchanged } } }, { status: 422 })
          : { cart: { ...one, total: usd(1) } },
    });
    await waitFor(() => expect(hook.result.current.cart.cart?.total.centAmount).toBe(1));
    await act(async () => {
      await hook.result.current.mut.applyCode('OLD').catch(() => undefined);
    });
    expect(hook.result.current.cart.cart?.total.centAmount).toBe(1815);
  });

  it('pending flag per line', async () => {
    let release: (v: unknown) => void = () => undefined;
    const gate = new Promise((r) => (release = r));
    const { hook } = setup({ '/api/cart/lines/a': async () => { await gate; return { cart: three }; }, '/api/cart': () => ({ cart: one }) });
    await waitFor(() => expect(hook.result.current.cart.cart).not.toBeNull());
    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = hook.result.current.mut.setQuantity('a', 3);
    });
    expect(hook.result.current.mut.isPending('a')).toBe(true);
    expect(hook.result.current.mut.isPending('b')).toBe(false);
    expect(hook.result.current.mut.isPending(CART_PENDING)).toBe(false);
    await act(async () => {
      release(undefined);
      await done;
    });
    expect(hook.result.current.mut.isPending('a')).toBe(false);
    expect(hook.result.current.mut.anyPending).toBe(false);
  });

  it('remove, switch, store and code calls use the documented requests', async () => {
    const { stub, hook } = setup({ '/api/cart/lines/a': () => ({ cart: one }), '/api/cart': () => ({ cart: one }) });
    await waitFor(() => expect(hook.result.current.cart.cart).not.toBeNull());
    await act(async () => {
      await hook.result.current.mut.remove('a');
      await hook.result.current.mut.switchFulfilment('a', { fulfilment: 'collect', storeKey: 'mcf-store-x' });
      await hook.result.current.mut.changeStore('mcf-store-y');
      await hook.result.current.mut.applyCode('WELCOME10');
      await hook.result.current.mut.removeCode('c-1');
    });
    const writes = stub.calls.filter((c) => c.init?.method).map((c) => [c.init?.method, c.url, c.init?.body ? JSON.parse(String(c.init.body)) : null]);
    expect(writes).toEqual([
      ['DELETE', '/api/cart/lines/a', null],
      ['PATCH', '/api/cart/lines/a', { fulfilment: 'collect', storeKey: 'mcf-store-x' }],
      ['PATCH', '/api/cart', { action: 'changeCollectionStore', storeKey: 'mcf-store-y' }],
      ['PATCH', '/api/cart', { action: 'applyDiscountCode', code: 'WELCOME10' }],
      ['PATCH', '/api/cart', { action: 'removeDiscountCode', id: 'c-1' }],
    ]);
  });

  it('useCart with initialCart renders without a loading flash and enabled false reads nothing', async () => {
    const stub = stubFetch({ '/api/cart': () => ({ cart: one }) });
    const seeded = renderHook(() => useCart({ initialCart: three }), { wrapper });
    expect(seeded.result.current.cart?.count).toBe(3);
    expect(seeded.result.current.isLoading).toBe(false);
    await Promise.resolve();
    expect(stub.calls.filter((c) => c.url === '/api/cart')).toHaveLength(0); // the server just read it: no refetch on mount
    stub.fn.mockClear();
    renderHook(() => useCart({ enabled: false }), { wrapper });
    await Promise.resolve();
    expect(stub.fn).not.toHaveBeenCalled();
  });
});
