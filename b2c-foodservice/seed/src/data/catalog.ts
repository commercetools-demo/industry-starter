// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Attribute } from '@commercetools/platform-sdk';
import { CATEGORIES } from './categories';
import { priceDraftsOf } from './prices';
import { PRODUCTS, type ImageTag, type ProductDef, type VariantDef } from './products';

/** A recorded image (written by `npm run seed:images` into src/data/images.json). The URL is clean: no query, no fragment. */
export interface RecordedImage { url: string; width: number; height: number; description: string }
export interface ImageRef { url: string; dimensions: { w: number; h: number } }
export type ImageMap = Record<string, ImageRef[]>;

const HERE = path.dirname(new URL(import.meta.url).pathname);

/** Recorded images. A missing or empty file means: no images, no failure. */
export function loadRecordedImages(dir: string = HERE, file = 'images.json'): RecordedImage[] {
  const p = path.join(dir, file);
  if (!existsSync(p)) return [];
  const parsed = JSON.parse(readFileSync(p, 'utf8')) as unknown;
  return Array.isArray(parsed) ? (parsed as RecordedImage[]) : [];
}

/** Tag of a photo from its description (SEED-PLAN section 15: coffee, capsule, machine, cup). */
export function tagOfDescription(description: string): ImageTag {
  const d = description.toLowerCase();
  if (/capsule|pod\b|pods\b/.test(d)) return 'capsule';
  if (/machine|espresso maker|grinder|maker/.test(d)) return 'machine';
  if (/\bcup\b|\bcups\b|mug|latte art|cappuccino/.test(d)) return 'cup';
  return 'coffee';
}

/**
 * Round-robin assignment by tag: the n-th product (or category) of a tag gets the n-th photo of that tag, wrapping;
 * a tag without photos falls back to all photos. Deterministic for a given file, so a re-run changes nothing.
 */
export function assignImages(recorded: RecordedImage[], items: { key: string; tag: ImageTag }[]): ImageMap {
  const out: ImageMap = {};
  if (recorded.length === 0) return out;
  const counters = new Map<ImageTag, number>();
  for (const item of items) {
    const tagged = recorded.filter((r) => tagOfDescription(r.description) === item.tag);
    const pool = tagged.length > 0 ? tagged : recorded;
    const n = counters.get(item.tag) ?? 0;
    counters.set(item.tag, n + 1);
    const pick = pool[n % pool.length] as RecordedImage;
    out[item.key] = [{ url: pick.url, dimensions: { w: pick.width, h: pick.height } }];
  }
  return out;
}

const topCategoryTag: Record<string, ImageTag> = { 'mcf-cat-pods': 'capsule', 'mcf-cat-coffee': 'coffee', 'mcf-cat-machines': 'machine', 'mcf-cat-accessories': 'cup', 'mcf-cat-gifts': 'coffee' };

export const productImageItems = (): { key: string; tag: ImageTag }[] => PRODUCTS.map((p) => ({ key: p.key, tag: p.tag }));
export const categoryImageItems = (): { key: string; tag: ImageTag }[] =>
  CATEGORIES.map((c) => ({ key: c.key, tag: topCategoryTag[c.parent ?? c.key] ?? 'coffee' }));

export const productImagesFor = (recorded: RecordedImage[]): ImageMap => assignImages(recorded, productImageItems());
export const categoryImagesFor = (recorded: RecordedImage[]): ImageMap => assignImages(recorded, categoryImageItems());

const attrs = (p: ProductDef, v: VariantDef): Attribute[] => [
  ...Object.entries({ ...p.common, ...v.attrs }).map(([name, value]) => ({ name, value })),
];

export const variantDraft = (p: ProductDef, v: VariantDef, images: ImageRef[] = [], withPrices = true): Record<string, unknown> => ({
  sku: v.sku, key: v.sku.toLowerCase(), attributes: attrs(p, v), ...(withPrices ? { prices: priceDraftsOf(p, v) } : {}), ...(images.length ? { images } : {}),
});

/**
 * Product drafts, published at once. `images` is the map from `productImagesFor`; empty means seed without images.
 * The seed's `products` step creates products without prices (`withPrices` false) and its `prices` step sets them.
 */
export function productDrafts(images: ImageMap = {}, withPrices = true): Record<string, unknown>[] {
  return PRODUCTS.map((p) => {
    const [master, ...rest] = p.variants as [VariantDef, ...VariantDef[]];
    const imgs = images[p.key] ?? [];
    return {
      key: p.key, productType: { typeId: 'product-type', key: p.productType }, taxCategory: { typeId: 'tax-category', key: p.taxCategory },
      name: p.name, slug: p.slug, description: p.description,
      categories: p.categories.map((key) => ({ typeId: 'category', key })),
      masterVariant: variantDraft(p, master, imgs, withPrices), variants: rest.map((v) => variantDraft(p, v, imgs, withPrices)),
      searchKeywords: Object.fromEntries(Object.entries(p.name).map(([locale, text]) => [locale, [{ text }]])),
      publish: true,
    };
  });
}
