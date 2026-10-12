// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { K } from './base';

/**
 * Price helpers. There is NO price floor (Q-T03): a reseller may price any part at any amount above zero, so nothing
 * here derives a minimum. All prices are standalone prices (Q-003), see `prices.ts` for the price set.
 */
export const round10 = (cents: number): number => Math.round(cents / 10) * 10;

/** USD price derived from the EUR price (placeholder rate 1.09, rounded to 10 cents). */
export const usdFromEur = (eurCents: number): number => round10(eurCents * 1.09);

/** Deterministic retail factor per reseller (share of the Malva base price). Any value above zero is legal. */
export function retailFactor(channelKey: string, index: number): number | undefined {
  if (channelKey === K.distNorth) return [0.95, 1.03, undefined, 0.85][index % 4];
  if (channelKey === K.distSouth) return [1.05, undefined, 0.92][index % 3];
  return undefined;
}

export interface RetailOverride { channelKey: string; currency: 'EUR' | 'USD'; cents: number }

/** Reseller retail prices of one item (standalone prices on the store's distribution channel). South also prices in USD. */
export function retailOverrides(channelKey: string, index: number, eurCents: number, usdCents: number): RetailOverride[] {
  const f = retailFactor(channelKey, index);
  if (f === undefined) return [];
  const out: RetailOverride[] = [{ channelKey, currency: 'EUR', cents: round10(eurCents * f) }];
  if (channelKey === K.distSouth) out.push({ channelKey, currency: 'USD', cents: round10(usdCents * f) });
  return out;
}

export const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
};
