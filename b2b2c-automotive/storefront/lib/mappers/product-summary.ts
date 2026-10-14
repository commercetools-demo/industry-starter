// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// ProductProjection (in-store, tailored) plus standalone prices to the card model (workstream L; K and M reuse it).
import type { Attribute, ProductProjection } from '@commercetools/platform-sdk';
import { selectStandalonePrice } from '@/lib/store/standalone-price';
import type { PriceCandidate, ProductSummary, SelectedPrice } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

/** The shopper's market and branch: the same values `buildSearchRequest` and `selectStandalonePrice` use. */
export interface SummaryContext {
  locale: string;
  currency: string;
  country: string;
  branchChannelId: string | undefined;
  retailChannelId: string | undefined;
}

const attribute = (attrs: Attribute[] | undefined, name: string): unknown => attrs?.find((a) => a.name === name)?.value;
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const enumLabel = (v: unknown): string | undefined => {
  if (typeof v !== 'object' || v === null) return undefined;
  const { label, key } = v as { label?: unknown; key?: unknown };
  return text(label) ?? text(key);
};

/** Current price is the discounted one when a Product Discount applies; the old price is the undiscounted one. Never zero. */
export function pickPrice(selected: SelectedPrice | null): ProductSummary['price'] {
  if (!selected || selected.value.centAmount <= 0) return null;
  const current = selected.discounted && selected.discounted.centAmount > 0 ? selected.discounted : selected.value;
  const out: NonNullable<ProductSummary['price']> = { centAmount: current.centAmount, currencyCode: current.currencyCode, fractionDigits: current.fractionDigits };
  if (selected.discounted && selected.discounted.centAmount > 0) out.oldCentAmount = selected.value.centAmount;
  return out;
}

export function mapProductSummary(projection: ProductProjection, prices: readonly PriceCandidate[], ctx: SummaryContext): ProductSummary {
  const master = projection.masterVariant;
  const attrs = master.attributes;
  const name = getLocalizedString(projection.name, ctx.locale);
  const image = master.images?.[0];
  const channel = ctx.branchChannelId ? master.availability?.channels?.[ctx.branchChannelId] : undefined;
  const stats = projection.reviewRatingStatistics;
  const fitment = attribute(attrs, 'fitment-keys');
  const selected = selectStandalonePrice(prices, { currency: ctx.currency, country: ctx.country, channelIds: [ctx.branchChannelId, ctx.retailChannelId] });
  return {
    id: projection.id,
    sku: master.sku ?? '',
    slug: getLocalizedString(projection.slug, ctx.locale),
    name,
    brand: enumLabel(attribute(attrs, 'brand')) ?? text(attribute(attrs, 'brand-name')) ?? '',
    qualityLabel: enumLabel(attribute(attrs, 'quality-tier')),
    imageUrl: image?.url,
    imageAlt: text(image?.label) ?? name,
    rating: stats && stats.count > 0 ? { average: stats.averageRating, count: stats.count } : null,
    price: pickPrice(selected),
    stock: { atBranch: channel?.isOnStock === true, quantity: channel?.isOnStock === true ? (channel.availableQuantity ?? 0) : 0 },
    universalFit: attribute(attrs, 'universal-fit') === true,
    fitmentKeys: Array.isArray(fitment) ? fitment.filter((k): k is string => typeof k === 'string') : [],
    recurringEligible: attribute(attrs, 'recurring-eligible') === true,
    variantCount: 1 + (projection.variants?.length ?? 0),
  };
}
