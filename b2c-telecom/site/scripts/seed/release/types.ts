// Coordinated offer release (workstream X, D-057, D-069): manifest, record and shared shapes.
import type { CartDiscountManifest, LocalizedString, OfferManifest, PriceSpec } from '../data/catalog-types';

export type { LocalizedString, OfferManifest, CartDiscountManifest, PriceSpec };

export const RELEASE_KEY_PATTERN = /^malva-rel-[a-z0-9-]{3,60}$/;
/** Custom Object container of the release records (docs: https://docs.commercetools.com/api/projects/custom-objects). */
export const RELEASE_CONTAINER = 'malva-releases';
/** A release may be scheduled at most this far ahead (open question 3). */
export const RELEASE_MAX_AHEAD_DAYS = 90;
/** Lead time of `apply`: the write phase and the search index update must finish before the instant (same value as `lib/offers/release.ts`; a test keeps them equal). */
export const RELEASE_MIN_LEAD_MS = 10 * 60 * 1000;
/** Lead time with `expedite`. */
export const RELEASE_EXPEDITED_LEAD_MS = 2 * 60 * 1000;
export const EXPEDITE_REASON_MIN_LENGTH = 20;

export interface OfferPatch {
  key: string;
  name?: LocalizedString;
  description?: LocalizedString;
  /** SameForAll attributes only (for example the badge). Applied at apply time, therefore visible early. */
  attributes?: Record<string, unknown>;
  /** New prices from `releaseAt`; the current ones of the same scope are closed at `releaseAt`. */
  prices?: { sku: string; prices: PriceSpec[] }[];
}

export interface ReleaseManifest {
  schema: 1;
  /** /^malva-rel-[a-z0-9-]{3,60}$/ */
  key: string;
  name: string;
  author: string;
  /** ISO-8601 UTC ending in Z. */
  releaseAt: string;
  endsAt?: string;
  createOffers: OfferManifest[];
  patchOffers: OfferPatch[];
  withdrawOffers: string[];
  reinstateOffers: string[];
  replaces: { old: string; new: string }[];
  createCartDiscounts: CartDiscountManifest[];
  withdrawCartDiscounts: string[];
  /** Added for generated rollbacks (the inverse of `withdrawCartDiscounts`): clears the closing validUntil. */
  reinstateCartDiscounts: string[];
  externalChecklist: string[];
  expedite?: { reason: string };
  /** Set on generated rollback manifests: the key of the release being undone. */
  rollbackOf?: string;
}

export interface Issue {
  code: string;
  key: string;
  message: string;
  severity: 'error' | 'warning';
}

export type ReleaseStatus = 'applying' | 'scheduled' | 'withdrawn' | 'rolled-back' | 'inconsistent';

export interface ReleaseChange {
  resource: 'offer' | 'price' | 'cartDiscount';
  key: string;
  field: string;
  before: unknown;
  after: unknown;
}

/** A price as the snapshot stores it (enough to restore it exactly). */
export interface SnapPrice {
  key?: string;
  value: { currencyCode: string; centAmount: number };
  country?: string;
  customerGroup?: string;
  recurrencePolicy?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface OfferSnapshot {
  name: LocalizedString;
  description?: LocalizedString;
  startTime?: string;
  endTime?: string;
  /** Values of the attributes a patch changes (undefined = unset). */
  attributes: Record<string, unknown>;
  variants: { sku: string; prices: SnapPrice[] }[];
}

export interface DiscountSnapshot {
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
}

/** The pre-apply state of everything a release touches, and the keys it creates (to delete on compensation). */
export interface ReleaseSnapshot {
  offers: Record<string, OfferSnapshot>;
  discounts: Record<string, DiscountSnapshot>;
  createdOffers: string[];
  createdDiscounts: string[];
}

export interface ReleaseRecord {
  key: string;
  name: string;
  author: string;
  appliedBy: string;
  appliedAt: string;
  releaseAt: string;
  endsAt?: string;
  manifestSha256: string;
  expedited: boolean;
  expediteReason?: string;
  externalAck: boolean;
  status: ReleaseStatus;
  changes: ReleaseChange[];
  /** The snapshot (same content as `.state/<key>.before.json`). */
  before: unknown;
  rollbackOf?: string;
  /** The applied manifest (added: lets `release:verify` and `release:rollback` work without the file). */
  manifest?: ReleaseManifest;
  error?: string;
  /** Keys that need a person when status is `inconsistent`. */
  inconsistentKeys?: string[];
}

// ---------------------------------------------------------------------------------------------------------------
// The catalog as the engine reads it (JSON-serializable)

export interface IndexPrice {
  key?: string;
  centAmount: number;
  currencyCode: string;
  country?: string;
  customerGroup?: string;
  recurrencePolicy?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface IndexVariant {
  sku: string;
  /** Attribute values; enum values are reduced to their key. */
  attributes: Record<string, unknown>;
  prices: IndexPrice[];
}

export interface IndexOffer {
  key: string;
  published: boolean;
  name: LocalizedString;
  description?: LocalizedString;
  categories: string[];
  /** variants[0] is the master variant. */
  variants: IndexVariant[];
}

export interface IndexDiscount {
  key: string;
  sortOrder: string;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
}

export interface CatalogIndex {
  offers: IndexOffer[];
  /** Every product key (offers and descriptive products). */
  productKeys: string[];
  /** Every SKU of every product. */
  skus: string[];
  /** Every embedded price key of every product. */
  priceKeys: string[];
  categories: string[];
  taxCategories: string[];
  recurrencePolicies: string[];
  discounts: IndexDiscount[];
  /** Attribute names with savedToLineItem = true (cart discount predicates may only read these). */
  lineItemAttributes: string[];
}

export const EXIT_INCONSISTENT = 7;
