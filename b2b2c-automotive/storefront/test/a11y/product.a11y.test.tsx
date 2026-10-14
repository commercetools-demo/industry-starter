// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Y: page-level axe for the product page (no vehicle, fits, does not fit, out of stock, bundle, reviews and the review form,
// the subscribe option, no photos).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detail, GOLF_2016, summary } from '@/components/product/detail/test-fixtures';
import type { ProductPageResult } from '@/lib/product/load';
import type { ReviewItem } from '@/lib/types';
import { stateOf } from '@/test/vehicle';
import { axePage, LOCALES, renderStorePage, stubShellFetch, type Locale } from '@/test/a11y';

const load = vi.hoisted(() => vi.fn());
vi.mock('@/lib/product/load', () => ({ getProductPage: load, DEFAULT_RETURN_DAYS: 30 }));
vi.mock('@/lib/product/origin', () => ({ requestOrigin: async () => 'https://shop.example' }));
vi.mock('next-intl/server', async () => ({ setRequestLocale: () => undefined }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());

import { ProductPage } from '@/components/product/ProductPage';

const reviews: ReviewItem[] = [
  { id: 'r1', author: 'Lena K.', rating: 5, title: 'Leise', text: 'Passt gut.', createdAt: '2026-09-30T10:00:00.000Z' },
  { id: 'r2', author: 'Marc T.', rating: 4, title: 'Gut', text: 'Solide.', createdAt: '2026-09-01T10:00:00.000Z', reply: { text: 'Danke!', by: 'Küstenwerk' } },
];

const ok = (over: Partial<Extract<ProductPageResult, { kind: 'ok' }>> = {}): ProductPageResult => ({
  kind: 'ok',
  product: detail({ recurringEligible: true }),
  related: [summary(), summary({ id: 'r2', sku: 'MLV-BD-42002', slug: 'vektra-brake-disc-2', imageUrl: 'data:image/svg+xml;base64,PHN2Zy8+' })],
  reviews,
  reviewForm: 'eligible',
  bundle: null,
  branch: { name: 'Küstenwerk Hamburg-Harburg', address: { street: 'Harburger Ring 1', postalCode: '21073', city: 'Hamburg' }, pickup: 'today' },
  canChangeStore: true,
  shipDays: { min: 2, max: 3 },
  sellerName: 'Küstenwerk Autoteile',
  returnDays: 30,
  subscriptionsEnabled: true,
  alternativesHref: '/mau-reseller-north/category/brakes',
  ...over,
});

async function show(result: ProductPageResult, locale: Locale, theme: 'default' | 'themed' = 'default', vehicle?: string) {
  load.mockResolvedValue(result);
  const element = await ProductPage({ locale, store: 'mau-reseller-north', slug: 'vektra-front-brake-pad-set' });
  stubShellFetch({ '/api/subscriptions/policies': { policies: [{ key: 'mau-rp-monthly', label: 'Monatlich' }] } });
  renderStorePage(<>{element}</>, { locale, theme, fallback: vehicle ? { '/api/garage': stateOf(vehicle) } : {} });
}

beforeEach(() => load.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe.each(LOCALES)('a11y: product page (%s)', (locale) => {
  it.each(['default', 'themed'] as const)('no vehicle, reviews and the review form, subscribe option, %s theme', async (theme) => {
    await show(ok(), locale, theme);
    expect(await axePage()).toHaveNoViolations();
  });

  it('a fitting vehicle', async () => {
    await show(ok(), locale, 'default', GOLF_2016);
    expect(await axePage()).toHaveNoViolations();
  });

  it('a vehicle the part does not fit', async () => {
    await show(ok({ product: detail({ fitmentKeys: ['Audi|A4|2008|2012|1.8 TFSI'] }) }), locale, 'default', GOLF_2016);
    expect(await axePage()).toHaveNoViolations();
  });

  it('out of stock, no price, no photos, no reviews, signed-out review prompt', async () => {
    await show(ok({ product: detail({ price: null, images: [], stock: { atBranch: false, quantity: 0 }, rating: null, description: null, recurringEligible: false }), reviews: [], reviewForm: 'signed-out', related: [] }), locale);
    expect(await axePage()).toHaveNoViolations();
  });

  it('a bundle with its components', async () => {
    await show(ok({ product: detail({ bundleComponents: [{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }] }), bundle: { available: 3, components: [{ sku: 'A', qty: 2, name: 'Bremsbelag', inStore: true }, { sku: 'B', qty: 1, name: 'Bremsscheibe', inStore: true }] } }), locale);
    expect(await axePage()).toHaveNoViolations();
  });

  it('a bundle that is unavailable', async () => {
    await show(ok({ product: detail({ bundleComponents: [{ sku: 'A', qty: 1 }] }), bundle: { available: 0, components: [{ sku: 'A', qty: 1, name: 'Bremsbelag', inStore: false }] } }), locale);
    expect(await axePage()).toHaveNoViolations();
  });

  it('has one h1', async () => {
    await show(ok(), locale);
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });
});
