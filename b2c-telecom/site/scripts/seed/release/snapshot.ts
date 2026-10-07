// Snapshot: the pre-apply state of everything a release touches (reads only; pure over the index).
import { END_TIME, START_TIME, toSnapPrice } from './model';
import type { CatalogIndex, DiscountSnapshot, IndexOffer, OfferSnapshot, ReleaseManifest, ReleaseSnapshot } from './types';

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function snapshotOffer(offer: IndexOffer, patchedAttributes: string[]): OfferSnapshot {
  const master = offer.variants[0];
  const startTime = str(master?.attributes[START_TIME]);
  const endTime = str(master?.attributes[END_TIME]);
  return {
    name: offer.name,
    ...(offer.description ? { description: offer.description } : {}),
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    attributes: Object.fromEntries(patchedAttributes.map((name) => [name, master?.attributes[name]])),
    variants: offer.variants.map((v) => ({ sku: v.sku, prices: v.prices.map(toSnapPrice) })),
  };
}

export function takeSnapshot(manifest: ReleaseManifest, index: CatalogIndex): ReleaseSnapshot {
  const offers: Record<string, OfferSnapshot> = {};
  const touched = new Set([...manifest.patchOffers.map((p) => p.key), ...manifest.withdrawOffers, ...manifest.reinstateOffers]);
  for (const key of touched) {
    const offer = index.offers.find((o) => o.key === key);
    if (!offer) continue;
    const patch = manifest.patchOffers.find((p) => p.key === key);
    offers[key] = snapshotOffer(offer, Object.keys(patch?.attributes ?? {}));
  }
  const discounts: Record<string, DiscountSnapshot> = {};
  for (const key of new Set([...manifest.withdrawCartDiscounts, ...manifest.reinstateCartDiscounts])) {
    const discount = index.discounts.find((d) => d.key === key);
    if (!discount) continue;
    discounts[key] = { isActive: discount.isActive, ...(discount.validFrom ? { validFrom: discount.validFrom } : {}), ...(discount.validUntil ? { validUntil: discount.validUntil } : {}) };
  }
  return {
    offers,
    discounts,
    createdOffers: manifest.createOffers.map((o) => o.key),
    createdDiscounts: manifest.createCartDiscounts.map((d) => d.key),
  };
}
