import type { Money, Offer, OfferVariant, TermKey } from '@/lib/types';

export interface LinePrice {
  available: boolean;
  reason?: 'NOT_PUBLISHED' | 'NOT_STARTED' | 'VARIANT_GONE';
  /** The offer's name; '' when the offer is not sold any more (the caller falls back to the name stored on the list line). */
  name: string;
  term: TermKey | null;
  /** Literal descriptor of a variant without a term (a handset); '' otherwise. */
  variantLabel: string;
  /** The variant's monthly price, else its one-time price, else its lowest financed price; null when unavailable. */
  current: Money | null;
  /** The current price is a monthly (recurring) price. */
  recurring: boolean;
  kind?: Offer['kind'];
}

export const lineKey = (offerKey: string, variantId: number): string => `${offerKey}:${variantId}`;

function describe(variant: OfferVariant): string {
  const color = variant.attributes.color;
  const memory = variant.attributes['memory-gb'];
  return [typeof color === 'string' && color ? color.charAt(0).toUpperCase() + color.slice(1) : '', typeof memory === 'number' || (typeof memory === 'string' && memory) ? `${memory} GB` : '']
    .filter(Boolean)
    .join(' · ');
}

function priceOf(variant: OfferVariant): { price: Money | null; recurring: boolean } {
  if (variant.recurringPrice) return { price: variant.recurringPrice, recurring: true };
  if (variant.oneTimePrice) return { price: variant.oneTimePrice, recurring: false };
  const financed = variant.financedPrices?.[0];
  return financed ? { price: financed, recurring: true } : { price: null, recurring: false };
}

/**
 * Prices and availability of saved lines at view time. `offers` are the catalog's current projections for the market (price
 * selection already done by the platform), so a price here is what the buyer would pay now. A line is unavailable when its offer is not
 * published (absent from `offers`), has not started yet, or no longer has the saved variant. Key of the map: `${offerKey}:${variantId}`.
 */
export function resolveLines(lines: readonly { offerKey: string; variantId: number }[], offers: readonly Offer[], now: Date): Map<string, LinePrice> {
  const byKey = new Map(offers.map((offer) => [offer.key, offer]));
  const result = new Map<string, LinePrice>();
  for (const line of lines) {
    const offer = byKey.get(line.offerKey);
    const unavailable = (reason: NonNullable<LinePrice['reason']>, name = ''): LinePrice => ({ available: false, reason, name, term: null, variantLabel: '', current: null, recurring: false });
    if (!offer) {
      result.set(lineKey(line.offerKey, line.variantId), unavailable('NOT_PUBLISHED'));
      continue;
    }
    if (offer.startTime && Date.parse(offer.startTime) > now.getTime()) {
      result.set(lineKey(line.offerKey, line.variantId), unavailable('NOT_STARTED', offer.name));
      continue;
    }
    const variant = offer.variants.find((entry) => entry.id === line.variantId);
    if (!variant) {
      result.set(lineKey(line.offerKey, line.variantId), unavailable('VARIANT_GONE', offer.name));
      continue;
    }
    const { price, recurring } = priceOf(variant);
    result.set(lineKey(line.offerKey, line.variantId), { available: true, name: offer.name, term: variant.term, variantLabel: variant.term ? '' : describe(variant), current: price, recurring, kind: offer.kind });
  }
  return result;
}
