// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ProductProjection } from '@commercetools/platform-sdk';
import { describe, expect, it } from 'vitest';
import { mapProductDetail } from '@/lib/mappers/product-detail';
import type { PriceCandidate } from '@/lib/types';

const ctx = { locale: 'en-US', currency: 'USD', country: 'US', branchChannelId: 'branch-1', retailChannelId: 'retail-1' };
const attr = (name: string, value: unknown) => ({ name, value });
const masterAttrs = [
  attr('part-number', 'BP-41001'),
  attr('brand', { key: 'vektra', label: 'Vektra' }),
  attr('quality-tier', { key: 'oem', label: 'OEM' }),
  attr('position', { key: 'front', label: 'Front' }),
  attr('size-spec', '312 mm'),
  attr('warranty-months', 24),
  attr('oem-numbers', ['5Q0 698 151', '5Q0 698 151 A']),
  attr('fitment-keys', ['Volkswagen|Golf|2012|2019|2.0 TDI']),
  attr('universal-fit', false),
  attr('recurring-eligible', true),
];
const image = (url: string, label?: string) => ({ url, label, dimensions: { w: 1200, h: 900 } });
const projection = (over: Partial<ProductProjection> & { attrs?: ReturnType<typeof attr>[]; images?: ReturnType<typeof image>[]; availability?: unknown } = {}): ProductProjection =>
  ({
    id: 'p1',
    name: { 'en-US': 'Master name' },
    description: { 'en-US': 'Master text' },
    slug: { 'en-US': 'front-brake-pads' },
    categories: [],
    masterVariant: { id: 1, sku: 'MLV-BP-41001', attributes: over.attrs ?? masterAttrs, images: over.images ?? [image('https://img/master.jpg')], availability: over.availability },
    variants: [],
    ...over,
  }) as unknown as ProductProjection;
const master = projection();
const price = (over: Partial<PriceCandidate>): PriceCandidate => ({ id: 'x', centAmount: 5000, currencyCode: 'USD', fractionDigits: 2, ...over });

describe('mapProductDetail', () => {
  it('tailored name and description win', () => {
    const tailored = projection({ name: { 'en-US': 'Küstenwerk pads' }, description: { 'en-US': 'Reseller text' } });
    const d = mapProductDetail({ tailored, master }, [], ctx);
    expect(d.name).toBe('Küstenwerk pads');
    expect(d.description).toBe('Reseller text');
  });

  it('master name when no tailoring', () => {
    const d = mapProductDetail({ tailored: master, master }, [], ctx);
    expect(d.name).toBe('Master name');
    expect(d.description).toBe('Master text');
  });

  it('empty description maps to null', () => {
    const d = mapProductDetail({ tailored: projection({ description: undefined }), master }, [], ctx);
    expect(d.description).toBeNull();
  });

  it('tailored images win when present', () => {
    const tailored = projection({ images: [image('https://img/tailored.jpg')] });
    expect(mapProductDetail({ tailored, master }, [], ctx).images.map((i) => i.url)).toEqual(['https://img/tailored.jpg']);
    const noImages = projection({ images: [] });
    expect(mapProductDetail({ tailored: noImages, master }, [], ctx).images.map((i) => i.url)).toEqual(['https://img/master.jpg']);
  });

  it('image alt falls back to the name', () => {
    const d = mapProductDetail({ tailored: projection({ images: [image('https://i/a.jpg', 'Front view'), image('https://i/b.jpg')] }), master }, [], ctx);
    expect(d.images.map((i) => i.alt)).toEqual(['Front view', 'Master name']);
    expect(d.images[0]).toMatchObject({ width: 1200, height: 900 });
  });

  it('part number fitment and specs ignore tailored attributes', () => {
    const tailored = projection({ attrs: [attr('part-number', 'FAKE-1'), attr('fitment-keys', ['Audi|A4|2010|2012|1.8']), attr('universal-fit', true), attr('size-spec', '999 mm')] });
    const d = mapProductDetail({ tailored, master }, [], ctx);
    expect(d.partNumber).toBe('BP-41001');
    expect(d.fitmentKeys).toEqual(['Volkswagen|Golf|2012|2019|2.0 TDI']);
    expect(d.universalFit).toBe(false);
    expect(d.specs.find((s) => s.name === 'size-spec')?.value).toBe('312 mm');
    expect(d.oeNumbers).toEqual(['5Q0 698 151', '5Q0 698 151 A']);
    expect(d.brand).toBe('Vektra');
    expect(d.qualityLabel).toBe('OEM');
    expect(d.recurringEligible).toBe(true);
  });

  it('specs skip empty and keep order', () => {
    const d = mapProductDetail({ tailored: master, master }, [], ctx);
    expect(d.specs.map((s) => s.name)).toEqual(['part-number', 'brand', 'quality-tier', 'position', 'size-spec', 'warranty-months', 'oem-numbers']);
    const sparse = projection({ attrs: [attr('part-number', 'X-1'), attr('size-spec', ' '), attr('warranty-months', 12)] });
    expect(mapProductDetail({ tailored: sparse, master: sparse }, [], ctx).specs).toEqual([
      { name: 'part-number', value: 'X-1' },
      { name: 'warranty-months', value: '12' },
    ]);
  });

  it('price is the branch standalone price, else the retail channel price, else the base price', () => {
    const base = price({ id: 'base', centAmount: 5000 });
    const retail = price({ id: 'retail', centAmount: 4900, channelId: 'retail-1' });
    const branch = price({ id: 'branch', centAmount: 4700, channelId: 'branch-1' });
    expect(mapProductDetail({ tailored: master, master }, [base, retail, branch], ctx).price?.centAmount).toBe(4700);
    expect(mapProductDetail({ tailored: master, master }, [base, retail], ctx).price?.centAmount).toBe(4900);
    expect(mapProductDetail({ tailored: master, master }, [base], ctx).price?.centAmount).toBe(5000);
  });

  it('old price only for a discounted price, and the save amount is the difference', () => {
    const discounted = price({ centAmount: 5000, discounted: { centAmount: 4500, currencyCode: 'USD', fractionDigits: 2 } });
    const d = mapProductDetail({ tailored: master, master }, [discounted], ctx);
    expect(d.price).toMatchObject({ centAmount: 4500, oldCentAmount: 5000 });
    expect((d.price?.oldCentAmount ?? 0) - (d.price?.centAmount ?? 0)).toBe(500);
    expect(mapProductDetail({ tailored: master, master }, [price({})], ctx).price?.oldCentAmount).toBeUndefined();
  });

  it('no price maps to null', () => {
    expect(mapProductDetail({ tailored: master, master }, [], ctx).price).toBeNull();
    expect(mapProductDetail({ tailored: master, master }, [price({ currencyCode: 'EUR' })], ctx).price).toBeNull();
  });

  it('stock comes from the branch channel of the tailored projection', () => {
    const tailored = projection({ availability: { channels: { 'branch-1': { isOnStock: true, availableQuantity: 7 }, other: { isOnStock: true, availableQuantity: 99 } } } });
    expect(mapProductDetail({ tailored, master }, [], ctx).stock).toEqual({ atBranch: true, quantity: 7 });
    expect(mapProductDetail({ tailored: master, master }, [], ctx).stock).toEqual({ atBranch: false, quantity: 0 });
  });

  it('rating comes from the review statistics, null without reviews', () => {
    const rated = projection({ reviewRatingStatistics: { averageRating: 4.5, highestRating: 5, lowestRating: 3, count: 4, ratingsDistribution: {} } });
    expect(mapProductDetail({ tailored: rated, master }, [], ctx).rating).toEqual({ average: 4.5, count: 4 });
    expect(mapProductDetail({ tailored: master, master }, [], ctx).rating).toBeNull();
  });

  it('category trail is root first up to the deepest category', () => {
    const cat = (id: string, name: string, ancestors: unknown[] = []) => ({ obj: { id, name: { 'en-US': name }, slug: { 'en-US': name.toLowerCase() }, ancestors } });
    const root = cat('c1', 'Brakes');
    const leaf = cat('c2', 'Pads', [root]);
    const tailored = projection({ categories: [root, leaf] as never });
    expect(mapProductDetail({ tailored, master }, [], ctx).categoryTrail.map((c) => c.slug)).toEqual(['brakes', 'pads']);
  });

  it('the sku picks a variant and falls back to the master variant', () => {
    const tailored = {
      ...projection(),
      variants: [{ id: 2, sku: 'V2', attributes: [], images: [image('https://img/v2.jpg')] }],
    } as unknown as ProductProjection;
    const d = mapProductDetail({ tailored, master: tailored }, [], ctx, 'V2');
    expect(d.sku).toBe('V2');
    expect(d.images[0].url).toBe('https://img/v2.jpg');
    expect(d.variants.map((v) => v.sku)).toEqual(['MLV-BP-41001', 'V2']);
    expect(mapProductDetail({ tailored, master: tailored }, [], ctx, 'NOPE').sku).toBe('MLV-BP-41001');
  });
});
