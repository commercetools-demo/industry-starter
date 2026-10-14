/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { serializeSchedules } from '../../lib/pricing/schedule';
import { SCHEDULE } from '../../test/fixtures/cart';

const recurringGet = vi.fn();
const ordersGet = vi.fn();
const writes = vi.fn();
vi.mock('@/lib/ct/client', () => ({
  getApiRoot: () => ({
    recurringOrders: () => ({ get: (args: unknown) => ({ execute: () => recurringGet(args) }), post: writes }),
    orders: () => ({ get: (args: unknown) => ({ execute: () => ordersGet(args) }), post: writes }),
  }),
}));

import { runReconcile } from './recurring-reconcile';

const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD' });
const generated = (orderNumber: string, total: number) => ({ id: orderNumber, orderNumber, createdAt: '2026-11-07T00:00:00Z', lineItems: [{ variant: { sku: 'MLV-CBL-500-24M' }, quantity: 1, totalPrice: money(total) }] });
const recurring = (id: string, priceSchedule: unknown) => ({ id, originOrder: { obj: { orderNumber: `FIRST-${id}`, custom: { fields: { priceSchedule } } } } });

beforeEach(() => {
  recurringGet.mockReset();
  ordersGet.mockReset();
  writes.mockReset();
});

describe('recurring reconcile job', () => {
  it('lists the generated orders that do not charge the standing amount, and writes nothing', async () => {
    recurringGet.mockResolvedValue({ body: { results: [recurring('r1', serializeSchedules([SCHEDULE]))] } });
    ordersGet.mockResolvedValue({ body: { results: [generated('MLV-2', 5999), generated('MLV-3', 0)] } });
    const lines: string[] = [];
    expect(await runReconcile((line) => lines.push(line))).toBe(1);
    expect(lines).toEqual([expect.stringContaining('mismatch order=MLV-3 sku=MLV-CBL-500-24M expected=59.99 USD actual=0.00 USD'), 'generated orders checked: 2, mismatches: 1', '0 writes']);
    expect(writes).not.toHaveBeenCalled();
    expect(recurringGet.mock.calls[0]?.[0]).toMatchObject({ queryArgs: { where: 'recurringOrderState(type="Active")', expand: ['originOrder'] } });
    expect(ordersGet.mock.calls[0]?.[0]).toMatchObject({ queryArgs: { where: 'recurringOrder(id="r1")' } });
  });

  it('exits clean when everything reconciles; skips a recurring order with no or unreadable schedule', async () => {
    recurringGet.mockResolvedValue({ body: { results: [recurring('r1', serializeSchedules([SCHEDULE])), recurring('r2', undefined), recurring('r3', 'not json')] } });
    ordersGet.mockResolvedValue({ body: { results: [generated('MLV-2', 5999)] } });
    const lines: string[] = [];
    expect(await runReconcile((line) => lines.push(line))).toBe(0);
    expect(lines).toContain('generated orders checked: 1, mismatches: 0');
    expect(lines.some((line) => line.startsWith('warning: FIRST-r3'))).toBe(true);
  });
});
