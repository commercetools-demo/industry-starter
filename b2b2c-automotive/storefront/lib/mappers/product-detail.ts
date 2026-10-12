// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The product page model (workstream M). Two projections go in: `tailored` (the store's ProductProjection: reseller name,
// description, images, stock) and `master` (the untailored one). Locked data (part number, OE numbers, fitment, specifications,
// brand, quality, subscribable flag) is read from `master` ONLY, so product tailoring can never change it (D2).
import type { Attribute, Category, Image, ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import { pickPrice } from '@/lib/mappers/product-summary';
import { selectStandalonePrice } from '@/lib/store/standalone-price';
import type { NavCategory, PriceCandidate, ProductDetail, ProductImage, SpecRow } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

export interface DetailContext {
  locale: string;
  currency: string;
  country: string;
  branchChannelId: string | undefined;
  retailChannelId: string | undefined;
}

/** Order of the specification table; empty values are skipped. */
export const SPEC_ORDER = ['part-number', 'brand', 'quality-tier', 'position', 'size-spec', 'warranty-months', 'oem-numbers'] as const;

const attribute = (attrs: Attribute[] | undefined, name: string): unknown => attrs?.find((a) => a.name === name)?.value;
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const enumLabel = (v: unknown): string | undefined => {
  if (typeof v !== 'object' || v === null) return text(v);
  const { label, key } = v as { label?: unknown; key?: unknown };
  return text(label) ?? text(key);
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : []);

/** Every variant of the product: the master variant first. */
const variantsOf = (p: ProductProjection): ProductVariant[] => [p.masterVariant, ...(p.variants ?? [])];

function mapImages(images: Image[] | undefined, fallbackAlt: string): ProductImage[] {
  return (images ?? []).map((i) => ({ url: i.url, alt: text(i.label) ?? fallbackAlt, width: i.dimensions?.w ?? 800, height: i.dimensions?.h ?? 600 }));
}

function categoryTrail(product: ProductProjection, locale: string): NavCategory[] {
  const categories = (product.categories ?? []).map((c) => c.obj).filter((c): c is Category => c !== undefined);
  if (categories.length === 0) return [];
  const deepest = [...categories].sort((a, b) => (b.ancestors?.length ?? 0) - (a.ancestors?.length ?? 0))[0];
  const toNav = (c: Category): NavCategory => ({ id: c.id, slug: getLocalizedString(c.slug, locale), name: getLocalizedString(c.name, locale) });
  const ancestors = (deepest.ancestors ?? []).map((a) => a.obj).filter((c): c is Category => c !== undefined);
  return [...ancestors, deepest].map(toNav);
}

function specRows(attrs: Attribute[] | undefined): SpecRow[] {
  const raw: Record<(typeof SPEC_ORDER)[number], string | undefined> = {
    'part-number': text(attribute(attrs, 'part-number')),
    brand: enumLabel(attribute(attrs, 'brand')),
    'quality-tier': enumLabel(attribute(attrs, 'quality-tier')),
    position: enumLabel(attribute(attrs, 'position')),
    'size-spec': text(attribute(attrs, 'size-spec')),
    'warranty-months': typeof attribute(attrs, 'warranty-months') === 'number' ? String(attribute(attrs, 'warranty-months')) : undefined,
    'oem-numbers': strings(attribute(attrs, 'oem-numbers')).join(', ') || undefined,
  };
  return SPEC_ORDER.flatMap((name) => (raw[name] ? [{ name, value: raw[name] as string }] : []));
}

/**
 * `sku` picks the variant (`?sku=`); an unknown sku falls back to the master variant. `prices` are the standalone prices of that sku
 * (`getStandalonePrices`), selected branch channel, then retail channel, then base price (D4); no price maps to `null`.
 */
export function mapProductDetail(
  { tailored, master }: { tailored: ProductProjection; master: ProductProjection },
  prices: readonly PriceCandidate[],
  ctx: DetailContext,
  sku?: string,
): ProductDetail {
  const tVariants = variantsOf(tailored);
  const tVariant = tVariants.find((v) => v.sku === sku) ?? tailored.masterVariant;
  const mVariant = variantsOf(master).find((v) => v.sku === tVariant.sku) ?? master.masterVariant;
  const attrs = mVariant.attributes;
  const masterAttrs = master.masterVariant.attributes;
  // Locked attributes are product-level in the seed (same on every variant): prefer the variant, fall back to the master variant.
  const attr = (name: string) => attribute(attrs, name) ?? attribute(masterAttrs, name);
  const name = getLocalizedString(tailored.name, ctx.locale) || getLocalizedString(master.name, ctx.locale);
  const description = getLocalizedString(tailored.description, ctx.locale).trim() || null;
  const tailoredImages = mapImages(tVariant.images, name);
  const images = tailoredImages.length > 0 ? tailoredImages : mapImages(mVariant.images, name);
  const channel = ctx.branchChannelId ? tVariant.availability?.channels?.[ctx.branchChannelId] : undefined;
  const stats = tailored.reviewRatingStatistics ?? master.reviewRatingStatistics;
  const selected = selectStandalonePrice(prices, { currency: ctx.currency, country: ctx.country, channelIds: [ctx.branchChannelId, ctx.retailChannelId] });
  const fitment = strings(attr('fitment-keys'));
  const specAttrs = (mVariant.attributes ?? []).concat((masterAttrs ?? []).filter((a) => !(mVariant.attributes ?? []).some((b) => b.name === a.name)));

  return {
    id: tailored.id,
    slug: getLocalizedString(tailored.slug, ctx.locale),
    sku: tVariant.sku ?? '',
    variants: tVariants.flatMap((v) => (v.sku ? [{ sku: v.sku }] : [])),
    name,
    description,
    images,
    brand: enumLabel(attr('brand')) ?? '',
    qualityLabel: enumLabel(attr('quality-tier')),
    partNumber: text(attr('part-number')) ?? tVariant.sku ?? '',
    oeNumbers: strings(attr('oem-numbers')),
    rating: stats && stats.count > 0 ? { average: stats.averageRating, count: stats.count } : null,
    price: pickPrice(selected),
    stock: { atBranch: channel?.isOnStock === true, quantity: channel?.isOnStock === true ? (channel.availableQuantity ?? 0) : 0 },
    specs: specRows(specAttrs),
    universalFit: attr('universal-fit') === true,
    fitmentKeys: fitment,
    recurringEligible: attr('recurring-eligible') === true,
    relatedSkus: strings(attr('related-skus')),
    categoryTrail: categoryTrail(tailored, ctx.locale),
  };
}
