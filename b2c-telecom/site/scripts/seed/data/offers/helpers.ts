import { getLock, lockImages, type Lock } from '../../images';
import type { ProductDraft, VariantDraft } from '../../types';
import { attrs, toPriceDraft, type AttributeValues, type PriceSpec } from '../catalog-types';
import { compatibleAddonsOf, conflictsOf, includedOffersOf } from '../relations';
import { descriptiveProducts } from '../products';
import { TAX_CATEGORY, loc, slugOf, type Copy } from '../products/helpers';
import { wiringOf } from './wiring';

/** Attributes copied from the anchor product onto the offer so Product Search can filter without a second read. */
export const COPIED_FROM_ANCHOR = ['technology', 'downstream-mbps', 'data-gb', 'network-generation', 'badge', 'addon-tag'] as const;

export const ALL_AUDIENCES = ['consumer', 'small-business', 'employee'];

export function productByKey(key: string): ProductDraft {
  const product = descriptiveProducts.find((p) => p.key === key);
  if (!product) throw new Error(`No descriptive product "${key}"`);
  return product;
}

export function anchorValues(productKey: string): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const a of productByKey(productKey).masterVariant.attributes) values[a.name] = a.value;
  return values;
}

export interface OfferVariantSpec {
  sku: string;
  /** Per-variant attributes: contract-term, charge-type, color, memory-gb. */
  values: AttributeValues;
  prices: PriceSpec[];
}

export interface OfferSpec {
  key: string;
  /** Overrides the anchor's name. */
  name?: Copy;
  /** Offer attributes beyond the common ones (existing-customer, audience, channels, intro-free-months, price-steps ...). */
  extras?: AttributeValues;
  variants: OfferVariantSpec[];
}

function nonEmpty<T>(items: T[]): T[] | undefined {
  return items.length > 0 ? items : undefined;
}

/** One offer: a `malva-offer` product wrapping a descriptive product, priced per variant (D-010, D-011). */
export function buildOffer(spec: OfferSpec, lock: Lock = getLock()): ProductDraft {
  const wiring = wiringOf(spec.key);
  const anchor = productByKey(wiring.anchor);
  const anchorAttrs = anchorValues(wiring.anchor);
  const common: AttributeValues = {
    'offer-kind': wiring.kind,
    'offer-family': wiring.family,
    anchors: [wiring.anchor],
    'included-offers': nonEmpty(includedOffersOf(spec.key)),
    'compatible-addons': nonEmpty(compatibleAddonsOf(spec.key)),
    'conflicts-with': nonEmpty(conflictsOf(spec.key)),
    audience: ALL_AUDIENCES,
    'existing-customer': 'any',
    ...Object.fromEntries(COPIED_FROM_ANCHOR.map((name) => [name, anchorAttrs[name]])),
    ...spec.extras,
  };
  const images = lockImages(lock, spec.key);
  const variants = spec.variants.map(
    (v): VariantDraft => ({
      sku: v.sku,
      key: v.sku.toLowerCase(),
      attributes: attrs({ ...common, ...v.values }),
      prices: v.prices.map((p) => toPriceDraft(v.sku, p)),
      ...(images.length > 0 ? { images } : {}),
    }),
  );
  const [master, ...rest] = variants;
  const slug = slugOf(spec.key).replace(/^offer-/, '');
  return {
    key: spec.key,
    productType: 'malva-offer',
    name: spec.name ? loc(spec.name) : anchor.name,
    slug: { 'en-US': slug, 'de-DE': slug },
    ...(anchor.description ? { description: anchor.description } : {}),
    categories: Object.keys(wiring.categories),
    categoryOrderHints: { ...wiring.categories },
    taxCategory: TAX_CATEGORY,
    masterVariant: master,
    variants: rest,
    publish: true,
  };
}
