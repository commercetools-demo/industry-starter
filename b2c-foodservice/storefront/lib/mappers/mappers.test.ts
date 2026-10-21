import { describe, expect, it } from 'vitest';
import type { Category as SDKCategory, ProductProjection } from '@commercetools/platform-sdk';
import pod from './__fixtures__/pod-product.json';
import noReviews from './__fixtures__/no-reviews-product.json';
import discounted from './__fixtures__/discounted-product.json';
import categories from './__fixtures__/categories.json';
import { mapProduct } from '@/lib/mappers/product';
import { mapRatingStats } from '@/lib/mappers/rating';
import { mapAttributes } from '@/lib/mappers/attribute';
import { pickPrice } from '@/lib/mappers/price';
import { buildCategoryTree, mapCategory } from '@/lib/mappers/category';
import { roundRating } from '@/lib/utils';

const us = { locale: 'en-US', country: 'US', currency: 'USD' };
const ca = { locale: 'en-CA', country: 'CA', currency: 'CAD' };
const asProduct = (j: unknown) => j as ProductProjection;

describe('product mapper', () => {
  it('Card rating: 12 reviews averaging 4.58333 map to average 4.58333 and count 12 (display 4.6)', () => {
    const p = mapProduct(asProduct(pod), us);
    expect(p.rating).toEqual({ average: 4.58333, count: 12, distribution: { 1: 0, 2: 0, 3: 1, 4: 3, 5: 8 } });
    expect(roundRating(p.rating!.average)).toBe(4.6);
  });

  it('No reviews: count 0 or absent statistics map to undefined rating', () => {
    expect(mapProduct(asProduct(noReviews), us).rating).toBeUndefined();
    expect(mapRatingStats(undefined)).toBeUndefined();
    expect('rating' in mapProduct(asProduct(noReviews), us)).toBe(false);
  });

  it('Price is the session country and currency price', () => {
    const p = mapProduct(asProduct(pod), us);
    expect(p.masterVariant.price).toEqual({ value: { centAmount: 495, currencyCode: 'USD' } });
  });

  it('Discounted price is exposed as discounted', () => {
    const p = mapProduct(asProduct(discounted), us);
    expect(p.masterVariant.price).toEqual({
      value: { centAmount: 1800, currencyCode: 'USD' },
      discounted: { centAmount: 1500, currencyCode: 'USD' },
      discountName: 'Spring sale',
    });
  });

  it('Price falls back to the prices array when no scoped price is present', () => {
    const variant = asProduct(pod).variants[0];
    expect(pickPrice(variant, ca)?.value).toEqual({ centAmount: 2400, currencyCode: 'CAD' });
    expect(pickPrice(variant, us)?.value).toEqual({ centAmount: 2000, currencyCode: 'USD' });
    expect(pickPrice(variant, { country: 'US', currency: 'EUR' })).toBeUndefined();
  });

  it('Enum, lenum, ltext and set attributes map to AttributeValue', () => {
    const attrs = mapAttributes(asProduct(pod).masterVariant.attributes, us.locale);
    expect(attrs.capsules).toBe(10);
    expect(attrs.roast).toEqual({ key: 'dark', label: 'Dark' });
    expect(attrs.intensity).toEqual({ key: '11', label: 'Eleven' });
    expect(attrs.notes).toEqual(['cocoa', 'spice']);
    expect(attrs.subscribable).toBe(true);
  });

  it('Unsupported attribute types are dropped', () => {
    const attrs = mapAttributes(asProduct(pod).masterVariant.attributes, us.locale);
    expect(attrs).not.toHaveProperty('origin');
    expect(attrs).not.toHaveProperty('cost');
    expect(mapAttributes([{ name: 'refs', value: [{ typeId: 'product', id: '1' }] }], 'en-US')).toEqual({});
  });

  it('Product-level attributes override master variant attributes', () => {
    const p = mapProduct(asProduct(pod), us);
    expect(p.attributes.badge).toEqual({ key: 'bestseller', label: 'Bestseller' });
    expect(p.masterVariant.attributes.badge).toEqual({ key: 'new', label: 'New' });
    expect(p.attributes.capsules).toBe(10);
  });

  it('Product name is localized with fallback', () => {
    expect(mapProduct(asProduct(pod), ca).name).toBe('Ristretto Pods');
    expect(mapProduct(asProduct(discounted), ca).name).toBe('Discounted Beans CA');
    expect(mapProduct(asProduct(discounted), us).name).toBe('Discounted Beans');
  });

  it('maps ids, key, type key, categories, availability and images', () => {
    const p = mapProduct(asProduct(pod), us);
    expect(p).toMatchObject({
      id: 'p-pod-1', key: 'mcf-pod-ristretto', productTypeKey: 'mcf-pods', slug: 'ristretto-pods',
      categoryIds: ['cat-pods'],
    });
    expect(p.masterVariant.availability).toEqual({ isOnStock: true, availableQuantity: 40 });
    expect(p.masterVariant.images[0]).toEqual({
      url: 'https://img.example.com/ris.jpg', width: 1000, height: 1200, alt: 'Pack shot',
    });
    expect(p.variants).toHaveLength(1);
  });

  it('Mapped output contains no SDK-only fields', () => {
    const p = mapProduct(asProduct(pod), us);
    expect(Object.keys(p).sort()).toEqual(
      ['attributes', 'categoryIds', 'description', 'id', 'key', 'masterVariant', 'name', 'productTypeKey', 'rating', 'slug', 'variants'],
    );
    expect(Object.keys(p.masterVariant).sort()).toEqual(['attributes', 'availability', 'id', 'images', 'price', 'sku']);
    expect(Object.keys(p.masterVariant.price!)).toEqual(['value']);
    expect(Object.keys(p.masterVariant.price!.value).sort()).toEqual(['centAmount', 'currencyCode']);
    expect(JSON.stringify(p)).not.toMatch(/version|fractionDigits|typeId|lastModifiedAt/);
  });
});

describe('category mapper', () => {
  const flat = () => (categories as unknown as SDKCategory[]).map((c) => mapCategory(c, 'en-US'));

  it('mapCategory localizes and cleans the asset image', () => {
    const coffee = flat().find((c) => c.id === 'c-root-a')!;
    expect(coffee).toMatchObject({
      name: 'Coffee', slug: 'coffee', description: 'All coffee', imageUrl: 'https://img.example.com/coffee.jpg',
    });
    expect(flat().find((c) => c.id === 'c-pods')?.parentId).toBe('c-root-a');
  });

  it('Category tree is built from a flat list and sorted by orderHint', () => {
    const tree = buildCategoryTree(flat());
    expect(tree.map((c) => c.id)).toEqual(['c-root-a', 'c-root-b', 'c-orphan']);
    expect(tree[0].children.map((c) => c.id)).toEqual(['c-beans', 'c-pods']);
    expect(tree[0].children[1].children.map((c) => c.id)).toEqual(['c-decaf']);
  });

  it('orphans become roots and the input is not mutated', () => {
    const input = flat();
    buildCategoryTree(input);
    expect(input.every((c) => c.children.length === 0)).toBe(true);
  });
});
