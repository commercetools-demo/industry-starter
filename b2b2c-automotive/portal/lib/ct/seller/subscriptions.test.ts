/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVFake, type VFake } from '@/lib/portal/v-fixture-root';
import { mapSubscription, monthlyCents, summarize, canSubscriptionTransition, type RecurringOrderInput } from '@/lib/subscriptions/model';
import { listAudit, listSubscriptions, runSubscriptionAction } from './subscriptions';
import { V_CONTAINERS, listObjects } from './v-objects';
import { setVRootForTest } from './v-root';

const NOW = new Date('2026-10-12T10:00:00Z');
const DAY = 86_400_000;

describe('monthly equivalent', () => {
  it('converts every schedule kind to a monthly value', () => {
    expect(monthlyCents({ kind: 'standard', value: 1, unit: 'Months' }, 3000)).toBe(3000);
    expect(monthlyCents({ kind: 'standard', value: 3, unit: 'Months' }, 3000)).toBe(1000);
    expect(monthlyCents({ kind: 'standard', value: 2, unit: 'Weeks' }, 1200)).toBe(Math.round((1200 * 52) / 12 / 2));
    expect(monthlyCents({ kind: 'standard', value: 10, unit: 'Days' }, 1000)).toBe(Math.round((1000 * 30.4375) / 10));
    expect(monthlyCents({ kind: 'dayOfMonth', day: 15 }, 2500)).toBe(2500);
  });
});

const input = (over: Partial<RecurringOrderInput> & { id: string }): RecurringOrderInput => ({
  recurringOrderState: 'Active',
  schedule: { type: 'standard', value: 1, intervalUnit: 'Months' },
  cart: { obj: { totalPrice: { centAmount: 2000, currencyCode: 'EUR' }, lineItems: [{ quantity: 1, name: { 'en-US': 'Oil' } }] } },
  ...over,
});

describe('paused subscription row', () => {
  it('has no next renewal; the renewals panel lists only Active rows inside 7 days', () => {
    const rows = [
      mapSubscription(input({ id: 'a', nextOrderAt: new Date(NOW.getTime() + 3 * DAY).toISOString() })),
      mapSubscription(input({ id: 'b', nextOrderAt: new Date(NOW.getTime() + 20 * DAY).toISOString() })),
      mapSubscription(input({ id: 'p', recurringOrderState: 'Paused', nextOrderAt: new Date(NOW.getTime() + 1 * DAY).toISOString() })),
      mapSubscription(input({ id: 'f', recurringOrderState: 'Failed' })),
    ];
    expect(rows[2]).toMatchObject({ status: 'Paused', nextOrderAt: null });
    expect(rows[3]).toMatchObject({ status: 'Canceled', needsAttention: true });
    const summary = summarize(rows, NOW);
    expect(summary.renewals.map((r) => r.id)).toEqual(['a']);
    expect(summary.kpis).toMatchObject({ active: 2, paused: 1, canceled: 1, monthlyCents: 4000 });
  });
});

describe('subscription transitions', () => {
  let fake: VFake;
  beforeEach(() => {
    fake = createVFake({ now: () => NOW, demo: true });
    setVRootForTest(fake.root);
  });
  afterEach(() => setVRootForTest(undefined));

  const updates = () => fake.calls.filter((c) => c.op === 'recurringOrder.update');

  it('follows the transition table', () => {
    expect(canSubscriptionTransition('Active', 'Paused')).toBe(true);
    expect(canSubscriptionTransition('Paused', 'Active')).toBe(true);
    expect(canSubscriptionTransition('Active', 'Canceled')).toBe(true);
    expect(canSubscriptionTransition('Paused', 'Canceled')).toBe(true);
    expect(canSubscriptionTransition('Canceled', 'Active')).toBe(false);
    expect(canSubscriptionTransition('Expired', 'Active')).toBe(false);
  });

  it('pause, resume and cancel send setRecurringOrderState and write one audit record each', async () => {
    const id = 'fx-rec-fx-store-online-1';
    expect(await runSubscriptionAction('fx-store-online', id, 'pause', 'actor-1', NOW)).toEqual({ status: 'Paused' });
    expect(updates()[0].args).toMatchObject({ actions: [{ action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } }] });
    expect((await listSubscriptions('fx-store-online')).rows.find((r) => r.id === id)).toMatchObject({ status: 'Paused', nextOrderAt: null });
    await runSubscriptionAction('fx-store-online', id, 'resume', 'actor-1', NOW);
    await runSubscriptionAction('fx-store-online', id, 'cancel', 'actor-1', NOW);
    const audit = await listObjects(V_CONTAINERS.audit);
    expect(audit.map((o) => o.key).sort()).toEqual([`fx-store-online--${id}--1`, `fx-store-online--${id}--2`, `fx-store-online--${id}--3`]);
    expect((await listAudit('fx-store-online', id)).map((a) => `${a.from}>${a.to}`).sort()).toEqual(['Active>Canceled', 'Active>Paused', 'Paused>Active']);
    await expect(runSubscriptionAction('fx-store-online', id, 'resume', 'actor-1', NOW)).rejects.toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });
  });

  it('skip sends setOrderSkipConfiguration with a counter of 1; a paused one is refused with NOT_ACTIVE and nothing is sent', async () => {
    await runSubscriptionAction('fx-store-online', 'fx-rec-fx-store-online-2', 'skip', 'actor-1', NOW);
    expect(updates()[0].args).toMatchObject({ actions: [{ action: 'setOrderSkipConfiguration', skipConfigurationInputDraft: { type: 'Counter', totalToSkip: 1 } }] });
    expect((await listSubscriptions('fx-store-online')).rows.find((r) => r.id === 'fx-rec-fx-store-online-2')?.skipsRemaining).toBe(1);
    await expect(runSubscriptionAction('fx-store-online', 'fx-rec-fx-store-online-2', 'skip', 'a', NOW)).rejects.toMatchObject({ code: 'SKIP_PENDING' });
    const before = updates().length;
    await expect(runSubscriptionAction('fx-store-online', 'fx-rec-fx-store-online-3', 'skip', 'a', NOW)).rejects.toMatchObject({ status: 409, code: 'NOT_ACTIVE' });
    expect(updates()).toHaveLength(before);
  });

  it("another store's id is 404 and no update is sent", async () => {
    await expect(runSubscriptionAction('fx-store-south', 'fx-rec-fx-store-online-1', 'cancel', 'a', NOW)).rejects.toMatchObject({ status: 404 });
    expect(updates()).toHaveLength(0);
    expect(await listObjects(V_CONTAINERS.audit)).toHaveLength(0);
    await expect(listAudit('fx-store-south', 'fx-rec-fx-store-online-1')).rejects.toMatchObject({ status: 404 });
  });

  it('retries a version conflict once with a fresh version', async () => {
    const id = 'fx-rec-fx-store-online-1';
    const row = fake.db.recurring.find((r) => r.id === id) as { version: number };
    let first = true;
    const original = (fake.root as { recurringOrders: () => { withId: (a: { ID: string }) => { post: (b: unknown) => unknown } } }).recurringOrders;
    (fake.root as { recurringOrders: unknown }).recurringOrders = () => {
      const api = original();
      return {
        ...api,
        get: (api as unknown as { get: (a: unknown) => unknown }).get,
        withId: (a: { ID: string }) => ({
          post: (b: { body: { version: number } }) => {
            if (first) {
              first = false;
              row.version += 1; // somebody else changed it between the read and the write
            }
            return api.withId(a).post(b);
          },
        }),
      };
    };
    await runSubscriptionAction('fx-store-online', id, 'pause', 'a', NOW);
    expect(row.version).toBe(3);
    expect(fake.db.recurring.find((r) => r.id === id)?.recurringOrderState).toBe('Paused');
  });
});
