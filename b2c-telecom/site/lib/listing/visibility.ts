import type { Offer } from '@/lib/types';

const unrestricted = (offer: Offer): boolean => offer.channels.length === 0 && offer.existingCustomer === 'any';
const groupKey = (offer: Offer): string | null => (offer.anchors.length === 0 ? null : [...offer.anchors].sort().join('|'));

/**
 * One card per sellable thing. K's `getVisibleOffers*` already removed what this buyer must not see (audience, channel, start/end,
 * existing-customer, serviceability); what is left can still contain two offers over the same product (an "online only" or
 * "existing customer" variant of Unlimited, say). Planner default: show the unrestricted offer only. The restricted one stays
 * reachable through its canonical link, so `preferKey` (the `?offer=` target) wins its group. Duplicate keys collapse; order is kept.
 */
export function dedupeByAnchors(offers: readonly Offer[], preferKey: string | null = null): Offer[] {
  const seen = new Set<string>();
  const unique = offers.filter((offer) => (seen.has(offer.key) ? false : (seen.add(offer.key), true)));
  const winner = new Map<string, Offer>();
  for (const offer of unique) {
    const key = groupKey(offer);
    if (key === null) continue;
    const current = winner.get(key);
    if (!current) {
      winner.set(key, offer);
    } else if (current.key !== preferKey && (offer.key === preferKey || (unrestricted(offer) && !unrestricted(current)))) {
      winner.set(key, offer);
    }
  }
  return unique.filter((offer) => {
    const key = groupKey(offer);
    return key === null || winner.get(key)?.key === offer.key;
  });
}
