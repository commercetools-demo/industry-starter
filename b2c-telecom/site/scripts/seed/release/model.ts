// Pure helpers shared by validation, planning, preview and apply: how a release changes offers, prices and discounts.
// Everything written by a release is "dark": it carries the release instant itself (start-time / end-time on offers,
// validFrom / validUntil on prices and cart discounts), so nothing is effective before `releaseAt`.
import { priceKey, toPriceDraft, type PriceSpec } from '../data/catalog-types';
import type { CartDiscountDraft, PriceDraft, ProductDraft } from '../types';
import type { CatalogIndex, IndexDiscount, IndexOffer, IndexPrice, IndexVariant, OfferPatch, ReleaseManifest, SnapPrice } from './types';

export const START_TIME = 'start-time';
export const END_TIME = 'end-time';

export const sameInstant = (a: string | undefined, b: string | undefined): boolean => (a === undefined || b === undefined ? a === b : Date.parse(a) === Date.parse(b));

/** `2026-12-01T09:00:00Z` -> `20261201T090000Z`: suffix of the keys of the prices a release adds. */
export function stampOf(releaseAt: string): string {
  return releaseAt.replace(/[-:]/g, '').replace(/\.\d+/, '');
}

export function scopeOf(price: Pick<IndexPrice, 'currencyCode' | 'country' | 'customerGroup' | 'recurrencePolicy'>): string {
  return [price.currencyCode, price.country ?? '', price.customerGroup ?? '', price.recurrencePolicy ?? 'once'].join('|');
}

export function toSnapPrice(price: IndexPrice): SnapPrice {
  return {
    ...(price.key ? { key: price.key } : {}),
    value: { currencyCode: price.currencyCode, centAmount: price.centAmount },
    ...(price.country ? { country: price.country } : {}),
    ...(price.customerGroup ? { customerGroup: price.customerGroup } : {}),
    ...(price.recurrencePolicy ? { recurrencePolicy: price.recurrencePolicy } : {}),
    ...(price.validFrom ? { validFrom: price.validFrom } : {}),
    ...(price.validUntil ? { validUntil: price.validUntil } : {}),
  };
}

export function fromSnapPrice(price: SnapPrice): IndexPrice {
  return {
    ...(price.key ? { key: price.key } : {}),
    centAmount: price.value.centAmount,
    currencyCode: price.value.currencyCode,
    ...(price.country ? { country: price.country } : {}),
    ...(price.customerGroup ? { customerGroup: price.customerGroup } : {}),
    ...(price.recurrencePolicy ? { recurrencePolicy: price.recurrencePolicy } : {}),
    ...(price.validFrom ? { validFrom: price.validFrom } : {}),
    ...(price.validUntil ? { validUntil: price.validUntil } : {}),
  };
}

/** A price as the `setPrices` / `addVariant` request body takes it (references by key). */
export function priceBody(price: IndexPrice): Record<string, unknown> {
  return {
    ...(price.key ? { key: price.key } : {}),
    value: { currencyCode: price.currencyCode, centAmount: price.centAmount },
    ...(price.country ? { country: price.country } : {}),
    ...(price.customerGroup ? { customerGroup: { typeId: 'customer-group', key: price.customerGroup } } : {}),
    ...(price.recurrencePolicy ? { recurrencePolicy: { typeId: 'recurrence-policy', key: price.recurrencePolicy } } : {}),
    ...(price.validFrom ? { validFrom: price.validFrom } : {}),
    ...(price.validUntil ? { validUntil: price.validUntil } : {}),
  };
}

function fromDraftPrice(p: PriceDraft): IndexPrice {
  return {
    key: p.key,
    centAmount: p.value.centAmount,
    currencyCode: p.value.currencyCode,
    ...(p.country ? { country: p.country } : {}),
    ...(p.customerGroup ? { customerGroup: p.customerGroup } : {}),
    ...(p.recurrencePolicy ? { recurrencePolicy: p.recurrencePolicy } : {}),
    ...(p.validFrom ? { validFrom: p.validFrom } : {}),
    ...(p.validUntil ? { validUntil: p.validUntil } : {}),
  };
}

export function draftVariants(draft: ProductDraft): ProductDraft['masterVariant'][] {
  return [draft.masterVariant, ...draft.variants];
}

/** The offer manifest with the release instant written into every variant attribute and price (forced; the manifest cannot choose). */
export function darkOffer(draft: ProductDraft, releaseAt: string, endsAt?: string): ProductDraft {
  const dark = (v: ProductDraft['masterVariant']): ProductDraft['masterVariant'] => ({
    ...v,
    attributes: [
      ...v.attributes.filter((a) => a.name !== START_TIME && a.name !== END_TIME),
      { name: START_TIME, value: releaseAt },
      ...(endsAt ? [{ name: END_TIME, value: endsAt }] : []),
    ],
    prices: v.prices.map((p) => ({ ...p, validFrom: releaseAt, ...(endsAt ? { validUntil: endsAt } : { validUntil: undefined }) })),
  });
  return { ...draft, masterVariant: dark(draft.masterVariant), variants: draft.variants.map(dark), publish: true };
}

export function darkDiscount(draft: CartDiscountDraft, releaseAt: string, endsAt?: string): CartDiscountDraft {
  const { validUntil: _ignored, ...rest } = draft;
  void _ignored;
  return { ...rest, isActive: true, validFrom: releaseAt, ...(endsAt ? { validUntil: endsAt } : {}) };
}

/** Closes every price that is still open at `at` (no validUntil, or one later than `at`). */
export function closePrices(prices: IndexPrice[], at: string): IndexPrice[] {
  return prices.map((p) => (p.validUntil === undefined || Date.parse(p.validUntil) > Date.parse(at) ? { ...p, validUntil: at } : p));
}

/**
 * Reinstating an offer is dark too: the newest price of every scope that was closed is closed no later than `releaseAt` and a copy of
 * it opens at `releaseAt` (new key). Until then the offer has no valid price, so it cannot be listed or sold; the end-time is cleared
 * at once but only the price makes it purchasable again.
 */
export function reopenPrices(prices: IndexPrice[], releaseAt: string, endsAt?: string): IndexPrice[] {
  const newest = new Map<string, IndexPrice>();
  const from = (x: IndexPrice): number => (x.validFrom ? Date.parse(x.validFrom) : Number.NEGATIVE_INFINITY);
  for (const p of prices) {
    const current = newest.get(scopeOf(p));
    if (!current || from(p) >= from(current)) newest.set(scopeOf(p), p);
  }
  const out: IndexPrice[] = [];
  for (const p of prices) {
    if (newest.get(scopeOf(p)) !== p || p.validUntil === undefined) {
      out.push(p);
      continue;
    }
    const base = p.key?.replace(/_\d{8}T\d{6}Z$/, '');
    const { validUntil: closed, ...rest } = p;
    out.push({ ...p, validUntil: Date.parse(closed) > Date.parse(releaseAt) ? releaseAt : closed });
    out.push({ ...rest, ...(base ? { key: `${base}_${stampOf(releaseAt)}` } : {}), validFrom: releaseAt, ...(endsAt ? { validUntil: endsAt } : {}) });
  }
  return out;
}

/** Prices of a patch: the same-scope open prices are closed at `releaseAt`, the new ones start at `releaseAt`. */
export function applyPricePatch(existing: IndexPrice[], sku: string, specs: PriceSpec[], releaseAt: string, endsAt?: string): IndexPrice[] {
  const added: IndexPrice[] = specs.map((spec) => {
    const draft = toPriceDraft(sku, { ...spec, validFrom: releaseAt, ...(endsAt ? { validUntil: endsAt } : {}) });
    return fromDraftPrice({ ...draft, key: `${draft.key}_${stampOf(releaseAt)}` });
  });
  const scopes = new Set(added.map(scopeOf));
  const closed = existing.map((p) =>
    scopes.has(scopeOf(p)) && (p.validUntil === undefined || Date.parse(p.validUntil) > Date.parse(releaseAt)) ? { ...p, validUntil: releaseAt } : p,
  );
  return [...closed, ...added];
}

export function withAttribute(variant: IndexVariant, name: string, value: unknown): IndexVariant {
  const attributes = { ...variant.attributes };
  if (value === undefined) delete attributes[name];
  else attributes[name] = value;
  return { ...variant, attributes };
}

function offerFromDraft(draft: ProductDraft): IndexOffer {
  return {
    key: draft.key,
    published: draft.publish,
    name: draft.name,
    ...(draft.description ? { description: draft.description } : {}),
    categories: draft.categories,
    variants: draftVariants(draft).map((v) => ({
      sku: v.sku,
      attributes: Object.fromEntries(v.attributes.filter((a) => a.value !== undefined).map((a) => [a.name, a.value])),
      prices: v.prices.map(fromDraftPrice),
    })),
  };
}

const mapVariants = (offer: IndexOffer, fn: (v: IndexVariant) => IndexVariant): IndexOffer => ({ ...offer, variants: offer.variants.map(fn) });

function patchOffer(offer: IndexOffer, patch: OfferPatch, releaseAt: string, endsAt?: string): IndexOffer {
  let next: IndexOffer = {
    ...offer,
    ...(patch.name ? { name: patch.name } : {}),
    ...(patch.description ? { description: patch.description } : {}),
  };
  for (const [name, value] of Object.entries(patch.attributes ?? {})) next = mapVariants(next, (v) => withAttribute(v, name, value));
  for (const { sku, prices } of patch.prices ?? []) {
    next = mapVariants(next, (v) => (v.sku === sku ? { ...v, prices: applyPricePatch(v.prices, sku, prices, releaseAt, endsAt) } : v));
  }
  return next;
}

/** The catalog after the release (what the write phase leaves behind), as a pure function: used by preview and by verification. */
export function applyToIndex(index: CatalogIndex, manifest: ReleaseManifest): CatalogIndex {
  const { releaseAt, endsAt } = manifest;
  const created = manifest.createOffers.map((draft) => offerFromDraft(darkOffer(draft, releaseAt, endsAt)));
  const offers = index.offers.map((offer) => {
    let next = offer;
    const patch = manifest.patchOffers.find((p) => p.key === offer.key);
    if (patch) next = patchOffer(next, patch, releaseAt, endsAt);
    if (manifest.withdrawOffers.includes(offer.key)) {
      next = mapVariants(next, (v) => ({ ...withAttribute(v, END_TIME, releaseAt), prices: closePrices(v.prices, releaseAt) }));
    }
    if (manifest.reinstateOffers.includes(offer.key)) {
      next = mapVariants(next, (v) => ({ ...withAttribute(v, END_TIME, undefined), prices: reopenPrices(v.prices, releaseAt, endsAt) }));
    }
    return next;
  });
  const discounts: IndexDiscount[] = index.discounts.map((d) => {
    if (manifest.withdrawCartDiscounts.includes(d.key)) return { ...d, validUntil: releaseAt };
    if (manifest.reinstateCartDiscounts.includes(d.key)) {
      const { validUntil: _closed, ...open } = d;
      void _closed;
      return open;
    }
    return d;
  });
  for (const draft of manifest.createCartDiscounts) {
    const dark = darkDiscount(draft, releaseAt, endsAt);
    discounts.push({ key: dark.key, sortOrder: dark.sortOrder, isActive: true, validFrom: releaseAt, ...(endsAt ? { validUntil: endsAt } : {}) });
  }
  return {
    ...index,
    offers: [...offers, ...created],
    productKeys: [...index.productKeys, ...created.map((o) => o.key)],
    skus: [...index.skus, ...created.flatMap((o) => o.variants.map((v) => v.sku))],
    priceKeys: [...index.priceKeys, ...created.flatMap((o) => o.variants.flatMap((v) => v.prices.flatMap((p) => (p.key ? [p.key] : []))))],
    discounts,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// What a customer sees at an instant

export function startTimeOf(offer: IndexOffer): string | undefined {
  const value = offer.variants[0]?.attributes[START_TIME];
  return typeof value === 'string' ? value : undefined;
}
export function endTimeOf(offer: IndexOffer): string | undefined {
  const value = offer.variants[0]?.attributes[END_TIME];
  return typeof value === 'string' ? value : undefined;
}

export function priceValidAt(price: IndexPrice, at: Date): boolean {
  const t = at.getTime();
  if (price.validFrom && Date.parse(price.validFrom) > t) return false;
  if (price.validUntil && Date.parse(price.validUntil) <= t) return false;
  return true;
}

/** The price a customer of this market pays at `at` for this kind (recurring = with a recurrence policy), lowest amount if several. */
export function priceAt(variant: IndexVariant, currency: string, country: string, at: Date, recurring = true): number | undefined {
  const usable = variant.prices.filter(
    (p) => p.currencyCode === currency && (p.country === undefined || p.country === country) && !p.customerGroup && (recurring ? p.recurrencePolicy !== undefined : p.recurrencePolicy === undefined) && priceValidAt(p, at),
  );
  if (usable.length === 0) return undefined;
  return Math.min(...usable.map((p) => p.centAmount));
}

export function discountEffectiveAt(discount: IndexDiscount, at: Date): boolean {
  if (!discount.isActive) return false;
  if (discount.validFrom && Date.parse(discount.validFrom) > at.getTime()) return false;
  if (discount.validUntil && Date.parse(discount.validUntil) <= at.getTime()) return false;
  return true;
}

export function keyOfSpec(sku: string, spec: PriceSpec): string {
  return priceKey(sku, spec.currency, spec.recurrencePolicy);
}

/** The index without what the release created (to revalidate an applied release against the catalog it was written for). */
export function stripCreated(index: CatalogIndex, manifest: ReleaseManifest): CatalogIndex {
  const keys = new Set(manifest.createOffers.map((o) => o.key));
  const discountKeys = new Set(manifest.createCartDiscounts.map((d) => d.key));
  const gone = index.offers.filter((o) => keys.has(o.key));
  const skus = new Set(gone.flatMap((o) => o.variants.map((v) => v.sku)));
  const priceKeys = new Set(gone.flatMap((o) => o.variants.flatMap((v) => v.prices.flatMap((p) => (p.key ? [p.key] : [])))));
  return {
    ...index,
    offers: index.offers.filter((o) => !keys.has(o.key)),
    productKeys: index.productKeys.filter((k) => !keys.has(k)),
    skus: index.skus.filter((s) => !skus.has(s)),
    priceKeys: index.priceKeys.filter((k) => !priceKeys.has(k)),
    discounts: index.discounts.filter((d) => !discountKeys.has(d.key)),
  };
}
