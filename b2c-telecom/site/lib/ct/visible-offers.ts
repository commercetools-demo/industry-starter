/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import 'server-only';
import { describeAvailability } from '@/lib/offers/serviceability';
import { filterEligible, resolveVisibleOffer } from '@/lib/offers/eligibility';
import type { AvailabilityState, BuyerContext, Market, Offer, Technology } from '@/lib/types';
import { getBuyerContext } from './buyer-context';
import { getAllOffers, getOffersInCategory } from './catalog';
import { priceScopeOf } from './price-scope';

// THE read for every buyer-facing surface (listings N, home O, search P, bundle prompts M): the cached catalog from H, filtered
// for this buyer. The result is buyer-specific and is never cached (no unstable_cache, no generateStaticParams).

export interface VisibleOffers {
  offers: Offer[];
  buyer: BuyerContext;
  availability: { state: AvailabilityState; technologies: Technology[] };
}

// Prices are the buyer's: customer-group and channel prices are selected by the same scope the cart uses (card price = cart price).
async function visible(read: (scope: ReturnType<typeof priceScopeOf>) => Promise<Offer[]>, market: Market): Promise<VisibleOffers> {
  const buyer = await getBuyerContext(market);
  return { offers: filterEligible(await read(priceScopeOf(buyer)), buyer), buyer, availability: describeAvailability(buyer.location) };
}

export async function getVisibleOffers(market: Market): Promise<VisibleOffers> {
  return visible((scope) => getAllOffers(market, scope), market);
}

export async function getVisibleOffersInCategory(categoryKey: string, market: Market): Promise<VisibleOffers> {
  return visible((scope) => getOffersInCategory(categoryKey, market, scope), market);
}

/** `null` for an unknown offer and for one this buyer may not see (absent, not refused). */
export async function getVisibleOfferByKey(key: string, market: Market): Promise<Offer | null> {
  const buyer = await getBuyerContext(market);
  const offers = await getAllOffers(market, priceScopeOf(buyer));
  return resolveVisibleOffer(Object.fromEntries(offers.map((offer) => [offer.key, offer])), key, buyer).offer;
}
