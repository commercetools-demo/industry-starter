import { describe, expect, it } from 'vitest';
import { mapScanProduct } from '@/lib/mappers/scan-product';
import { coffeePage, podPage, stock, usd, variantView } from '@/test/pdp';
import type { VariantTranslator } from '@/lib/cart/summary';

const t: VariantTranslator = (key, v) =>
  key === 'variant.intensity' ? `Intensity ${v.n}` : key === 'variant.capsules' ? `${v.count} capsules` : `${v.n} g`;

describe('mapScanProduct (workstream R)', () => {
  it('shows image, name, variant attributes, price and availability of the scanned variant', () => {
    const p = mapScanProduct(podPage(), 'POD-50', t);
    expect(p).toMatchObject({
      sku: 'POD-50', name: 'Ember Ristretto', variant: 'Intensity 12 · 50 capsules', price: { amount: usd(2595) },
      availability: { state: 'in', quantity: 50 }, href: '/p/ember-ristretto/POD-50', imageUrl: 'https://img.example.com/pack.jpg',
    });
    expect(p?.price?.old).toBeUndefined();
  });

  it('the scanned variant, not the default one, decides the attributes', () => {
    expect(mapScanProduct(coffeePage(), 'COF-1K-FIL', t)?.variant).toBe('1000 g · Filter');
    expect(mapScanProduct(coffeePage(), 'COF-250-WB', t)?.variant).toBe('250 g · Whole bean');
  });

  it('a discounted price is the price, the list price is the old one', () => {
    const page = podPage();
    page.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { images: [] });
    page.product.variants[0]!.price = { value: usd(590), discounted: usd(500), tiers: [] };
    expect(mapScanProduct(page, 'POD-10', t)?.price).toEqual({ amount: usd(500), old: usd(590) });
  });

  it('Out of stock: state out and zero quantity', () => {
    const page = podPage();
    page.product.variants[1] = variantView('POD-50', { capsulesPerPack: 50 }, 2595, { stock: stock({ online: 0 }) });
    expect(mapScanProduct(page, 'POD-50', t)?.availability).toEqual({ state: 'out', quantity: 0 });
  });

  it('Low stock is flagged at or below the threshold', () => {
    const page = podPage();
    page.product.variants[1] = variantView('POD-50', { capsulesPerPack: 50 }, 2595, { stock: stock({ online: 3 }) });
    const p = mapScanProduct(page, 'POD-50', t);
    expect(p?.availability).toEqual({ state: 'low', quantity: 3 });
    expect(p?.maxQuantity).toBe(3);
  });

  it('a failed stock read never claims stock', () => {
    const p = mapScanProduct(podPage({ inventoryFailed: true }), 'POD-10', t);
    expect(p?.inventoryFailed).toBe(true);
    expect(p?.availability).toEqual({ state: 'out', quantity: 0 });
  });

  it('a variant with no price has price null', () => {
    const page = podPage();
    page.product.variants[2] = variantView('POD-100', { capsulesPerPack: 100 }, null);
    expect(mapScanProduct(page, 'POD-100', t)?.price).toBeNull();
  });

  it('a SKU that is not a variant of the product is null', () => {
    expect(mapScanProduct(podPage(), 'NOPE', t)).toBeNull();
  });

  it('the quantity limits follow the inventory cart limits', () => {
    const page = podPage();
    page.product.variants[0] = variantView('POD-10', { capsulesPerPack: 10 }, 590, { stock: stock({ online: 50, minQty: 2, maxQty: 6 }) });
    const p = mapScanProduct(page, 'POD-10', t);
    expect([p?.minQuantity, p?.maxQuantity]).toEqual([2, 6]);
  });

  it('falls back to another variant image when the scanned one has none', () => {
    const page = podPage();
    page.product.variants[2] = variantView('POD-100', { capsulesPerPack: 100 }, 4720, { images: [] });
    expect(mapScanProduct(page, 'POD-100', t)?.imageUrl).toBe('https://img.example.com/pack.jpg');
  });
});
