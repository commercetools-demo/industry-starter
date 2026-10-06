import { describe, it, expect } from 'vitest';
import type { Attribute, ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import weighed from './__fixtures__/product-weighed.json';
import each from './__fixtures__/product-each.json';
import { mapProduct } from './product';

const de = { locale: 'de-DE', currency: 'EUR', country: 'DE' };
const us = { locale: 'en-US', currency: 'USD', country: 'US' };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** Intersection drops `readonly`, so tests can edit a cloned fixture. */
type Editable = ProductProjection & {
  name: Record<string, string>;
  masterVariant: { price?: ProductVariant['price']; availability?: ProductVariant['availability']; attributes?: Attribute[] };
};
const fixture = (f: unknown): Editable => clone(f) as Editable;

describe('mapProduct', () => {
  it('weighed variant: increment 500 g, label, approximateWeight', () => {
    const product = mapProduct(fixture(weighed), us);
    const first = product.variants[0];
    expect(product.type).toBe('Product');
    expect(first.sku).toBe('BANANAS-500G');
    expect(first.increment).toEqual({ value: 500, unit: 'g', label: '500 g' });
    expect(first.approximateWeight).toBe(true);
    expect(product.variants[1].increment).toEqual({ value: 1, unit: 'kg', label: '1 kg' });
    expect(first.images).toEqual(['https://picsum.photos/seed/bananas-500g/800/800']);
  });

  it('product-level attributes come from the master variant', () => {
    const product = mapProduct(fixture(weighed), us);
    expect(product).toMatchObject({
      key: 'bananas',
      name: 'Bananas',
      slug: 'bananas',
      brand: 'Orchard Fresh',
      origin: 'Various',
      storage: 'ambient',
      dietary: ['vegan', 'organic'],
      allergens: [],
      recurringEligible: false,
    });
    expect(product.categoryIds).toHaveLength(1);
    expect(product.substituteProductIds).toEqual(['bf2c6db0-6dd0-43d1-a7d1-65f9f4731dc6']);
    expect(product.variants[0].attributes.incrementUnit).toBe('g');
  });

  it('each product: unit each, not approximate', () => {
    const product = mapProduct(fixture(each), us);
    expect(product.variants[0].increment.unit).toBe('each');
    expect(product.variants[0].approximateWeight).toBe(false);
  });

  it('price: scoped variant price, no discount by default', () => {
    const product = mapProduct(fixture(weighed), de);
    expect(product.variants[0].price).toEqual({ centAmount: 134, currencyCode: 'EUR' });
  });

  it('missing price: price is undefined', () => {
    const projection = fixture(weighed);
    delete projection.masterVariant.price;
    expect(mapProduct(projection, de).variants[0].price).toBeUndefined();
  });

  it('discounted price: maps the discounted money', () => {
    const projection = fixture(weighed);
    projection.masterVariant.price = {
      id: 'p',
      value: { type: 'centPrecision', currencyCode: 'EUR', centAmount: 200, fractionDigits: 2 },
      discounted: {
        value: { type: 'centPrecision', currencyCode: 'EUR', centAmount: 150, fractionDigits: 2 },
        discount: { typeId: 'product-discount', id: 'd' },
      },
    };
    expect(mapProduct(projection, de).variants[0].price).toEqual({
      centAmount: 200,
      currencyCode: 'EUR',
      discounted: { centAmount: 150, currencyCode: 'EUR' },
    });
  });

  it('de-DE: localized strings use the German value', () => {
    const product = mapProduct(fixture(weighed), de);
    expect(product.name).toBe('Bananen');
    expect(product.slug).toBe('bananas-de');
    expect(product.description).toMatch(/^Bananen von/);
  });

  it('de-DE with a missing translation: falls back to another locale', () => {
    const projection = fixture(weighed);
    delete (projection.name as Record<string, string>)['de-DE'];
    delete (projection.masterVariant.attributes?.find((a) => a.name === 'packLabel')?.value as Record<string, string>)['de-DE'];
    const product = mapProduct(projection, de);
    expect(product.name).toBe('Bananas');
    expect(product.variants[0].increment.label).toBe('500 g');
  });

  it('availability: maps stock and defaults the quantity to 0', () => {
    const projection = fixture(weighed);
    expect(mapProduct(projection, us).variants[0].availability).toEqual({ isOnStock: true, availableQuantity: 50 });
    delete projection.masterVariant.availability;
    expect(mapProduct(projection, us).variants[0].availability).toEqual({ isOnStock: false, availableQuantity: 0 });
    projection.masterVariant.availability = { isOnStock: true };
    expect(mapProduct(projection, us).variants[0].availability).toEqual({ isOnStock: true, availableQuantity: 0 });
  });

  it('missing increment attributes: defaults to one each', () => {
    const projection = fixture(each);
    projection.masterVariant.attributes = [];
    expect(mapProduct(projection, us).variants[0].increment).toEqual({ value: 1, unit: 'each', label: '' });
  });
});
