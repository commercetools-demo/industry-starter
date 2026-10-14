// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTestOrders, parseArgs } from '../dev-delete-test-orders.mjs';

const calls = [];
const state = { orders: [], recurring: [], payments: {}, failOrderDelete: false, failPaymentGet: false };
const track = (name, args) => calls.push([name, args]);
const api = {
  orders: () => ({
    get: (args) => ({ execute: async () => (track('orders.query', args), { body: { results: state.orders } }) }),
    withId: ({ ID }) => ({
      delete: (args) => ({
        execute: async () => {
          track('orders.delete', { ID, ...args });
          if (state.failOrderDelete) throw { statusCode: 409 };
          return { body: {} };
        },
      }),
    }),
  }),
  recurringOrders: () => ({
    get: (args) => ({ execute: async () => (track('ro.query', args), { body: { results: state.recurring } }) }),
    withId: ({ ID }) => ({ post: (args) => ({ execute: async () => (track('ro.cancel', { ID, ...args }), { body: {} }) }) }),
  }),
  payments: () => ({
    withId: ({ ID }) => ({
      get: () => ({
        execute: async () => {
          if (state.failPaymentGet) throw { statusCode: 403 };
          return { body: { id: ID, version: state.payments[ID] ?? 1 } };
        },
      }),
      delete: (args) => ({ execute: async () => (track('payments.delete', { ID, ...args }), { body: {} }) }),
    }),
  }),
};
const order = (id, extra = {}) => ({ id, version: 3, custom: { fields: { isTest: true } }, paymentInfo: { payments: [{ id: `pay-${id}` }] }, ...extra });
const names = () => calls.map(([n]) => n);

beforeEach(() => {
  calls.length = 0;
  Object.assign(state, { orders: [], recurring: [], payments: {}, failOrderDelete: false, failPaymentGet: false });
});

describe('cleanupTestOrders', () => {
  it('queries only orders flagged isTest', async () => {
    await cleanupTestOrders(api);
    expect(calls[0][1].queryArgs.where).toBe('custom(fields(isTest=true))');
  });
  it('--before adds a date bound', async () => {
    await cleanupTestOrders(api, { before: new Date('2026-10-13T00:00:00Z') });
    expect(calls[0][1].queryArgs.where).toBe('custom(fields(isTest=true)) and createdAt < "2026-10-13T00:00:00.000Z"');
  });
  it('skips orders without isTest', async () => {
    state.orders = [order('o-1', { custom: undefined }), order('o-2', { custom: { fields: { isTest: false } } })];
    const summary = await cleanupTestOrders(api);
    expect(summary).toMatchObject({ found: 2, skipped: 2, deletedOrders: 0 });
    expect(names()).toEqual(['orders.query']);
  });
  it('refuses a payment of a non test order', async () => {
    state.orders = [order('o-1', { custom: { fields: {} } })];
    await cleanupTestOrders(api);
    expect(names()).not.toContain('payments.delete');
  });
  it('deletes the payments of a test order after the order', async () => {
    state.orders = [order('o-1')];
    state.payments = { 'pay-o-1': 7 };
    const summary = await cleanupTestOrders(api);
    expect(summary).toMatchObject({ deletedOrders: 1, deletedPayments: 1, failures: [] });
    expect(names().indexOf('orders.delete')).toBeLessThan(names().indexOf('payments.delete'));
    expect(calls.find(([n]) => n === 'orders.delete')[1]).toMatchObject({ ID: 'o-1', queryArgs: { version: 3 } });
    expect(calls.find(([n]) => n === 'payments.delete')[1]).toMatchObject({ ID: 'pay-o-1', queryArgs: { version: 7 } });
  });
  it('cancels the recurring order of a test order before deleting it', async () => {
    state.orders = [order('o-1')];
    state.recurring = [{ id: 'ro-1', version: 2, recurringOrderState: 'Active' }];
    const summary = await cleanupTestOrders(api);
    expect(summary.cancelledRecurringOrders).toBe(1);
    expect(names().indexOf('ro.cancel')).toBeLessThan(names().indexOf('orders.delete'));
    expect(calls.find(([n]) => n === 'ro.query')[1].queryArgs.where).toBe('originOrder(id="o-1")');
    expect(calls.find(([n]) => n === 'ro.cancel')[1].body.actions[0]).toMatchObject({ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled' } });
  });
  it('an already cancelled recurring order is left alone', async () => {
    state.orders = [order('o-1')];
    state.recurring = [{ id: 'ro-1', version: 2, recurringOrderState: 'Canceled' }];
    await cleanupTestOrders(api);
    expect(names()).not.toContain('ro.cancel');
  });
  it('dry run changes nothing', async () => {
    state.orders = [order('o-1')];
    const log = vi.fn();
    const summary = await cleanupTestOrders(api, { dryRun: true, log });
    expect(names()).toEqual(['orders.query']);
    expect(summary.deletedOrders).toBe(0);
    expect(log).toHaveBeenCalledWith('would delete order o-1 and 1 payment(s)');
  });
  it('a failed order delete is reported by id and status, and its payments stay', async () => {
    state.orders = [order('o-1')];
    state.failOrderDelete = true;
    const summary = await cleanupTestOrders(api);
    expect(summary.failures).toEqual([{ id: 'o-1', step: 'order', status: 409 }]);
    expect(names()).not.toContain('payments.delete');
  });
  it('a missing payments scope is reported, not hidden', async () => {
    state.orders = [order('o-1')];
    state.failPaymentGet = true;
    const summary = await cleanupTestOrders(api);
    expect(summary).toMatchObject({ deletedOrders: 1, deletedPayments: 0, failures: [{ id: 'pay-o-1', step: 'payment', status: 403 }] });
  });
});

describe('parseArgs', () => {
  it('reads --before and --dry-run', () => {
    expect(parseArgs(['--dry-run', '--before', '2026-10-13'])).toMatchObject({ dryRun: true, before: new Date('2026-10-13') });
  });
  it('rejects unknown arguments and bad dates', () => {
    expect(() => parseArgs(['--all'])).toThrow(/Unknown argument/);
    expect(() => parseArgs(['--before', 'yesterday'])).toThrow(/valid date/);
  });
});
