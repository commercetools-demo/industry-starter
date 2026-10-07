import 'server-only';
import { describeAvailability } from '@/lib/offers/serviceability';
import { filterEligible, resolveVisibleOffer } from '@/lib/offers/eligibility';
import type { AvailabilityState, BuyerContext, Market, Offer, Technology } from '@/lib/types';
import { getBuyerContext } from './buyer-context';
import { getAllOffers, getOffersInCategory } from './catalog';

// THE read for every buyer-facing surface (listings N, home O, search P, bundle prompts M): the cached catalog from H, filtered
// for this buyer. The result is buyer-specific and is never cached (no unstable_cache, no generateStaticParams).

export interface VisibleOffers {
  offers: Offer[];
  buyer: BuyerContext;
  availability: { state: AvailabilityState; technologies: Technology[] };
}

async function visible(offers: Offer[], market: Market): Promise<VisibleOffers> {
  const buyer = await getBuyerContext(market);
  return { offers: filterEligible(offers, buyer), buyer, availability: describeAvailability(buyer.location) };
}

export async function getVisibleOffers(market: Market): Promise<VisibleOffers> {
  return visible(await getAllOffers(market), market);
}

export async function getVisibleOffersInCategory(categoryKey: string, market: Market): Promise<VisibleOffers> {
  return visible(await getOffersInCategory(categoryKey, market), market);
}

/** `null` for an unknown offer and for one this buyer may not see (absent, not refused). */
export async function getVisibleOfferByKey(key: string, market: Market): Promise<Offer | null> {
  const [offers, buyer] = await Promise.all([getAllOffers(market), getBuyerContext(market)]);
  return resolveVisibleOffer(Object.fromEntries(offers.map((offer) => [offer.key, offer])), key, buyer).offer;
}
