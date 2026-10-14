// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { buildProductJsonLd, serializeJsonLd } from '@/lib/product/json-ld';
import type { ProductDetail } from '@/lib/types';

const product = (over: Partial<ProductDetail> = {}): ProductDetail => ({
  id: 'p1',
  slug: 's',
  sku: 'SKU-1',
  variants: [{ sku: 'SKU-1' }],
  name: 'Brake pads',
  description: 'Text',
  images: [{ url: 'https://img/a.jpg', alt: 'a', width: 1, height: 1 }],
  brand: 'Vektra',
  partNumber: 'BP-1',
  oeNumbers: [],
  rating: { average: 4.5, count: 3 },
  price: { centAmount: 4590, currencyCode: 'EUR', fractionDigits: 2 },
  stock: { atBranch: true, quantity: 3 },
  specs: [],
  universalFit: false,
  fitmentKeys: [],
  recurringEligible: false,
  relatedSkus: [],
  categoryTrail: [],
  ...over,
});

describe('product JSON-LD', () => {
  it('json-ld escapes script closing', () => {
    const json = serializeJsonLd(buildProductJsonLd(product({ name: '</script><script>alert(1)</script>' }), 'https://x/p'));
    expect(json).not.toContain('<');
    expect(JSON.parse(json).name).toBe('</script><script>alert(1)</script>');
  });
  it('has the offer with the ISO currency and the amount', () => {
    const data = buildProductJsonLd(product(), 'https://x/p') as { offers: Record<string, string>; brand: { name: string } };
    expect(data.offers).toMatchObject({ price: '45.90', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' });
    expect(data.brand.name).toBe('Vektra');
  });
  it('json-ld has no offers without a price', () => {
    expect(buildProductJsonLd(product({ price: null }), 'https://x/p')).not.toHaveProperty('offers');
  });
  it('availability follows the branch stock', () => {
    const data = buildProductJsonLd(product({ stock: { atBranch: false, quantity: 0 } }), 'https://x/p') as { offers: { availability: string } };
    expect(data.offers.availability).toBe('https://schema.org/BackOrder');
  });
  it('rating only with reviews', () => {
    expect(buildProductJsonLd(product({ rating: null }), 'u')).not.toHaveProperty('aggregateRating');
  });
});
