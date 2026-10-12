// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import type { Branch } from '@/lib/types';
import { getBranchScope, selectPrice, type ScopedPrice } from './branch-scope';

const branch = (key: string, channelId: string): Branch => ({
  key,
  channelId,
  name: key,
  address: { street: '', postalCode: '', city: '' },
  hours: {},
  timezone: 'Europe/Berlin',
  pickupMode: 'same-day',
});
const branches = [branch('mau-br-b', 'ch-b'), branch('mau-br-a', 'ch-a')];
const RETAIL = 'ch-retail';

describe('Choose a store from list or map: branch scope', () => {
  it('no branchKey resolves to the first branch by key', () => {
    expect(getBranchScope({}, branches, RETAIL)).toEqual({ branchKey: 'mau-br-a', branchChannelId: 'ch-a', retailChannelId: RETAIL });
  });
  it('unknown branchKey resolves to the first branch', () => {
    expect(getBranchScope({ branchKey: 'nope' }, branches, RETAIL).branchKey).toBe('mau-br-a');
  });
  it('supply channel is the branch', () => {
    expect(getBranchScope({ branchKey: 'mau-br-b' }, branches, RETAIL)).toEqual({ branchKey: 'mau-br-b', branchChannelId: 'ch-b', retailChannelId: RETAIL });
  });
  it('a store without branches has no branch channel', () => {
    expect(getBranchScope({}, [], RETAIL)).toEqual({ branchKey: undefined, branchChannelId: undefined, retailChannelId: RETAIL });
  });
});

const scope = { branchKey: 'mau-br-a', branchChannelId: 'ch-a', retailChannelId: RETAIL };
const p = (amount: number, channelId?: string, over: Partial<ScopedPrice> = {}): ScopedPrice => ({ centAmount: amount, currencyCode: 'EUR', country: 'DE', channelId, ...over });

describe('Choose a store from list or map: price selection', () => {
  it('selects branch price before retail price before base price', () => {
    const prices = [p(1000), p(900, RETAIL), p(800, 'ch-a')];
    expect(selectPrice(prices, scope, 'EUR', 'DE')?.centAmount).toBe(800);
    expect(selectPrice(prices.slice(0, 2), scope, 'EUR', 'DE')?.centAmount).toBe(900);
  });
  it('falls back to base when no channel price exists', () => {
    expect(selectPrice([p(1000), p(700, 'ch-other')], scope, 'EUR', 'DE')?.centAmount).toBe(1000);
  });
  it('reseller-owned item without base price uses the retail price', () => {
    expect(selectPrice([p(900, RETAIL)], scope, 'EUR', 'DE')?.centAmount).toBe(900);
  });
  it('ignores prices of another currency or country', () => {
    const prices = [p(800, 'ch-a', { currencyCode: 'USD', country: 'US' }), p(1000)];
    expect(selectPrice(prices, scope, 'EUR', 'DE')?.centAmount).toBe(1000);
    expect(selectPrice([p(800, 'ch-a', { country: 'US' })], scope, 'EUR', 'DE')).toBeUndefined();
  });
  it('a price without a country applies to any country', () => {
    expect(selectPrice([p(1000, undefined, { country: undefined })], scope, 'EUR', 'DE')?.centAmount).toBe(1000);
  });
  it('no price is none, never zero', () => {
    expect(selectPrice([], scope, 'EUR', 'DE')).toBeUndefined();
  });
});
