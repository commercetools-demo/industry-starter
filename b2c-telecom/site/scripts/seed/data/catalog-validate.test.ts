import { describe, expect, it } from 'vitest';
import { MANIFEST } from '.';
import type { ProductDraft, SeedManifest } from '../types';
import { localeGaps, priceErrors, referenceErrors, skuErrors, validateCatalog } from './catalog-validate';

function offer(): ProductDraft {
  const found = (MANIFEST.product as ProductDraft[]).find((p) => p.key === 'malva-offer-cable-500');
  return structuredClone(found as ProductDraft);
}

describe('catalog validation', () => {
  it('the seed manifest is valid', () => {
    expect(validateCatalog(MANIFEST)).toEqual([]);
  });

  it('rejects an SKU outside the pattern and a variant key that is not the lower-cased SKU', () => {
    const bad = offer();
    bad.masterVariant.sku = 'mlv-bad';
    expect(skuErrors([bad]).length).toBe(2);
  });

  it('finds a missing locale in a nested localized string', () => {
    expect(localeGaps({ a: [{ 'en-US': 'x' }] }, 'root')).toEqual(['root.a[0]: missing de-DE']);
  });

  it('finds a missing market price and a zero price', () => {
    const bad = offer();
    bad.masterVariant.prices = bad.masterVariant.prices.filter((p) => p.value.currencyCode !== 'EUR');
    bad.variants[0].prices[0].value.centAmount = 0;
    const errors = priceErrors([bad]);
    expect(errors.some((e) => e.includes('no EUR/DE price'))).toBe(true);
    expect(errors.some((e) => e.includes('zero price'))).toBe(true);
  });

  it('finds a relation to a product that does not exist', () => {
    const bad = offer();
    bad.masterVariant.attributes = [...bad.masterVariant.attributes, { name: 'conflicts-with', value: ['malva-offer-nothing'] }];
    expect(referenceErrors([...(MANIFEST.product as ProductDraft[]).filter((p) => p.key !== bad.key), bad])).toEqual(['malva-offer-cable-500.conflicts-with names "malva-offer-nothing", which does not exist']);
  });

  it('finds a key without the malva- prefix', () => {
    const manifest: SeedManifest = { category: [{ key: 'cat-x' } as never] };
    expect(validateCatalog(manifest)).toContain('category key "cat-x" has no malva- prefix');
  });
});
