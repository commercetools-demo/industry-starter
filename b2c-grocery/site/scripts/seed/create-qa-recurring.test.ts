import { describe, it, expect, vi } from 'vitest';
import { QA_RECURRING_SKU, createQaRecurring, parsePolicy, qaRecurringCartDraft, waitForRecurringOrders } from './create-qa-recurring';
import { QA_SKUS } from './create-qa-order';
import type { Root } from './lib';

describe('create-qa-recurring', () => {
  it('policy defaults to every-2-weeks and rejects unknown keys', () => {
    expect(parsePolicy([])).toBe('every-2-weeks');
    expect(parsePolicy(['--policy', 'monthly'])).toBe('monthly');
    expect(() => parsePolicy(['--policy', 'daily'])).toThrow();
  });

  it('only the milk line carries Dynamic recurrence info', () => {
    expect(QA_SKUS).toContain(QA_RECURRING_SKU);
    const cart = qaRecurringCartDraft('c1', 'qa-x@example.com', 'weekly');
    const lines = cart.lineItems ?? [];
    expect(lines.find((l) => l.sku === QA_RECURRING_SKU)?.recurrenceInfo).toEqual({ recurrencePolicy: { typeId: 'recurrence-policy', key: 'weekly' }, priceSelectionMode: 'Dynamic' });
    expect(lines.filter((l) => l.recurrenceInfo)).toHaveLength(1);
  });

  it('waits until a Recurring Order with the order as origin shows up', async () => {
    const execute = vi.fn().mockResolvedValueOnce({ body: { results: [] } }).mockResolvedValueOnce({ body: { results: [{ id: 'ro-1' }] } });
    const get = vi.fn((args: { queryArgs: { where: string } }) => (void args, { execute }));
    const root = { recurringOrders: () => ({ get }) } as unknown as Root;
    expect(await waitForRecurringOrders(root, 'o-1', 5, 0)).toEqual([{ id: 'ro-1' }]);
    expect(get.mock.calls[0][0].queryArgs.where).toBe('originOrder(id="o-1")');
  });

  it('creates customer, cart, order and reads the recurring orders', async () => {
    const answer = (body: unknown) => ({ execute: async () => ({ body }) });
    const root = {
      customers: () => ({ post: () => answer({ customer: { id: 'cu-1' } }) }),
      carts: () => ({ post: () => answer({ id: 'ca-1', version: 3 }) }),
      orders: () => ({ post: () => answer({ id: 'o-1', orderNumber: 'QA-1' }) }),
      recurringOrders: () => ({ get: () => answer({ results: [{ id: 'ro-1' }] }) }),
    } as unknown as Root;
    const r = await createQaRecurring(root, 'weekly');
    expect(r.customerId).toBe('cu-1');
    expect(r.recurringOrders).toEqual([{ id: 'ro-1' }]);
  });
});
