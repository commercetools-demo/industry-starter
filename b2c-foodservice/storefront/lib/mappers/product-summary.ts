import type { ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import { availabilityState } from '@/lib/availability';
import { CHOICE_ATTRIBUTES } from '@/lib/product/choice-config';
import { pickBadge } from '@/lib/product/badge';
import { unitPrice } from '@/lib/product/unit-price';
import { LOW_STOCK_THRESHOLD } from '@/lib/shop-config';
import type { AttributeValue, Money, ProductSummary, Variant } from '@/lib/types';
import { getLocalizedString, roundRating } from '@/lib/utils';
import { mapAttributes } from '@/lib/mappers/attribute';
import { mapRatingStats } from '@/lib/mappers/rating';
import { mapVariant } from '@/lib/mappers/variant';

export interface SummaryContext {
  locale: string;
  country: string;
  currency: string;
  /** Channel id of the chosen store; availability is null without it. */
  storeChannelId?: string;
  /** Display name of the product's category, from the tree (root ancestor name). */
  categoryName: (categoryIds: string[]) => string;
  /** Set when the query was a SKU: the variant that matched it. */
  matchedSku?: string;
}

const key = (v: AttributeValue | undefined): string | undefined =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? v.key : typeof v === 'string' ? v : undefined;
const label = (v: AttributeValue | undefined): string | undefined =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? v.label : typeof v === 'string' ? v : undefined;
const num = (v: AttributeValue | undefined): number | undefined => (typeof v === 'number' ? v : undefined);

/** Amount the shopper pays for a variant: the discounted value when present. Zero is treated as no price. */
const payable = (v: Variant): { pay: Money; old?: Money; discountName?: string } | undefined => {
  if (!v.price) return undefined;
  const pay = v.price.discounted ?? v.price.value;
  if (!(pay.centAmount > 0)) return undefined;
  return { pay, ...(v.price.discounted ? { old: v.price.value } : {}), ...(v.price.discountName ? { discountName: v.price.discountName } : {}) };
};

/**
 * Card view model from a product projection fetched with price selection (workstream G, 3.6). Pure.
 * Default variant = cheapest priced variant, ties go to the earliest (the master). No price in this market gives `price: null`.
 */
export function mapProductSummary(p: ProductProjection, ctx: SummaryContext): ProductSummary {
  const raw: ProductVariant[] = [p.masterVariant, ...p.variants];
  const variants = raw.map((v) => mapVariant(v, ctx));
  const productAttrs = mapAttributes(p.attributes, ctx.locale);
  const name = getLocalizedString(p.name, ctx.locale);

  let defaultIdx = 0;
  let best: number | undefined;
  let high: number | undefined;
  variants.forEach((v, i) => {
    const pp = payable(v);
    if (!pp) return;
    if (best === undefined || pp.pay.centAmount < best) {
      best = pp.pay.centAmount;
      defaultIdx = i;
    }
    if (high === undefined || pp.pay.centAmount > high) high = pp.pay.centAmount;
  });
  const def = variants[defaultIdx] as Variant;
  const defRaw = raw[defaultIdx] as ProductVariant;
  const defPay = payable(def);
  const attrs = { ...def.attributes, ...productAttrs };

  const colours = new Map<string, string>();
  const grinds = new Set<string>();
  for (const v of variants) {
    const c = key(v.attributes.colour);
    if (c) colours.set(c, label(v.attributes.colour) ?? c);
    const g = key(v.attributes[CHOICE_ATTRIBUTES.grind]);
    if (g) grinds.add(g);
  }

  const image = def.images[0] ?? variants.find((v) => v.images.length > 0)?.images[0];
  const channel = ctx.storeChannelId ? defRaw.availability?.channels?.[ctx.storeChannelId] : undefined;
  const rating = mapRatingStats(p.reviewRatingStatistics);

  const intensity = num(attrs.intensity);
  const roast = label(attrs.roast);
  const labelOut: ProductSummary['label'] =
    num(attrs.capsulesPerPack) !== undefined && intensity !== undefined
      ? { kind: 'intensity', value: String(intensity) }
      : roast
        ? { kind: 'roast', value: roast }
        : undefined;

  const unit = defPay ? unitPrice(defPay.pay, { capsulesPerPack: num(attrs.capsulesPerPack), sizeGrams: num(attrs.sizeGrams) }) : undefined;

  const out: ProductSummary = {
    id: p.id,
    slug: getLocalizedString(p.slug, ctx.locale),
    sku: def.sku,
    name,
    categoryName: ctx.categoryName(p.categories.map((c) => c.id)),
    imageAlt: image?.alt || name,
    badge: pickBadge({ badge: key(attrs.badge), subscribable: attrs.subscribable === true }),
    price: defPay && best !== undefined
      ? {
          from: defPay.pay,
          fromIsRange: high !== undefined && high !== best,
          ...(defPay.old ? { old: defPay.old } : {}),
          ...(defPay.discountName ? { discountName: defPay.discountName } : {}),
        }
      : null,
    requiredChoice: colours.size > 1 ? 'colour' : grinds.size > 1 ? 'grind' : null,
    rating: rating ? { average: roundRating(rating.average), count: rating.count } : null,
    availability: ctx.storeChannelId
      ? { state: availabilityState(channel?.availableQuantity ?? 0, LOW_STOCK_THRESHOLD) }
      : null,
  };
  if (image) out.imageUrl = image.url;
  if (unit) out.unit = unit;
  if (labelOut) out.label = labelOut;
  if (colours.size > 1) out.swatches = [...colours].map(([k, n]) => ({ key: k, name: n }));
  if (ctx.matchedSku) out.matchedSku = ctx.matchedSku;
  return out;
}
