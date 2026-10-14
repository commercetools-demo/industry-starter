// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { Attribute, ProductProjection } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import type { PriceCandidate } from '@/lib/types';
import { mapProductSummary, pickPrice, type SummaryContext } from './product-summary';

const ctx: SummaryContext = { locale: 'de-DE', currency: 'EUR', country: 'DE', branchChannelId: 'ch-branch', retailChannelId: 'ch-retail' };
const attrs = (list: Attribute[]) => list;
const projection = (over: Record<string, unknown> = {}): ProductProjection =>
  ({
    id: 'prod-1',
    version: 1,
    name: { 'de-DE': 'Vektra Bremsbelagsatz vorn', 'en-US': 'Vektra Front brake pad set' },
    slug: { 'de-DE': 'vektra-bremsbelagsatz-mlv-bp-41001', 'en-US': 'vektra-front-brake-pad-set-mlv-bp-41001' },
    masterVariant: {
      id: 1,
      sku: 'MLV-BP-41001',
      images: [{ url: 'https://images.example.test/p/1.jpg', label: 'Pad set', dimensions: { w: 800, h: 600 } }],
      attributes: attrs([
        { name: 'brand', value: { key: 'vektra', label: 'Vektra' } },
        { name: 'quality-tier', value: { key: 'premium', label: 'Premium aftermarket' } },
        { name: 'fitment-keys', value: ['Volkswagen|Golf|2012|2019|2.0 TDI'] },
        { name: 'universal-fit', value: false },
        { name: 'recurring-eligible', value: true },
      ]),
      availability: { channels: { 'ch-branch': { isOnStock: true, availableQuantity: 7 } } },
    },
    variants: [],
    reviewRatingStatistics: { averageRating: 4.5, highestRating: 5, lowestRating: 4, count: 2, ratingsDistribution: {} },
    ...over,
  }) as unknown as ProductProjection;
const price = (centAmount: number, over: Partial<PriceCandidate> = {}): PriceCandidate => ({ id: `p${centAmount}`, centAmount, currencyCode: 'EUR', fractionDigits: 2, country: 'DE', ...over });

describe('Product card data: lib/mappers/product-summary', () => {
  it('localized name, slug, brand and image', () => {
    const s = mapProductSummary(projection(), [price(5490)], ctx);
    expect(s).toMatchObject({
      id: 'prod-1',
      sku: 'MLV-BP-41001',
      name: 'Vektra Bremsbelagsatz vorn',
      slug: 'vektra-bremsbelagsatz-mlv-bp-41001',
      brand: 'Vektra',
      imageUrl: 'https://images.example.test/p/1.jpg',
      imageAlt: 'Pad set',
      variantCount: 1,
    });
    expect(mapProductSummary(projection(), [], { ...ctx, locale: 'en-US' }).name).toBe('Vektra Front brake pad set');
  });

  it('image alt falls back to the name and a missing image stays undefined', () => {
    const noImage = projection();
    (noImage.masterVariant as { images: unknown[] }).images = [];
    const s = mapProductSummary(noImage, [], ctx);
    expect(s.imageUrl).toBeUndefined();
    expect(s.imageAlt).toBe('Vektra Bremsbelagsatz vorn');
  });

  it('local parts take the brand from brand-name', () => {
    const local = projection();
    (local.masterVariant as { attributes: Attribute[] }).attributes = [{ name: 'brand-name', value: 'Küstenwerk' }];
    expect(mapProductSummary(local, [], ctx).brand).toBe('Küstenwerk');
  });

  it('current and old price from a discounted standalone price', () => {
    const s = mapProductSummary(projection(), [price(5490, { discounted: { centAmount: 4941, currencyCode: 'EUR', fractionDigits: 2 } })], ctx);
    expect(s.price).toEqual({ centAmount: 4941, currencyCode: 'EUR', fractionDigits: 2, oldCentAmount: 5490 });
  });

  it('plain price has no old price', () => {
    expect(mapProductSummary(projection(), [price(5490)], ctx).price).toEqual({ centAmount: 5490, currencyCode: 'EUR', fractionDigits: 2 });
  });

  it('no price maps to null', () => {
    expect(mapProductSummary(projection(), [], ctx).price).toBeNull();
    expect(pickPrice(null)).toBeNull();
  });

  it('zero price maps to null', () => {
    expect(mapProductSummary(projection(), [price(0)], ctx).price).toBeNull();
    expect(pickPrice({ value: { centAmount: 0, currencyCode: 'EUR', fractionDigits: 2 } })).toBeNull();
  });

  it('branch price is shown for the selected branch', () => {
    const prices = [price(5490), price(5000, { channelId: 'ch-retail' }), price(4800, { channelId: 'ch-branch' })];
    expect(mapProductSummary(projection(), prices, ctx).price?.centAmount).toBe(4800);
    expect(mapProductSummary(projection(), prices, { ...ctx, branchChannelId: 'ch-other' }).price?.centAmount).toBe(5000);
  });

  it('stock at branch', () => {
    expect(mapProductSummary(projection(), [], ctx).stock).toEqual({ atBranch: true, quantity: 7 });
    expect(mapProductSummary(projection(), [], { ...ctx, branchChannelId: 'ch-other' }).stock).toEqual({ atBranch: false, quantity: 0 });
    expect(mapProductSummary(projection(), [], { ...ctx, branchChannelId: undefined }).stock.atBranch).toBe(false);
  });

  it('rating hidden when no reviews', () => {
    expect(mapProductSummary(projection(), [], ctx).rating).toEqual({ average: 4.5, count: 2 });
    expect(mapProductSummary(projection({ reviewRatingStatistics: undefined }), [], ctx).rating).toBeNull();
    expect(mapProductSummary(projection({ reviewRatingStatistics: { averageRating: 0, count: 0 } }), [], ctx).rating).toBeNull();
  });

  it('reads range keys and universal fit', () => {
    const s = mapProductSummary(projection(), [], ctx);
    expect(s.fitmentKeys).toEqual(['Volkswagen|Golf|2012|2019|2.0 TDI']);
    expect(s.universalFit).toBe(false);
    const universal = projection();
    (universal.masterVariant as { attributes: Attribute[] }).attributes = [{ name: 'universal-fit', value: true }];
    expect(mapProductSummary(universal, [], ctx)).toMatchObject({ universalFit: true, fitmentKeys: [] });
  });

  it('reads recurring-eligible', () => {
    expect(mapProductSummary(projection(), [], ctx).recurringEligible).toBe(true);
    const none = projection();
    (none.masterVariant as { attributes: Attribute[] }).attributes = [];
    expect(mapProductSummary(none, [], ctx).recurringEligible).toBe(false);
  });

  it('counts the variants', () => {
    expect(mapProductSummary(projection({ variants: [{ id: 2, sku: 'x' }] }), [], ctx).variantCount).toBe(2);
  });
});
