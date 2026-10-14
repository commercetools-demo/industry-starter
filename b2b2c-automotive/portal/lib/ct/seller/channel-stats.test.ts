// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const orderGets: { limit: number; offset: number; where: string; from: string }[] = [];
let allOrders: unknown[] = [];
vi.mock('@/lib/ct/admin-client', () => ({
  adminRoot: {
    inStoreKeyWithStoreKeyValue: ({ storeKey }: { storeKey: string }) => {
      void storeKey;
      return {
        orders: () => ({
          get: ({ queryArgs }: { queryArgs: { limit: number; offset: number; where: string; 'var.from': string } }) => ({
            execute: async () => {
              orderGets.push({ limit: queryArgs.limit, offset: queryArgs.offset, where: queryArgs.where, from: queryArgs['var.from'] });
              return { body: { results: allOrders.slice(queryArgs.offset, queryArgs.offset + queryArgs.limit) } };
            },
          }),
        }),
      };
    },
  },
}));

import { aggregate, loadChannelStats, seededNumber, shares } from './channel-stats';
import { pageOrders } from './order-pager';

const order = (cents: number, channel?: string, isTest = false, currency = 'EUR') => ({ totalPrice: { centAmount: cents, currencyCode: currency }, custom: channel !== undefined || isTest ? { fields: { ...(channel ? { salesChannel: channel } : {}), ...(isTest ? { isTest: true } : {}) } } : undefined });

beforeEach(() => {
  orderGets.length = 0;
  allOrders = [];
});

describe('channel stats', () => {
  it('groups by salesChannel (including in-store; isTest orders excluded); missing counts as web indicative', async () => {
    allOrders = [order(10000, 'web'), order(5000), order(20000, 'instagram'), order(30000, 'in-store'), order(99999, 'instagram', true), order(1000, 'facebook')];
    const stats = await loadChannelStats('mau-reseller-north', 30, new Date('2026-10-12T00:00:00Z'));
    const row = (id: string) => stats.rows.find((r) => r.id === id)!;
    expect(row('web')).toMatchObject({ orders: 2, indicative: true });
    expect(row('web').revenue).toEqual({ centAmount: 15000, currencyCode: 'EUR', fractionDigits: 2 });
    expect(row('instagram')).toMatchObject({ orders: 1, indicative: false });
    expect(row('instagram').revenue.centAmount).toBe(20000);
    expect(row('in-store')).toMatchObject({ orders: 1, status: 'Live' });
    expect(row('whatsapp').orders).toBe(0);
    expect(orderGets[0].where).toBe('createdAt >= :from and orderState != "Cancelled"');
    expect(orderGets[0].from).toBe('2026-09-12T00:00:00.000Z');
  });

  it('web is not indicative when every order carries the field', () => {
    const stats = aggregate('s', [{ channel: 'web', isTest: false, cents: 100, currency: 'EUR' }], false, 30);
    expect(stats.rows.find((r) => r.id === 'web')?.indicative).toBe(false);
  });

  it('tiktok is Demo with deterministic figures that are not part of the real shares', () => {
    const a = aggregate('mau-reseller-north', [{ channel: 'web', isTest: false, cents: 1000, currency: 'EUR' }], false, 30);
    const b = aggregate('mau-reseller-north', [], false, 30);
    const tiktokA = a.rows.find((r) => r.id === 'tiktok')!;
    const tiktokB = b.rows.find((r) => r.id === 'tiktok')!;
    expect(tiktokA).toEqual(tiktokB);
    expect(tiktokA).toMatchObject({ status: 'Demo', sharePercent: 0, indicative: true });
    expect(tiktokA.orders).toBeGreaterThanOrEqual(3);
    expect(aggregate('mau-reseller-south', [], false, 30).rows.find((r) => r.id === 'tiktok')).not.toEqual(tiktokA);
    expect(a.rows.find((r) => r.id === 'web')?.sharePercent).toBe(100);
  });

  it('shares sum to 100 over live channels', () => {
    const stats = aggregate('s', [
      { channel: 'web', isTest: false, cents: 3333, currency: 'EUR' },
      { channel: 'instagram', isTest: false, cents: 3333, currency: 'EUR' },
      { channel: 'facebook', isTest: false, cents: 3334, currency: 'EUR' },
    ], false, 30);
    const live = stats.rows.filter((r) => r.status === 'Live');
    expect(live.reduce((n, r) => n + r.sharePercent, 0)).toBe(100);
    expect(shares([0, 0])).toEqual([0, 0]);
    expect(shares([1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('pages up to 5 and flags truncated', async () => {
    allOrders = Array.from({ length: 2600 }, () => order(100, 'web'));
    const stats = await loadChannelStats('mau-reseller-north');
    expect(orderGets).toHaveLength(5);
    expect(orderGets.map((g) => g.offset)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(stats.truncated).toBe(true);
    expect(stats.rows.find((r) => r.id === 'web')?.orders).toBe(2500);
  });

  it('fewer orders than a page: one call, not truncated', async () => {
    allOrders = [order(100, 'web')];
    const stats = await loadChannelStats('mau-reseller-north');
    expect(orderGets).toHaveLength(1);
    expect(stats.truncated).toBe(false);
  });

  it('pageOrders stops at a short page', async () => {
    allOrders = Array.from({ length: 7 }, () => order(1));
    const pages: number[] = [];
    for await (const page of pageOrders('s', new Date(), 5, 5)) pages.push(page.length);
    expect(pages).toEqual([5, 2]);
  });

  it('seededNumber is stable', () => {
    expect(seededNumber('abc')).toBe(seededNumber('abc'));
    expect(seededNumber('abc')).not.toBe(seededNumber('abd'));
  });
});
