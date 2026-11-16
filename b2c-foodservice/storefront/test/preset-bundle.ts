// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import fixture from '@/scripts/mock-fixtures/preset-bundle.json';

/** The owner's bundle: the custom object value exactly as the platform returns it (scripts/mock-fixtures/preset-bundle.json). */
export const BUNDLE_CONFIG_VALUE: unknown = fixture.bundleItem.value;
export const BUNDLE_CONFIG_ID = fixture.bundleItem.id;
export const BUNDLE_PRODUCT_ID = '0e44e6d5-2936-419b-9ad9-802b1d79d9d5';
export const BUNDLE_SKU = '998674532';

export const VERTUO_STUDIO_ID = '37f4f5a9-7a60-40f1-ad59-31aa8316541e';
export const POD_PLUS_MILK_ID = '465a3b79-2d77-49df-a7b4-1209ad47de87';
export const POD_ONE_STARTER_ID = 'c008dc8c-f88d-477c-8aae-dc80899c1fd9';
export const POD_DISCOVERY_ID = '87201dfe-de93-401f-815c-1d0a9c0fa521';
export const POD_CAROUSEL_ID = 'c988c8f7-3035-4922-894d-6a8585dad9a1';

interface VariantSpec { sku: string; cents: number | null; discountedCents?: number; inStock?: boolean; colour?: string }

/** A product projection with one or more variants, priced in USD (the market of the tests). */
export function productProjection(id: string, name: string, variants: VariantSpec[], currency = 'USD'): ProductProjection {
  const toVariant = (spec: VariantSpec, index: number): ProductVariant => ({
    id: index + 1,
    sku: spec.sku,
    attributes: spec.colour ? [{ name: 'colour', value: { key: spec.colour, label: spec.colour[0].toUpperCase() + spec.colour.slice(1) } }] : [],
    images: [{ url: `https://img.example.test/${spec.sku}.jpg`, dimensions: { w: 1, h: 1 } }],
    prices: [],
    price: spec.cents === null ? undefined : {
      id: `p-${spec.sku}`,
      value: { type: 'centPrecision', currencyCode: currency, centAmount: spec.cents, fractionDigits: 2 },
      ...(spec.discountedCents === undefined ? {} : {
        discounted: { value: { type: 'centPrecision', currencyCode: currency, centAmount: spec.discountedCents, fractionDigits: 2 }, discount: { id: 'd', typeId: 'product-discount' } },
      }),
    },
  } as unknown as ProductVariant);
  const [master, ...rest] = variants.map(toVariant);
  return {
    id, name: { 'en-US': name, 'en-CA': name }, slug: { 'en-US': name.toLowerCase().replace(/\s+/g, '-'), 'en-CA': name.toLowerCase().replace(/\s+/g, '-') },
    masterVariant: master, variants: rest,
  } as unknown as ProductProjection;
}

/** The five component products of the owner's two presets, with the prices of the plan's worked example (USD). */
export function componentProducts(): Map<string, ProductProjection> {
  return new Map([
    [VERTUO_STUDIO_ID, productProjection(VERTUO_STUDIO_ID, 'Vertuo Studio', [
      { sku: 'MCF-MAC-VERTUO-BLA-M', cents: 15900, colour: 'black' },
      { sku: 'MCF-MAC-VERTUO-BLA-S', cents: 18390, colour: 'black' },
    ])],
    [POD_PLUS_MILK_ID, productProjection(POD_PLUS_MILK_ID, 'Pod Plus Milk', [{ sku: 'MCF-MAC-PODPLUS-WHI-M', cents: 21900, colour: 'white' }])],
    [POD_ONE_STARTER_ID, productProjection(POD_ONE_STARTER_ID, 'Pod One Starter Gift', [{ sku: 'MCF-GFT-STARTER', cents: 17900 }])],
    [POD_DISCOVERY_ID, productProjection(POD_DISCOVERY_ID, 'Pod Discovery Gift Set', [{ sku: 'MCF-GFT-DISCOVERY', cents: 4995 }])],
    [POD_CAROUSEL_ID, productProjection(POD_CAROUSEL_ID, 'Pod carousel holder', [{ sku: 'MCF-ACC-CAROUSEL-BLA', cents: 2495 }])],
  ]);
}

/** Online stock for every component SKU (all in stock unless overridden). */
export function inventoryFor(overrides: Record<string, number> = {}): Record<string, { online: number }> {
  const skus = ['MCF-MAC-VERTUO-BLA-M', 'MCF-MAC-VERTUO-BLA-S', 'MCF-MAC-PODPLUS-WHI-M', 'MCF-GFT-STARTER', 'MCF-GFT-DISCOVERY', 'MCF-ACC-CAROUSEL-BLA'];
  return Object.fromEntries(skus.map((sku) => [sku, { online: overrides[sku] ?? 100 }]));
}
