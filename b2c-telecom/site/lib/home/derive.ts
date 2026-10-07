import { SALES_CHANNEL } from '@/lib/config/eligibility';
import { BLURB_KEY_BY_CATEGORY } from '@/lib/config/listing';
import { listingKindForCategory } from '@/lib/listing/kinds';
import { findCategory } from '@/lib/listing/links';
import { dedupeByAnchors } from '@/lib/listing/visibility';
import { filterEligible } from '@/lib/offers/eligibility';
import type { BuyerContext, Category, ListingKind, Money, Offer } from '@/lib/types';

// Pure derivations of the home page. No price, speed or lock length is written anywhere else: everything comes from the catalog (D-018).

/** The home page is the same for every visitor, so it is filtered for the anonymous consumer (K's eligibility rules, no session). */
export function anonymousBuyer(now: Date): BuyerContext {
  return { customerType: 'consumer', isExistingCustomer: false, held: [], signedIn: false, channel: SALES_CHANNEL, now };
}

/** Offers a first-time visitor may see, one card per sellable thing (same rule as the listings). */
export function listableOffers(offers: readonly Offer[], now: Date = new Date()): Offer[] {
  return dedupeByAnchors(filterEligible([...offers], anonymousBuyer(now)));
}

const recurringOf = (offer: Offer): Money | undefined => offer.headline.recurring;

/** The lowest master-variant recurring price; null when no listable offer has one. */
export function fromPrice(offers: readonly Offer[]): Money | null {
  let lowest: Money | null = null;
  for (const offer of listableOffers(offers)) {
    const price = recurringOf(offer);
    if (price && (lowest === null || price.centAmount < lowest.centAmount)) lowest = price;
  }
  return lowest;
}

export interface HeroSpeed {
  /** 1000 Mbps and up are shown in Gbps (number formatting drops a trailing .0). */
  value: number;
  unit: 'gbps' | 'mbps';
}
export interface HeroFacts {
  speed: HeroSpeed | null;
  /** Term months of the cheapest cable offer's master variant; 0 = month to month. */
  months: number;
  price: Money | null;
}

function speedOf(offers: readonly Offer[]): HeroSpeed | null {
  const speeds = offers.flatMap((offer) => (offer.facts?.kind === 'plan' && offer.facts.downstreamMbps !== undefined ? [offer.facts.downstreamMbps] : []));
  if (speeds.length === 0) return null;
  const max = Math.max(...speeds);
  return max >= 1000 ? { value: max / 1000, unit: 'gbps' } : { value: max, unit: 'mbps' };
}

export function heroFacts(cableOffers: readonly Offer[]): HeroFacts {
  const listable = listableOffers(cableOffers);
  const cheapest = listable.filter((offer) => recurringOf(offer) !== undefined).sort((a, b) => (recurringOf(a)?.centAmount ?? 0) - (recurringOf(b)?.centAmount ?? 0))[0];
  const master = cheapest?.variants.find((variant) => variant.isMaster) ?? cheapest?.variants[0];
  return { speed: speedOf(listable), months: master?.termMonths ?? 0, price: cheapest ? (recurringOf(cheapest) ?? null) : null };
}

export function promoPhone(phoneOffers: readonly Offer[]): { price: Money | null } {
  return { price: fromPrice(phoneOffers) };
}

export interface PopularAddon {
  key: string;
  name: string;
  initial: string;
  price: Money;
  offer: Offer;
}

/** Offers in the order of `keys`; a missing, unlisted or unpriced one is skipped with one warning. */
export function popularAddons(addonOffers: readonly Offer[], keys: readonly string[], count: number): PopularAddon[] {
  const byKey = new Map(listableOffers(addonOffers).map((offer) => [offer.key, offer]));
  const result: PopularAddon[] = [];
  for (const key of keys) {
    if (result.length >= count) break;
    const offer = byKey.get(key);
    const price = offer ? recurringOf(offer) : undefined;
    if (!offer || !price) {
      console.warn('[home] popular add-on not found', { key });
      continue;
    }
    result.push({ key, name: offer.name, initial: offer.name.charAt(0).toUpperCase(), price, offer });
  }
  return result;
}

export interface CategoryTileData {
  key: string;
  slug: string;
  name: string;
  /** Message key under `plp.blurb.*`, or null (no blurb). */
  blurbKey: string | null;
  kind: ListingKind;
  fromPrice: Money | null;
}

/** Top-level categories in tree order minus the hidden ones. "From" prices only for plan categories. */
export function categoryTiles(tree: readonly Category[], offersByCategoryKey: Readonly<Record<string, readonly Offer[]>>, hidden: readonly string[]): CategoryTileData[] {
  return tree
    .filter((category) => !hidden.includes(category.key))
    .map((category) => {
      const offers = offersByCategoryKey[category.key] ?? [];
      const kind = listingKindForCategory(category.key, offers);
      return {
        key: category.key,
        slug: category.slug,
        name: category.name,
        blurbKey: BLURB_KEY_BY_CATEGORY[category.key] ?? null,
        kind,
        fromPrice: kind === 'plans' ? fromPrice(offers) : null,
      };
    });
}

/** The category a banner, promo or CTA points to; null (and one warning) when it is not in the tree. */
export function resolveBanner(tree: readonly Category[], categoryKey: string): { category: Category } | null {
  const category = findCategory([...tree], categoryKey);
  if (!category) {
    console.warn('[home] banner target does not resolve', { categoryKey });
    return null;
  }
  return { category };
}
