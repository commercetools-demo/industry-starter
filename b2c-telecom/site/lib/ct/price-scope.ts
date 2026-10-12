import 'server-only';
import { CHANNEL_CALL_CENTER, SALES_CHANNEL } from '@/lib/config/eligibility';
import type { BuyerContext, Market, PriceScope } from '@/lib/types';
import { getBuyerContext } from './buyer-context';

/** Whose prices to select: the buyer's customer groups, and the channel when it has channel prices (`online` has none). Pure. */
export const priceScopeOf = (buyer: Pick<BuyerContext, 'groupKeys' | 'channel'>): PriceScope => ({
  groupKeys: buyer.groupKeys ?? [],
  channelKey: buyer.channel === SALES_CHANNEL ? null : buyer.channel,
});

/** The channel whose key a cart line item takes as its distribution channel; null for the default online channel. */
export const distributionChannelOf = (buyer: Pick<BuyerContext, 'channel'>): string | null => (buyer.channel === CHANNEL_CALL_CENTER ? CHANNEL_CALL_CENTER : null);

export async function getPriceScope(market: Market): Promise<PriceScope> {
  return priceScopeOf(await getBuyerContext(market));
}
