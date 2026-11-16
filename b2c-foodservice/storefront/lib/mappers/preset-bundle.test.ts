// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapBundleView, parseBundleConfig } from '@/lib/mappers/preset-bundle';
import {
  BUNDLE_CONFIG_VALUE, BUNDLE_PRODUCT_ID, BUNDLE_SKU, POD_CAROUSEL_ID, componentProducts, inventoryFor, productProjection,
} from '@/test/preset-bundle';

const ctx = { locale: 'en-US', currency: 'USD' };
const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
afterEach(() => warn.mockClear());

function view(opts: { products?: Map<string, ReturnType<typeof productProjection>>; inventory?: Record<string, { online: number }>; value?: unknown; locale?: string } = {}) {
  const config = parseBundleConfig(opts.value ?? BUNDLE_CONFIG_VALUE);
  if (!config) throw new Error('config did not parse');
  return mapBundleView(config, opts.products ?? componentProducts(), opts.inventory ?? inventoryFor(), { ...ctx, locale: opts.locale ?? 'en-US' }, BUNDLE_SKU);
}

describe('preset bundle mapper (V-07)', () => {
  it('maps the owner presets with the worked-example prices (US)', () => {
    const v = view();
    expect(v.productId).toBe(BUNDLE_PRODUCT_ID);
    expect(v.presets.map((p) => p.name)).toEqual(['Vertuo bundle', 'Pod plus']);
    expect(v.presets[0]).toMatchObject({
      index: 0, discountPercent: 10, available: true,
      was: { centAmount: 38795, currencyCode: 'USD' }, price: { centAmount: 34916, currencyCode: 'USD' }, save: { centAmount: 3879, currencyCode: 'USD' },
    });
    expect(v.presets[1]).toMatchObject({
      index: 1, discountPercent: 12, available: true,
      was: { centAmount: 47290 }, price: { centAmount: 41615 }, save: { centAmount: 5675 },
    });
  });

  it('lists the machine first, then the pods, with the names', () => {
    const [first] = view().presets;
    expect(first.components.map((c) => [c.role, c.name])).toEqual([
      ['machine', 'Vertuo Studio'], ['item', 'Pod One Starter Gift'], ['item', 'Pod Discovery Gift Set'],
    ]);
  });

  it('uses the discounted price of a component when the product has one', () => {
    const products = componentProducts();
    products.set('465a3b79-2d77-49df-a7b4-1209ad47de87', productProjection('465a3b79-2d77-49df-a7b4-1209ad47de87', 'Pod Plus Milk', [{ sku: 'MCF-MAC-PODPLUS-WHI-M', cents: 21900, discountedCents: 20000 }]));
    const pod = view({ products }).presets[1];
    expect(pod.was?.centAmount).toBe(47290 - 1900);
  });

  it('an empty en-CA name falls back to en-US', () => {
    expect(view({ locale: 'en-CA' }).presets[0].name).toBe('Vertuo bundle');
  });

  it('a component without a price in the market makes the preset unavailable: no-price', () => {
    const products = componentProducts();
    products.set(POD_CAROUSEL_ID, productProjection(POD_CAROUSEL_ID, 'Pod carousel holder', [{ sku: 'MCF-ACC-CAROUSEL-BLA', cents: null }]));
    const pod = view({ products }).presets[1];
    expect(pod).toMatchObject({ available: false, unavailableReason: 'no-price', price: null });
  });

  it('an out-of-stock component makes the preset unavailable: out-of-stock', () => {
    const v = view({ inventory: inventoryFor({ 'MCF-GFT-STARTER': 0 }) });
    expect(v.presets[0]).toMatchObject({ available: false, unavailableReason: 'out-of-stock' });
    expect(v.presets[0].components.find((c) => c.sku === 'MCF-GFT-STARTER')?.inStock).toBe(false);
  });

  it('a schema mismatch gives null and logs the event without values', () => {
    expect(parseBundleConfig({ nope: true })).toBeNull();
    expect(warn).toHaveBeenCalledWith(JSON.stringify({ event: 'preset_bundle_config_invalid' }));
  });

  it('an invalid discount hides only that preset and keeps the index of the others', () => {
    const value = JSON.parse(JSON.stringify(BUNDLE_CONFIG_VALUE)) as { bundleConfiguration: { presets: { presetDiscount: unknown }[] } };
    value.bundleConfiguration.presets[0].presetDiscount = 1.5;
    const v = view({ value });
    expect(v.presets.map((p) => p.index)).toEqual([1]);
    expect(warn).toHaveBeenCalledWith(JSON.stringify({ event: 'preset_bundle_preset_hidden', index: 0, reason: 'discount' }));
  });

  it('a preset whose component product is missing is not shown', () => {
    const products = componentProducts();
    products.delete(POD_CAROUSEL_ID);
    expect(view({ products }).presets.map((p) => p.index)).toEqual([0]);
  });
});
