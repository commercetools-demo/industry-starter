// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  class LineRejected extends Error {
    constructor(readonly code: string, readonly status: number, readonly extra: Record<string, number | string> = {}) {
      super(code);
    }
  }
  return { LineRejected, addLine: vi.fn(), getCartForSession: vi.fn(), getInventoryDetail: vi.fn() };
});
vi.mock('@/lib/ct/cart', () => ({ LineRejected: h.LineRejected, addLine: h.addLine, getCartForSession: h.getCartForSession }));
vi.mock('@/lib/ct/inventory', () => ({ getInventoryDetail: h.getInventoryDetail }));

import { planReorder, reasonFor, runReorder } from '@/lib/ct/reorder';
import { AppError } from '@/lib/errors';
import type { Session } from '@/lib/session';
import { collectLine, ctLine, ctOrder } from '@/test/orders';

const market = { country: 'US', currency: 'USD', locale: 'en-US' };
const sub = (id: string) => ctLine(id, { recurrenceInfo: { recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp' } }, custom: { type: { typeId: 'type', id: 't' }, fields: { fulfilment: 'subscribe' } } });
const summary = (count: number) => ({ id: 'cart-1', version: 2, count, lines: [] });

beforeEach(() => {
  for (const f of [h.addLine, h.getCartForSession, h.getInventoryDetail]) f.mockReset();
  h.getInventoryDetail.mockImplementation(async (skus: string[]) => Object.fromEntries(skus.map((s) => [s, { online: 50, stores: {} }])));
  h.addLine.mockImplementation(async (session: Session) => ({ cart: summary(1), session: { ...session, cartId: 'cart-1' } }));
});

describe('planReorder', () => {
  const order = ctOrder({ lineItems: [ctLine('d1'), collectLine('c1'), sub('s1')] });

  it('Subscribe lines are re-added as one-off delivery lines', () => {
    const plan = planReorder(order, { locale: 'en-US', collection: true, storeKey: 'mcf-store-nyc-soho' });
    expect(plan.map((p) => [p.sku, p.ordered, p.fulfilment])).toEqual([
      ['SKU-d1', 'delivery', 'delivery'], ['SKU-c1', 'collect', 'collect'], ['SKU-s1', 'subscribe', 'delivery'],
    ]);
  });

  it('Collect line uses the current store, not the stored one', () => {
    const plan = planReorder(order, { locale: 'en-US', collection: true, storeKey: 'mcf-store-nyc-brooklyn' });
    expect(plan[1]).toMatchObject({ fulfilment: 'collect', storeKey: 'mcf-store-nyc-brooklyn' });
  });

  it('a collect line becomes delivery with no store chosen or in a market without collection', () => {
    expect(planReorder(order, { locale: 'en-US', collection: true })[1].fulfilment).toBe('delivery');
    expect(planReorder(order, { locale: 'en-CA', collection: false, storeKey: 'mcf-store-nyc-soho' })[1].fulfilment).toBe('delivery');
  });

  it('caps a quantity at the cart line maximum and keeps the line name', () => {
    const big = ctOrder({ lineItems: [ctLine('x', { quantity: 500 })] });
    expect(planReorder(big, { locale: 'en-US', collection: true })[0]).toMatchObject({ quantity: 99, name: 'Product x' });
  });
});

describe('runReorder', () => {
  const session: Session = { customerId: 'c1', cartId: 'cart-old', collectionStoreKey: 'mcf-store-nyc-soho' };

  it('Buy again: available lines are added to the current bag', async () => {
    const out = await runReorder(session, market, ctOrder({ lineItems: [ctLine('d1', { quantity: 2 }), ctLine('d2')] }));
    expect(out.result.added.map((a) => [a.sku, a.quantity, a.fulfilment])).toEqual([['SKU-d1', 2, 'delivery'], ['SKU-d2', 2, 'delivery']]);
    expect(out.result.skipped).toEqual([]);
    // The existing bag is the one written to: the session passed in still carries its cart id.
    expect(h.addLine.mock.calls[0][0].cartId).toBe('cart-old');
    expect(out.session.cartId).toBe('cart-1');
  });

  it('Reorder with an unavailable item: reasons per line, the others still added', async () => {
    h.addLine.mockImplementation(async (s: Session, _m: unknown, input: { sku: string }) => {
      if (input.sku === 'SKU-gone') throw new AppError('not_found', 404);
      if (input.sku === 'SKU-nop') throw new AppError('validation_failed', 422);
      if (input.sku === 'SKU-pub') throw Object.assign(new Error('x'), { statusCode: 400 });
      return { cart: summary(2), session: s };
    });
    const out = await runReorder(
      session, market,
      ctOrder({ lineItems: [ctLine('ok'), ctLine('gone', { variant: { id: 1, sku: 'SKU-gone', images: [] } }), ctLine('nop', { variant: { id: 1, sku: 'SKU-nop', images: [] } }), ctLine('pub', { variant: { id: 1, sku: 'SKU-pub', images: [] } })] }),
    );
    expect(out.result.added.map((a) => a.sku)).toEqual(['SKU-ok']);
    expect(out.result.skipped.map((s) => [s.sku, s.reason])).toEqual([
      ['SKU-gone', 'not_found'], ['SKU-nop', 'price_missing'], ['SKU-pub', 'unavailable'],
    ]);
  });

  it('a delivery line with no online stock is skipped, a shortfall adds what is there', async () => {
    h.getInventoryDetail.mockResolvedValue({ 'SKU-a': { online: 0, stores: {} }, 'SKU-b': { online: 1, stores: {} } });
    const out = await runReorder(session, market, ctOrder({ lineItems: [ctLine('a'), ctLine('b', { quantity: 4 })] }));
    expect(out.result.skipped).toEqual([{ sku: 'SKU-a', name: 'Product a', reason: 'out_of_stock' }]);
    expect(out.result.added).toEqual([{ sku: 'SKU-b', name: 'Product b', quantity: 1, fulfilment: 'delivery' }]);
  });

  it('Collect line uses the current store and is skipped when out of stock there', async () => {
    h.addLine.mockImplementation(async (s: Session, _m: unknown, input: { fulfilment: string }) => {
      if (input.fulfilment === 'collect') throw new h.LineRejected('not_available_for_collection', 409, { available: 0 });
      return { cart: summary(1), session: s };
    });
    const out = await runReorder(session, market, ctOrder({ lineItems: [collectLine('c1')] }));
    expect(h.addLine.mock.calls[0][2]).toMatchObject({ fulfilment: 'collect', storeKey: 'mcf-store-nyc-soho' });
    expect(out.result.skipped).toEqual([{ sku: 'SKU-c1', name: 'Product c1', reason: 'out_of_stock' }]);
  });

  it('a store with fewer than ordered adds what it has', async () => {
    h.addLine.mockImplementationOnce(async () => {
      throw new h.LineRejected('not_available_for_collection', 409, { available: 1 });
    });
    const out = await runReorder(session, market, ctOrder({ lineItems: [collectLine('c1', { quantity: 3 })] }));
    expect(out.result.added).toEqual([{ sku: 'SKU-c1', name: 'Product c1', quantity: 1, fulfilment: 'collect' }]);
  });

  it('Subscribe lines are re-added as one-off ship lines, never recurring', async () => {
    await runReorder(session, market, ctOrder({ lineItems: [sub('s1')] }));
    expect(h.addLine.mock.calls[0][2]).toEqual({ sku: 'SKU-s1', quantity: 2, fulfilment: 'delivery' });
  });

  it('an unexpected failure is not swallowed', async () => {
    h.addLine.mockRejectedValue(new AppError('upstream_unavailable', 503));
    await expect(runReorder(session, market, ctOrder())).rejects.toMatchObject({ code: 'upstream_unavailable' });
  });

  it('an empty result reads the current bag summary', async () => {
    h.getInventoryDetail.mockResolvedValue({});
    h.getCartForSession.mockResolvedValue(summary(5));
    const out = await runReorder(session, market, ctOrder());
    expect(out.result.added).toEqual([]);
    expect(out.result.cart.count).toBe(5);
  });

  it('keeps going when the stock read fails', async () => {
    h.getInventoryDetail.mockRejectedValue(new Error('down'));
    const out = await runReorder(session, market, ctOrder());
    expect(out.result.added).toHaveLength(1);
  });
});

describe('reasonFor', () => {
  it('maps the per-line refusals and rethrows the rest', () => {
    expect(reasonFor(new h.LineRejected('price_unavailable', 422))).toBe('price_missing');
    expect(reasonFor(new h.LineRejected('unknown_store', 400))).toBe('unavailable');
    expect(reasonFor(new AppError('conflict', 409))).toBeNull();
    expect(reasonFor(new Error('x'))).toBeNull();
  });
});
