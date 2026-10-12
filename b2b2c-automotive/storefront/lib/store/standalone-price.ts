// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Pure standalone price selection (workstream L, D4): no server-only, importable by mappers and tests. `lib/ct/prices.ts`
// re-exports it next to the read. It delegates the channel order to `selectPrice` of `branch-scope.ts`, so there is ONE
// implementation: branch channel, store retail channel, channel-less Malva base price.
import type { PriceCandidate, SelectedPrice } from '@/lib/types';
import { selectPrice } from './branch-scope';

type ChannelId = string | undefined;

export interface SelectOptions {
  currency: string;
  country: string;
  /** Branch channel first, store retail channel second; either may be missing (a store without branches). */
  channelIds: readonly [branchChannelId: ChannelId, retailChannelId: ChannelId];
  now?: Date;
}

const inWindow = (p: PriceCandidate, now: number): boolean =>
  (p.validFrom === undefined || Date.parse(p.validFrom) <= now) && (p.validUntil === undefined || Date.parse(p.validUntil) > now);

/**
 * Branch channel price, else store retail channel price, else the channel-less base price; inside one channel a price of the
 * shopper's country beats one without a country, and one with a validity window beats one without. Expired, future and zero
 * prices do not exist for the shopper. `null` means "Price unavailable" (never zero).
 */
export function selectStandalonePrice(prices: readonly PriceCandidate[], options: SelectOptions): SelectedPrice | null {
  const now = (options.now ?? new Date()).getTime();
  const rank = (p: PriceCandidate) => (p.country === options.country ? 0 : 2) + (p.validFrom !== undefined || p.validUntil !== undefined ? 0 : 1);
  const live = prices.filter((p) => p.centAmount > 0 && inWindow(p, now)).sort((a, b) => rank(a) - rank(b));
  const [branchChannelId, retailChannelId] = options.channelIds;
  const chosen = selectPrice(live, { branchKey: undefined, branchChannelId, retailChannelId }, options.currency, options.country);
  if (!chosen) return null;
  const value = { centAmount: chosen.centAmount, currencyCode: chosen.currencyCode, fractionDigits: chosen.fractionDigits };
  const discounted = chosen.discounted && chosen.discounted.centAmount > 0 ? chosen.discounted : undefined;
  return { value, discounted, channelId: chosen.channelId };
}
