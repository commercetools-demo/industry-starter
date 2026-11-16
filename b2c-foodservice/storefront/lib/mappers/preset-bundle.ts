// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ProductProjection, ProductVariant } from '@commercetools/platform-sdk';
import { z } from 'zod';
import { isValidDiscount, presetPrice } from '@/lib/preset-bundle/pricing';
import type { BundleComponentView, BundleMachineOption, BundlePresetView, BundleView, Money } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

/**
 * Pure mapping of the preset-bundle custom object and the component projections to `BundleView` (workstream V, D5).
 * No commercetools call here: lib/ct/preset-bundles.ts reads, this file maps.
 */

const REF = z.object({ id: z.string().min(1) });
const PRESET = z.object({
  name: z.record(z.string(), z.string()).optional(),
  coffeeMachine: REF,
  pods: z.array(REF).optional(),
  // Checked per preset (an invalid discount hides that preset only), not by the schema.
  presetDiscount: z.unknown(),
});
const CONFIG_VALUE = z.object({
  mainProductReference: REF,
  bundleConfiguration: z.object({ presets: z.array(PRESET) }),
});

export interface BundlePresetConfig {
  /** Position in `presets[]`. This is the value the bag stores as `bundlePreset` (Q-V-3). */
  index: number;
  name: Record<string, string>;
  machineId: string;
  podIds: string[];
  discount: unknown;
}
export interface BundleConfig { productId: string; presets: BundlePresetConfig[] }

/** The custom object value, or null when it does not match the schema. Logs the event only, never the values. */
export function parseBundleConfig(value: unknown): BundleConfig | null {
  const parsed = CONFIG_VALUE.safeParse(value);
  if (!parsed.success) {
    console.warn(JSON.stringify({ event: 'preset_bundle_config_invalid' }));
    return null;
  }
  return {
    productId: parsed.data.mainProductReference.id,
    presets: parsed.data.bundleConfiguration.presets.map((preset, index) => ({
      index,
      name: preset.name ?? {},
      machineId: preset.coffeeMachine.id,
      podIds: (preset.pods ?? []).map((ref) => ref.id),
      discount: preset.presetDiscount,
    })),
  };
}

export interface BundleMapContext { locale: string; currency: string }
type InventoryByOnlineSku = Record<string, { online: number }>;

/** The localized name, with an empty value (e.g. en-CA "") falling back to en-US. */
export function localizedWithFallback(name: Record<string, string> | undefined, locale: string): string {
  const value = getLocalizedString(name, locale);
  return value !== '' ? value : getLocalizedString(name, 'en-US');
}

const money = (centAmount: number, currencyCode: string): Money => ({ centAmount, currencyCode });

/** The effective unit price in the market currency: the discounted value when there is one, else the list value. Null when none. */
export function effectiveCents(variant: ProductVariant | undefined, currency: string): number | null {
  const price = variant?.price;
  if (!price || price.value.currencyCode !== currency) return null;
  return price.discounted ? price.discounted.value.centAmount : price.value.centAmount;
}

function enumLabel(variant: ProductVariant, attribute: string, locale: string): string | undefined {
  const value = variant.attributes?.find((a) => a.name === attribute)?.value as unknown;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const label = (value as { label?: unknown }).label;
    if (typeof label === 'string') return label;
    if (label && typeof label === 'object') return getLocalizedString(label as Record<string, string>, locale) || undefined;
  }
  return undefined;
}

/** "Black · Machine only" for a machine variant, or its SKU when it has neither attribute. */
function variantLabel(variant: ProductVariant, locale: string): string {
  const parts = [enumLabel(variant, 'colour', locale), enumLabel(variant, 'bundle', locale)].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(' · ') : (variant.sku ?? '');
}

const onlineStock = (inventory: InventoryByOnlineSku, sku: string | undefined): number =>
  (sku && inventory[sku]?.online) || 0;

function componentOf(
  variant: ProductVariant, product: ProductProjection, role: 'machine' | 'item',
  ctx: BundleMapContext, inventory: InventoryByOnlineSku,
): BundleComponentView {
  const cents = effectiveCents(variant, ctx.currency);
  const name = localizedWithFallback(product.name, ctx.locale);
  return {
    productId: product.id,
    sku: variant.sku ?? '',
    name,
    slug: localizedWithFallback(product.slug, ctx.locale),
    imageUrl: variant.images?.[0]?.url,
    imageAlt: name,
    role,
    unitPrice: cents === null ? null : money(cents, ctx.currency),
    inStock: onlineStock(inventory, variant.sku) > 0,
  };
}

/** One preset from its components. Null (and logged by index only) when the discount is invalid or a component is missing. */
function mapPreset(
  preset: BundlePresetConfig, products: ReadonlyMap<string, ProductProjection>,
  inventory: InventoryByOnlineSku, ctx: BundleMapContext,
): BundlePresetView | null {
  if (!isValidDiscount(preset.discount)) {
    console.warn(JSON.stringify({ event: 'preset_bundle_preset_hidden', index: preset.index, reason: 'discount' }));
    return null;
  }
  const machineProduct = products.get(preset.machineId);
  const podProducts = preset.podIds.map((id) => products.get(id));
  if (!machineProduct || podProducts.some((p) => p === undefined)) {
    console.warn(JSON.stringify({ event: 'preset_bundle_preset_hidden', index: preset.index, reason: 'component' }));
    return null;
  }
  const pods = podProducts as ProductProjection[];
  const podViews = pods.map((product) => componentOf(product.masterVariant, product, 'item', ctx, inventory));
  const podsInStock = podViews.every((view) => view.inStock);
  const podCents = podViews.map((view) => view.unitPrice?.centAmount ?? null);

  const machineVariants = [machineProduct.masterVariant, ...(machineProduct.variants ?? [])]
    .filter((v, i, all) => v?.sku && all.findIndex((o) => o?.sku === v.sku) === i);
  const options = machineVariants.map((variant) => {
    const machineCents = effectiveCents(variant, ctx.currency);
    const priced = machineCents !== null && podCents.every((c) => c !== null)
      ? presetPrice([machineCents, ...(podCents as number[])], preset.discount)
      : null;
    const option: BundleMachineOption = {
      sku: variant.sku ?? '',
      label: variantLabel(variant, ctx.locale),
      imageUrl: variant.images?.[0]?.url,
      imageAlt: localizedWithFallback(machineProduct.name, ctx.locale),
      inStock: onlineStock(inventory, variant.sku) > 0 && podsInStock,
      was: priced ? money(priced.was, ctx.currency) : null,
      price: priced ? money(priced.price, ctx.currency) : null,
      save: priced ? money(priced.save, ctx.currency) : null,
    };
    return { variant, option };
  });
  if (options.length === 0) return null;

  // The default choice: the first variant that can be bought, else the first that has a price, else the first.
  const chosen = options.find((o) => o.option.price && o.option.inStock)
    ?? options.find((o) => o.option.price)
    ?? options[0];
  const available = options.some((o) => o.option.price && o.option.inStock);
  const reason = available ? undefined : options.every((o) => !o.option.price) ? 'no-price' : 'out-of-stock';
  const name = localizedWithFallback(preset.name, ctx.locale)
    || localizedWithFallback(machineProduct.name, ctx.locale);

  return {
    index: preset.index,
    name,
    discountPercent: Math.round(preset.discount * 100),
    components: [componentOf(chosen.variant, machineProduct, 'machine', ctx, inventory), ...podViews],
    machines: options.map((o) => o.option),
    was: chosen.option.was,
    price: chosen.option.price,
    save: chosen.option.save,
    available,
    ...(reason ? { unavailableReason: reason } : {}),
  };
}

/** The bundle view for one SKU. Presets that cannot be shown are left out (see mapPreset); the index is kept. */
export function mapBundleView(
  config: BundleConfig, products: ReadonlyMap<string, ProductProjection>,
  inventory: InventoryByOnlineSku, ctx: BundleMapContext, sku: string,
): BundleView {
  const presets: BundlePresetView[] = [];
  for (const preset of config.presets) {
    const view = mapPreset(preset, products, inventory, ctx);
    if (view) presets.push(view);
  }
  return { productId: config.productId, sku, presets };
}
