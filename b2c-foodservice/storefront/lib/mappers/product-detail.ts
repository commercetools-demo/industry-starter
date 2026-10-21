import type { Price as SDKPrice, ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import { rootCategoryName, breadcrumbOf } from '@/lib/category-tree';
import { mapAttributes } from '@/lib/mappers/attribute';
import type { AttributeLabels } from '@/lib/mappers/attribute-labels';
import { mapImages } from '@/lib/mappers/image';
import { mapMoney } from '@/lib/mappers/money';
import { mapPrice } from '@/lib/mappers/price';
import { mapRatingStats } from '@/lib/mappers/rating';
import { pickBadge } from '@/lib/product/badge';
import { unitPrice } from '@/lib/product/unit-price';
import {
  ATTRIBUTE_BLOCKLIST, PDP_INFO_ATTRIBUTES, SHAPE_SELECTORS, shapeOf,
} from '@/lib/product/variant-config';
import type {
  AttributeValue, Category, InventoryDetail, ProductDetail, SelectorDef, VariantAttrValue, VariantPrice, VariantView,
} from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

export interface DetailContext {
  locale: string;
  country: string;
  currency: string;
  /** Enum labels per attribute (getAttributeLabels); used when the projection carries no label of its own. */
  labels: AttributeLabels;
  tree: Category[];
  /** Strongly consistent stock per SKU; a SKU without an entry has no stock. */
  inventory: Record<string, InventoryDetail | undefined>;
  /** Ids of the recurrence policies that exist; a recurring price for any other policy is dropped. Null: no check. */
  policyIds?: ReadonlySet<string> | null;
}

const NO_STOCK: InventoryDetail = { online: 0, stores: {} };

const isEnum = (v: AttributeValue | undefined): v is { key: string; label: string } =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Scalar variant attributes as `attrs` (enum key, number, boolean) plus the enum labels. Sets and text are facts. */
function variantAttrs(
  attrs: Record<string, AttributeValue>,
  labels: AttributeLabels,
): { attrs: Record<string, VariantAttrValue>; attrLabels: Record<string, string> } {
  const out: Record<string, VariantAttrValue> = {};
  const attrLabels: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    if (ATTRIBUTE_BLOCKLIST.includes(name)) continue;
    if (isEnum(value)) {
      out[name] = value.key;
      attrLabels[name] = labels[name]?.[value.key] ?? value.label;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[name] = value;
    } else if (typeof value === 'string') {
      out[name] = value;
    }
  }
  return { attrs: out, attrLabels };
}

function rawPrice(v: ProductVariant, ctx: DetailContext): SDKPrice | undefined {
  if (v.price) return v.price;
  return v.prices?.find((p) => p.value.currencyCode === ctx.currency && (p.country === undefined || p.country === ctx.country));
}

function mapVariantPrice(v: ProductVariant, ctx: DetailContext): VariantPrice | null {
  const raw = rawPrice(v, ctx);
  if (!raw) return null;
  const price = mapPrice(raw, ctx.locale);
  if (!((price.discounted ?? price.value).centAmount > 0)) return null;
  return {
    value: price.value,
    ...(price.discounted ? { discounted: price.discounted } : {}),
    ...(price.discountName ? { discountName: price.discountName } : {}),
    tiers: (raw.tiers ?? []).map((t) => ({ minimumQuantity: t.minimumQuantity, value: mapMoney(t.value) })),
  };
}

function mapRecurring(v: ProductVariant, ctx: DetailContext): VariantView['recurring'] {
  const out: VariantView['recurring'] = [];
  for (const p of v.recurrencePrices ?? []) {
    const policyId = p.recurrencePolicy?.id;
    if (!policyId || p.value.currencyCode !== ctx.currency) continue;
    if (p.country !== undefined && p.country !== ctx.country) continue;
    if (ctx.policyIds && !ctx.policyIds.has(policyId)) continue;
    if (out.some((r) => r.policyId === policyId)) continue;
    out.push({ policyId, value: mapMoney(p.value) });
  }
  return out;
}

function numericOrString(v: VariantAttrValue): number | string {
  return typeof v === 'boolean' ? String(v) : v;
}

function buildSelectors(shape: ProductDetail['shape'], variants: VariantView[]): SelectorDef[] {
  const out: SelectorDef[] = [];
  for (const cfg of SHAPE_SELECTORS[shape]) {
    const seen = new Map<string, { value: string; label: string; sort: number | string }>();
    for (const v of variants) {
      const raw = v.attrs[cfg.attr];
      if (raw === undefined) continue;
      const value = String(raw);
      if (!seen.has(value)) seen.set(value, { value, label: v.attrLabels[cfg.attr] ?? value, sort: numericOrString(raw) });
    }
    if (seen.size < 2) continue;
    const options = [...seen.values()];
    if (options.every((o) => typeof o.sort === 'number')) options.sort((a, b) => (a.sort as number) - (b.sort as number));
    out.push({ attr: cfg.attr, renderer: cfg.renderer, required: cfg.required, options: options.map(({ value, label }) => ({ value, label })) });
  }
  return out;
}

const text = (v: AttributeValue | undefined): string | undefined =>
  typeof v === 'string' ? v : isEnum(v) ? v.label : typeof v === 'number' ? String(v) : undefined;

function specValue(name: string, v: AttributeValue | undefined, labels: AttributeLabels): string | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) {
    const parts = v.map((x) => (isEnum(x) ? (labels[name]?.[x.key] ?? x.label) : String(x)));
    return parts.length ? parts.join(', ') : undefined;
  }
  if (typeof v === 'boolean') return v ? 'true' : undefined;
  if (isEnum(v)) return labels[name]?.[v.key] ?? v.label;
  return String(v);
}

const keyOf = (v: AttributeValue | undefined): string | undefined =>
  isEnum(v) ? v.key : typeof v === 'string' ? v : undefined;

const FACT_ONLY = new Set(['intensity', 'roast', 'origin', 'flavourNotes']);

/** First sentence of the description, used as the tagline under the price. */
function taglineOf(description: string | undefined): string {
  if (!description) return '';
  const m = /^(.+?[.!?])(\s|$)/.exec(description.trim());
  return (m?.[1] ?? description).slice(0, 220);
}

/**
 * Product projection (current, with the shopper's price selection) to the product page view model (workstream H, 3.4).
 * Pure. Exported for the page loader and for K, M, N and O. Recurring prices keep the session currency and country and
 * only policies that exist; `price` is null when the variant has no selected price or the amount is 0.
 */
export function mapProductDetail(p: ProductProjection, ctx: DetailContext): ProductDetail {
  const name = getLocalizedString(p.name, ctx.locale);
  const shape = shapeOf(p.productType.obj?.key);
  const raw = [p.masterVariant, ...p.variants];
  const productAttrs = mapAttributes(p.attributes, ctx.locale);
  const masterImages = mapImages(p.masterVariant.images, name);

  const variants: VariantView[] = raw.map((v) => {
    const { attrs, attrLabels } = variantAttrs(mapAttributes(v.attributes, ctx.locale), ctx.labels);
    const price = mapVariantPrice(v, ctx);
    const images = mapImages(v.images, name);
    const unit = price
      ? unitPrice(price.discounted ?? price.value, {
          capsulesPerPack: typeof attrs.capsulesPerPack === 'number' ? attrs.capsulesPerPack : undefined,
          sizeGrams: typeof attrs.sizeGrams === 'number' ? attrs.sizeGrams : undefined,
        })
      : undefined;
    return {
      sku: v.sku ?? '',
      id: v.id,
      attrs,
      attrLabels,
      price,
      recurring: mapRecurring(v, ctx),
      images: images.length > 0 ? images : masterImages,
      stock: ctx.inventory[v.sku ?? ''] ?? NO_STOCK,
      ...(unit ? { unit } : {}),
    };
  });

  // Landing default: cheapest priced variant, ties go to the earliest (same rule as the cards).
  let defaultIdx = 0;
  let best: number | undefined;
  variants.forEach((v, i) => {
    const amount = v.price ? (v.price.discounted ?? v.price.value).centAmount : undefined;
    if (amount !== undefined && (best === undefined || amount < best)) {
      best = amount;
      defaultIdx = i;
    }
  });

  const merged: Record<string, AttributeValue> = { ...mapAttributes(p.masterVariant.attributes, ctx.locale), ...productAttrs };
  const intensity = typeof merged.intensity === 'number' ? merged.intensity : undefined;
  const notesRaw = merged.flavourNotes;
  const notes = Array.isArray(notesRaw) ? notesRaw.map((n) => text(n) ?? '').filter(Boolean) : [];
  const roastRaw = merged.roast;
  const roast = isEnum(roastRaw) ? (ctx.labels.roast?.[roastRaw.key] ?? roastRaw.label) : undefined;
  const origin = text(merged.origin);
  const systemRaw = merged.system;

  const specs: { key: string; value: string }[] = [];
  for (const name of PDP_INFO_ATTRIBUTES[shape]) {
    if (FACT_ONLY.has(name)) continue;
    const value = specValue(name, merged[name], ctx.labels);
    if (value) specs.push({ key: name, value });
  }

  const categoryIds = p.categories.map((c) => c.id);
  const deepest = categoryIds
    .map((id) => breadcrumbOf(ctx.tree, id))
    .sort((a, b) => b.length - a.length)[0] ?? [];

  const description = p.description ? getLocalizedString(p.description, ctx.locale) : undefined;
  const rating = mapRatingStats(p.reviewRatingStatistics);
  const metaTitle = p.metaTitle ? getLocalizedString(p.metaTitle, ctx.locale) : undefined;
  const metaDescription = p.metaDescription ? getLocalizedString(p.metaDescription, ctx.locale) : undefined;

  return {
    id: p.id,
    slug: getLocalizedString(p.slug, ctx.locale),
    name,
    categoryName: rootCategoryName(ctx.tree, categoryIds),
    breadcrumb: deepest.map((c) => ({ name: c.name, slug: c.slug })),
    tagline: taglineOf(description),
    ...(description ? { description } : {}),
    shape,
    badge: pickBadge({ badge: keyOf(merged.badge), subscribable: merged.subscribable === true }),
    subscribable: merged.subscribable === true,
    rating: rating ?? null,
    variants,
    defaultSku: variants[defaultIdx]?.sku ?? '',
    selectors: buildSelectors(shape, variants),
    facts: {
      ...(intensity !== undefined ? { intensity } : {}),
      ...(roast ? { roast } : {}),
      ...(isEnum(roastRaw) ? { roastKey: roastRaw.key } : {}),
      ...(origin ? { origin } : {}),
      notes,
      specs,
    },
    ...(keyOf(systemRaw) ? { systemKey: keyOf(systemRaw) as string } : {}),
    ...(metaTitle ? { metaTitle } : {}),
    ...(metaDescription ? { metaDescription } : {}),
  };
}
