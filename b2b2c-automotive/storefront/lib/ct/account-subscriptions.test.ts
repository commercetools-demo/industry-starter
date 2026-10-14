// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), policies: vi.fn() }));
vi.mock('@/lib/ct/client', () => ({
  apiRoot: {
    recurringOrders: () => ({
      get: (arg: unknown) => ({ execute: async () => ({ body: await h.list(arg) }) }),
      withId: () => ({ post: (arg: unknown) => ({ execute: async () => ({ body: await h.update(arg) }) }) }),
    }),
    recurrencePolicies: () => ({ get: () => ({ execute: async () => ({ body: await h.policies() }) }) }),
  },
}));

import { cancelAllSubscriptions, listSubscriptions, runSubscriptionAction, subscriptionsOffered } from './account-subscriptions';

const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const RO = '22222222-2222-4222-8222-222222222222';
const policy = (id: string, key: string, value: number) => ({ id, key, name: { 'en-US': `Every ${value}` }, schedule: { type: 'standard', value, intervalUnit: 'Months' } });
const order = (over: Record<string, unknown> = {}) => ({
  id: RO,
  version: 5,
  recurringOrderState: 'Active',
  nextOrderAt: '2026-11-01T00:00:00Z',
  schedule: { type: 'standard', value: 3, intervalUnit: 'Months' },
  originOrder: { typeId: 'order', id: 'o', obj: { orderNumber: 'MA-1', lineItems: [{ name: { 'en-US': 'Filter' }, quantity: 1, recurrenceInfo: { recurrencePolicy: { id: 'p3' } }, variant: {} }] } },
  ...over,
});
const sent = () => h.update.mock.calls.at(-1)?.[0] as { queryArgs?: unknown; body: { version: number; actions: Array<Record<string, unknown>> } };
const ctError = (statusCode: number, code: string) => Object.assign(new Error('x'), { statusCode, body: { errors: [{ code }] } });

beforeEach(() => {
  h.list.mockReset().mockResolvedValue({ results: [order()] });
  h.update.mockReset().mockResolvedValue(order());
  h.policies.mockReset().mockResolvedValue({ results: [policy('p1', 'mau-rp-monthly', 1), policy('p3', 'mau-rp-quarterly', 3), policy('x', 'other', 9)] });
  delete process.env.SUBSCRIPTIONS_PURCHASE_ENABLED;
});

describe('subscriptions', () => {
  it('list is scoped by customer and store, with the origin order expanded', async () => {
    const list = await listSubscriptions('mau-reseller-north', CUSTOMER, 'en-US');
    const args = h.list.mock.calls[0][0] as { queryArgs: { where: string; expand: string[] } };
    expect(args.queryArgs.where).toBe(`customer(id="${CUSTOMER}") and store(key="mau-reseller-north")`);
    expect(args.queryArgs.expand).toEqual(['originOrder']);
    expect(list[0]).toMatchObject({ id: RO, frequency: 'Every 3', lines: [{ name: 'Filter', quantity: 1 }] });
  });
  it('a malformed customer id or store key never reaches a predicate', async () => {
    await expect(listSubscriptions('mau-reseller-north', 'x" or 1=1', 'en-US')).rejects.toMatchObject({ status: 404 });
    await expect(listSubscriptions('bad key"', CUSTOMER, 'en-US')).rejects.toMatchObject({ status: 404 });
    expect(h.list).not.toHaveBeenCalled();
  });
  it('other customer subscription gives 404', async () => {
    h.list.mockResolvedValue({ results: [] });
    await expect(runSubscriptionAction('s1', CUSTOMER, RO, { action: 'pause' }, 'en-US')).rejects.toMatchObject({ status: 404 });
    expect(h.update).not.toHaveBeenCalled();
    const where = (h.list.mock.calls[0][0] as { queryArgs: { where: string } }).queryArgs.where;
    expect(where).toContain(`id="${RO}"`);
    expect(where).toContain(`customer(id="${CUSTOMER}")`);
  });
  it('skip sends counter skip of 1', async () => {
    await runSubscriptionAction('s1', CUSTOMER, RO, { action: 'skip' }, 'en-US');
    expect(sent().body).toEqual({ version: 5, actions: [{ action: 'setOrderSkipConfiguration', skipConfigurationInputDraft: { type: 'Counter', totalToSkip: 1 } }] });
  });
  it('skip moves displayed next date to the value returned by the API', async () => {
    h.update.mockResolvedValue(order({ nextOrderAt: '2027-02-01T00:00:00Z', skipConfiguration: { type: 'Counter', totalToSkip: 1, skipped: 0 } }));
    const view = await runSubscriptionAction('s1', CUSTOMER, RO, { action: 'skip' }, 'en-US');
    expect(view.nextOrderAt).toBe('2027-02-01T00:00:00Z');
    expect(view.skipPending).toBe(1);
  });
  it('a second skip while one is pending is refused', async () => {
    h.list.mockResolvedValue({ results: [order({ skipConfiguration: { type: 'Counter', totalToSkip: 1, skipped: 0 } })] });
    await expect(runSubscriptionAction('s1', CUSTOMER, RO, { action: 'skip' }, 'en-US')).rejects.toMatchObject({ code: 'skip-pending', status: 409 });
  });
  it('pause resume cancel send state actions', async () => {
    await runSubscriptionAction('s1', CUSTOMER, RO, { action: 'pause' }, 'en-US');
    expect(sent().body.actions).toEqual([{ action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } }]);
    h.list.mockResolvedValue({ results: [order({ recurringOrderState: 'Paused' })] });
    await runSubscriptionAction('s1', CUSTOMER, RO, { action: 'resume' }, 'en-US');
    expect(sent().body.actions).toEqual([{ action: 'setRecurringOrderState', recurringOrderState: { type: 'active' } }]);
    await runSubscriptionAction('s1', CUSTOMER, RO, { action: 'cancel' }, 'en-US');
    expect(sent().body.actions).toEqual([{ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled' } }]);
  });
  it('a cancelled subscription cannot be paused', async () => {
    h.list.mockResolvedValue({ results: [order({ recurringOrderState: 'Canceled' })] });
    await expect(runSubscriptionAction('s1', CUSTOMER, RO, { action: 'pause' }, 'en-US')).rejects.toMatchObject({ code: 'not-active' });
  });
  it('change frequency sends the confirmed action with the policy', async () => {
    await runSubscriptionAction('s1', CUSTOMER, RO, { action: 'change-frequency', policyKey: 'mau-rp-monthly' }, 'en-US');
    expect(sent().body.actions).toEqual([{ action: 'setSchedule', recurrencePolicy: { typeId: 'recurrence-policy', key: 'mau-rp-monthly' } }]);
  });
  it('change frequency refuses an unknown policy key', async () => {
    await expect(runSubscriptionAction('s1', CUSTOMER, RO, { action: 'change-frequency', policyKey: 'other' }, 'en-US')).rejects.toMatchObject({ code: 'unknown-policy' });
    await expect(runSubscriptionAction('s1', CUSTOMER, RO, { action: 'change-frequency' }, 'en-US')).rejects.toMatchObject({ code: 'unknown-policy' });
    expect(h.update).not.toHaveBeenCalled();
  });
  it('failed order shows failed status and can be resumed', async () => {
    h.list.mockResolvedValue({ results: [order({ recurringOrderState: 'Failed' })] });
    const [view] = await listSubscriptions('s1', CUSTOMER, 'en-US');
    expect(view.status).toBe('failed');
    await runSubscriptionAction('s1', CUSTOMER, RO, { action: 'resume' }, 'en-US');
    expect(sent().body.actions).toEqual([{ action: 'setRecurringOrderState', recurringOrderState: { type: 'active' } }]);
  });
  it('an update while the order is processing is a busy 409', async () => {
    h.update.mockRejectedValue(ctError(400, 'InvalidOperation'));
    await expect(runSubscriptionAction('s1', CUSTOMER, RO, { action: 'pause' }, 'en-US')).rejects.toMatchObject({ code: 'busy', status: 409 });
  });
  it('offered is true when purchasable and false when disabled with no orders', async () => {
    await expect(subscriptionsOffered('s1', CUSTOMER)).resolves.toBe(true);
    process.env.SUBSCRIPTIONS_PURCHASE_ENABLED = 'false';
    h.list.mockResolvedValue({ results: [] });
    await expect(subscriptionsOffered('s1', CUSTOMER)).resolves.toBe(false);
    h.list.mockResolvedValue({ results: [order()] });
    await expect(subscriptionsOffered('s1', CUSTOMER)).resolves.toBe(true);
  });
  it('cancel all cancels each live order and skips ended ones', async () => {
    h.list.mockResolvedValue({ results: [order(), order({ id: 'z', recurringOrderState: 'Canceled' })] });
    await cancelAllSubscriptions('s1', CUSTOMER);
    expect(h.update).toHaveBeenCalledTimes(1);
  });
});
