// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The single place that resolves the branch channel (supply channel and first price channel) and the price order.
// Pure: no server-only, safe for server reads of price, stock and cart channel (workstreams L, M, N, O). Nobody reads
// `supplyChannelId` or `distributionChannelId` from the session any more.
import type { Branch, Session } from '@/lib/types';

export interface BranchScope {
  branchKey: string | undefined;
  /** Supply channel and first price channel. */
  branchChannelId: string | undefined;
  /** Second price channel: the reseller's retail channel of the store. */
  retailChannelId: string | undefined;
}

/**
 * The chosen branch, else the first branch by key (also for an unknown key). `retailChannelId` is the store's
 * distribution channel that has no `branch-info` type (`ShellContext.retailChannelId`).
 */
export function getBranchScope(session: Pick<Session, 'branchKey'>, branches: Branch[], retailChannelId: string | undefined): BranchScope {
  const sorted = [...branches].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const chosen = sorted.find((b) => b.key === session.branchKey) ?? sorted[0];
  return { branchKey: chosen?.key, branchChannelId: chosen?.channelId, retailChannelId };
}

/** The fields of a standalone price that price selection needs (`channelId` is `price.channel.id`). */
export interface ScopedPrice {
  centAmount: number;
  currencyCode: string;
  country?: string;
  channelId?: string;
}

/**
 * Branch channel price, else store retail channel price, else the channel-less Malva base price for the currency and
 * country, else `undefined` ("Price pending", never 0). A price without a country applies to every country.
 */
export function selectPrice<T extends ScopedPrice>(prices: T[], scope: BranchScope, currency: string, country: string): T | undefined {
  const fits = prices.filter((p) => p.currencyCode === currency && (p.country === undefined || p.country === country));
  const on = (channelId: string | undefined) => (channelId ? fits.find((p) => p.channelId === channelId) : undefined);
  return on(scope.branchChannelId) ?? on(scope.retailChannelId) ?? fits.find((p) => p.channelId === undefined);
}
