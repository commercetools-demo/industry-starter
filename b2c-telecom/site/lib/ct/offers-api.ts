import 'server-only';
import { buildCandidateList } from '@/lib/offers/compat';
import { groupKeyOf } from '@/lib/offers/declared';
import { missingRequiredOffers } from '@/lib/offers/dependencies';
import { filterEligible, needsLocation, resolveVisibleOffer } from '@/lib/offers/eligibility';
import { makeReason } from '@/lib/offers/rules';
import { SEEDED_ZIPS } from '@/lib/offers/serviceability';
import { matchesFamily, type OfferFilters } from '@/lib/offers-api/filters';
import { reasonTextFor } from '@/lib/offers-api/text';
import { toOfferItem, toVerdictView, type GroupItem, type OfferDetail, type OfferItem } from '@/lib/offers-api/views';
import type { BuyerContext, CompatVerdict, CustomerType, Locale, Market, Offer, ServiceLocation } from '@/lib/types';
import { getBuyerContext } from './buyer-context';
import { getAllOffers } from './catalog';
import { priceScopeOf } from './price-scope';
import { getServiceability } from './serviceability';

// The reads behind GET /api/offers and GET /api/offers/[key]: the shared eligibility resolution (never a second predicate list), the
// buyer's own prices (customer group and channel) and the shared compatibility evaluation, so every verdict and price here is the one
// the cards show.

export interface BuyerView {
  customerType: CustomerType;
  existingCustomer: 'yes' | 'no' | 'unspecified';
  /** True for a signed-in customer: the account decides, and any customerType, existingCustomer or postalCode parameter is ignored. */
  fromAccount: boolean;
  location: (Pick<ServiceLocation, 'postalCode' | 'country' | 'state' | 'served' | 'anyServed'> & { source: 'table' | 'default' }) | null;
}

export interface OfferList {
  offers: OfferItem[];
  total: number;
  limit: number;
  offset: number;
  count: number;
  buyer: BuyerView;
}

/** The buyer for this request. An anonymous caller may try another context with the query; a signed-in one never can. */
export async function effectiveBuyer(market: Market, filters: Pick<OfferFilters, 'customerType' | 'existingCustomer' | 'postalCode'> = {}): Promise<BuyerContext> {
  const base = await getBuyerContext(market);
  if (base.signedIn) return base;
  const customerType = filters.customerType ?? base.customerType;
  const isExistingCustomer = filters.existingCustomer ?? base.isExistingCustomer;
  const existingSpecified = filters.existingCustomer !== undefined || !base.existingUnspecified;
  const location = filters.postalCode ? await getServiceability().check(filters.postalCode, market.country) : base.location;
  const key = groupKeyOf(customerType, isExistingCustomer);
  return { ...base, customerType, isExistingCustomer, existingUnspecified: !existingSpecified, groupKeys: key ? [key] : [], ...(location ? { location } : {}) };
}

export function viewOf(buyer: BuyerContext): BuyerView {
  const location = buyer.location;
  return {
    customerType: buyer.customerType,
    existingCustomer: buyer.isExistingCustomer ? 'yes' : buyer.existingUnspecified ? 'unspecified' : 'no',
    fromAccount: buyer.signedIn,
    location: location ? { postalCode: location.postalCode, country: location.country, ...(location.state ? { state: location.state } : {}), served: location.served, anyServed: location.anyServed, source: `${location.country}:${location.postalCode}` in SEEDED_ZIPS ? 'table' : 'default' } : null,
  };
}

const amountOf = (item: OfferItem): number => item.price.recurring?.centAmount ?? item.price.oneTime?.centAmount ?? 0;
const order = (a: OfferItem, b: OfferItem): number => amountOf(a) - amountOf(b) || a.key.localeCompare(b.key);

async function scopedOffers(market: Market, buyer: BuyerContext): Promise<Record<string, Offer>> {
  const offers = await getAllOffers(market, priceScopeOf(buyer));
  return Object.fromEntries(offers.map((offer) => [offer.key, offer]));
}

export async function listOffers(market: Market, filters: OfferFilters): Promise<OfferList> {
  const buyer = await effectiveBuyer(market, filters);
  const byKey = await scopedOffers(market, buyer);
  const visible = filterEligible(Object.values(byKey), buyer)
    .filter((offer) => (filters.kind ? offer.kind === filters.kind : true))
    .filter((offer) => (filters.family ? matchesFamily(offer, filters.family) : true))
    .map((offer) => toOfferItem(offer, byKey, { needsLocation: needsLocation(offer, buyer) }))
    .sort(order);
  const page = visible.slice(filters.offset, filters.offset + filters.limit);
  return { offers: page, total: visible.length, limit: filters.limit, offset: filters.offset, count: page.length, buyer: viewOf(buyer) };
}

/** `null` for an unknown offer and for one this buyer may not see (the same answer, so ineligibility is not revealed). */
export async function getOfferDetail(market: Market, key: string): Promise<OfferDetail | null> {
  const buyer = await effectiveBuyer(market);
  const byKey = await scopedOffers(market, buyer);
  const plan = resolveVisibleOffer(byKey, key, buyer).offer;
  if (!plan) return null;
  const text = reasonTextFor(market.locale as Locale);
  const itemOf = (offer: Offer): OfferItem => toOfferItem(offer, byKey, { needsLocation: needsLocation(offer, buyer) });

  const isPlan = plan.kind === 'base-package' || plan.kind === 'bundle';
  if (!isPlan) return { offer: itemOf(plan), included: [], compatibleAddons: [], compatibleEquipment: [] };

  const included: GroupItem[] = plan.includedOffers.flatMap((ref) => {
    const found = Object.values(byKey).find((offer) => offer.key === ref || offer.anchors.includes(ref));
    return found ? [{ offer: itemOf(found), verdict: { status: 'included' as const, reasons: [] } }] : [];
  });

  const candidates = filterEligible(Object.values(byKey), buyer).filter((offer) => (offer.kind === 'addon' || offer.kind === 'equipment') && offer.key !== plan.key);
  const entries = buildCandidateList(plan, [...candidates].sort((a, b) => order(itemOf(a), itemOf(b))));
  const toGroup = (entry: { offer: Offer; verdict: CompatVerdict }): GroupItem => {
    let verdict = entry.verdict;
    if (verdict.status === 'allowed' && needsLocation(entry.offer, buyer)) {
      verdict = { status: 'unavailable', reasons: [makeReason('LOCATION_REQUIRED', { offerName: entry.offer.name }, [entry.offer.key])] };
    }
    const requires = verdict.status === 'allowed' ? missingRequiredOffers(entry.offer, [], buyer.held, byKey).flatMap((missing) => (missing.offer ? [{ offerKey: missing.offer.key, name: missing.offer.name }] : [])) : [];
    return { offer: itemOf(entry.offer), verdict: toVerdictView(verdict, text, requires) };
  };
  const groups = entries.map(toGroup);
  const includedKeys = new Set(included.map((entry) => entry.offer.key));
  const notIncluded = groups.filter((entry) => !includedKeys.has(entry.offer.key) && entry.verdict.status !== 'included');
  return {
    offer: itemOf(plan),
    included,
    compatibleAddons: notIncluded.filter((entry) => entry.offer.kind === 'addon'),
    compatibleEquipment: notIncluded.filter((entry) => entry.offer.kind === 'equipment'),
  };
}
