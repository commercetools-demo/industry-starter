/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminMock, type RecordedCall } from './sdk-mock';

vi.mock('@/lib/ct/admin-client', async () => ({ adminRoot: (await import('./sdk-mock')).adminMock.adminRoot }));

import { countActiveSubscriptions, listRenewals } from './subscriptions';

const NOW = new Date('2026-10-12T08:00:00.000Z');
const ro = (id: string, nextOrderAt: string | undefined) => ({
  id,
  nextOrderAt,
  cart: { obj: { lineItems: [{ name: { 'de-DE': `Teil ${id}` } }, { name: { 'de-DE': 'Zweites' } }] } },
});

beforeEach(() => adminMock.reset());

describe('dashboard subscriptions', () => {
  it('active count and renewals within 7 days; paused excluded', async () => {
    adminMock.respond('recurringOrders', (call: RecordedCall) =>
      String(call.queryArgs.where).includes('recurringOrderState="Active"')
        ? { total: 3, results: [ro('soon', '2026-10-14T00:00:00.000Z'), ro('edge', '2026-10-19T08:00:00.000Z'), ro('later', '2026-10-30T00:00:00.000Z'), ro('none', undefined)] }
        : { total: 99, results: [] },
    );
    expect(await countActiveSubscriptions('store-a')).toBe(3);
    const rows = await listRenewals('store-a', 7, 5, NOW);
    expect(rows.map((r) => r.id)).toEqual(['soon', 'edge']);
    expect(rows[0]).toMatchObject({ name: { 'de-DE': 'Teil soon' }, itemCount: 2 });
    const [count, list] = adminMock.callsTo('recurringOrders');
    expect(count.queryArgs).toMatchObject({ limit: 1, withTotal: true, where: 'store(key="store-a") and recurringOrderState="Active"' });
    expect(list.queryArgs).toMatchObject({ expand: ['cart'], sort: 'nextOrderAt asc' });
  });

  it('limit applies and a quote in the store key cannot break out of the predicate', async () => {
    adminMock.respond('recurringOrders', { results: [ro('a', '2026-10-13T00:00:00.000Z'), ro('b', '2026-10-13T01:00:00.000Z')] });
    expect(await listRenewals('x") or (1=1', 7, 1, NOW)).toHaveLength(1);
    expect(String(adminMock.callsTo('recurringOrders')[0].queryArgs.where)).not.toContain('"x") or');
  });
});
