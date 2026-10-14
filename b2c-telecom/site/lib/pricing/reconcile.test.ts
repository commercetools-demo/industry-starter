/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { Money, PriceSchedule } from '@/lib/types';
import { SCHEDULE } from '@/test/fixtures/cart';
import { findMismatches, standingAmountOf, type GeneratedOrder } from './reconcile';

const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });
const first = (patch: Partial<PriceSchedule> = {}): PriceSchedule => ({ ...SCHEDULE, ...patch });
const order = (orderNumber: string, total: number, quantity = 1): GeneratedOrder => ({ orderNumber, createdAt: '2026-11-07T00:00:00Z', lines: [{ sku: 'MLV-CBL-500-24M', quantity, total: usd(total) }] });

describe('recurring order reconciliation', () => {
  it('reads the standing amount, not the promotional first period', () => {
    const withPromo = first({ periods: [{ index: 1, fromMonth: 1, toMonth: 1, months: 1, startsOn: '2026-10-07', endsOn: '2026-11-06', monthlyAmount: usd(0), kind: 'intro' }, { index: 2, fromMonth: 2, toMonth: 24, months: 23, startsOn: '2026-11-07', endsOn: '2028-10-06', monthlyAmount: usd(5999), kind: 'standing' }] });
    expect(standingAmountOf([withPromo], 'MLV-CBL-500-24M')).toEqual(usd(5999));
  });

  it('a generated order that charges the standing amount reconciles', () => {
    expect(findMismatches([first()], [order('MLV-2', 5999), order('MLV-3', 5999)])).toEqual([]);
  });

  it('reports the order and the difference when a promotion reached a recurring order or the price moved', () => {
    expect(findMismatches([first()], [order('MLV-2', 5999), order('MLV-3', 0), order('MLV-4', 6499)])).toEqual([
      { orderNumber: 'MLV-3', sku: 'MLV-CBL-500-24M', expected: usd(5999), actual: usd(0), difference: -5999 },
      { orderNumber: 'MLV-4', sku: 'MLV-CBL-500-24M', expected: usd(5999), actual: usd(6499), difference: 500 },
    ]);
  });

  it('multiplies by the quantity and ignores lines with no schedule entry and cancelled schedules', () => {
    expect(findMismatches([first()], [order('MLV-2', 5999 * 2, 2)])).toEqual([]);
    expect(findMismatches([first()], [{ orderNumber: 'MLV-5', createdAt: '', lines: [{ sku: 'MLV-ADD-APPLETV-MTH', quantity: 1, total: usd(1) }] }])).toEqual([]);
    expect(findMismatches([first({ status: 'cancelled' })], [order('MLV-6', 0)])).toEqual([]);
  });
});
