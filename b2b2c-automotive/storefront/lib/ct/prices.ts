// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Standalone prices (D4, owner answer Q-003: every price is standalone, Malva's base price too). Used by L (cards), M (product
// page) and N (cart channel): ONE selection function, `selectStandalonePrice`, which delegates the channel order to
// `selectPrice` of `lib/store/branch-scope.ts` (branch channel, store retail channel, channel-less base price).
//   const prices = await getStandalonePrices(skus, { currency, channelIds: [branchChannelId, retailChannelId] }); // one call
//   const selected = selectStandalonePrice(prices.get(sku) ?? [], { currency, country, channelIds: [branchChannelId, retailChannelId] });
import 'server-only';
import type { StandalonePrice } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { mapMoney } from '@/lib/mappers/money';
import type { PriceCandidate } from '@/lib/types';

export type { PriceCandidate, SelectedPrice } from '@/lib/types';
export { selectStandalonePrice, type SelectOptions } from '@/lib/store/standalone-price';

type ChannelId = string | undefined;

/** Branch channel first, store retail channel second; either may be missing (a store without branches). */
export interface PriceScope {
  currency: string;
  channelIds: readonly [branchChannelId: ChannelId, retailChannelId: ChannelId];
}

export function mapStandalonePrice(p: StandalonePrice): PriceCandidate {
  return {
    id: p.id,
    centAmount: p.value.centAmount,
    currencyCode: p.value.currencyCode,
    fractionDigits: p.value.fractionDigits,
    country: p.country,
    channelId: p.channel?.id,
    validFrom: p.validFrom,
    validUntil: p.validUntil,
    discounted: p.discounted ? mapMoney(p.discounted.value) : undefined,
  };
}

const SKU = /^[A-Za-z0-9._-]{1,64}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const CHUNK = 50;

/**
 * One call per 50 skus (a page of the listing is one call): the active standalone prices of the currency that are channel-less
 * or on one of the two channels. Returns every candidate by sku; `selectStandalonePrice` picks one. Never cached across requests.
 */
export async function getStandalonePrices(skus: string[], scope: PriceScope): Promise<Map<string, PriceCandidate[]>> {
  const result = new Map<string, PriceCandidate[]>();
  const unique = [...new Set(skus)];
  for (const sku of unique) if (!SKU.test(sku)) throw new Error('Invalid sku');
  const channels = scope.channelIds.filter((c): c is string => Boolean(c));
  for (const id of channels) if (!ID.test(id)) throw new Error('Invalid channel id');
  if (!/^[A-Z]{3}$/.test(scope.currency)) throw new Error('Invalid currency');
  const channelClause = channels.length > 0 ? `(channel is not defined or channel(id in (${channels.map((c) => `"${c}"`).join(',')})))` : 'channel is not defined';

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) chunks.push(unique.slice(i, i + CHUNK));
  const pages = await Promise.all(
    chunks.map((chunk) =>
      apiRoot
        .standalonePrices()
        .get({ queryArgs: { where: `sku in (${chunk.map((s) => `"${s}"`).join(',')}) and value(currencyCode="${scope.currency}") and active=true and ${channelClause}`, limit: 500 } })
        .execute(),
    ),
  );
  for (const { body } of pages) {
    for (const p of body.results) {
      const list = result.get(p.sku) ?? [];
      list.push(mapStandalonePrice(p));
      result.set(p.sku, list);
    }
  }
  return result;
}
