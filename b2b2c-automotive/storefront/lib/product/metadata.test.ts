// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { buildProductMetadata, DESCRIPTION_MAX, metaDescription } from '@/lib/product/metadata';
import type { ProductDetail } from '@/lib/types';

const product = { name: 'Brake pads', partNumber: 'BP-1', slug: 'brake-pads', description: 'Short text', images: [{ url: 'https://img/a.jpg', alt: '', width: 1, height: 1 }] } as ProductDetail;

describe('product metadata', () => {
  it('metadata uses name and part number', () => {
    const m = buildProductMetadata(product, 'fallback', { origin: 'https://shop.example', locale: 'en-US', store: 'mau-reseller-north' });
    expect(m.title).toBe('Brake pads (BP-1)');
    expect(m.description).toBe('Short text');
    expect(m.alternates?.canonical).toBe('https://shop.example/en-US/mau-reseller-north/p/brake-pads');
    expect(JSON.stringify(m.openGraph)).toContain('https://img/a.jpg');
  });
  it('description is cut to 155 characters on a word', () => {
    const long = `${'word '.repeat(60)}end`;
    const cut = metaDescription(long);
    expect(cut.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(cut.endsWith('word')).toBe(true);
  });
  it('falls back without a description and uses a relative canonical without an origin', () => {
    const m = buildProductMetadata({ ...product, description: null, images: [] }, 'fallback', { origin: null, locale: 'de-DE', store: 's1' });
    expect(m.description).toBe('fallback');
    expect(m.alternates?.canonical).toBe('/de-DE/s1/p/brake-pads');
    expect(JSON.stringify(m.openGraph)).not.toContain('images');
  });
});
