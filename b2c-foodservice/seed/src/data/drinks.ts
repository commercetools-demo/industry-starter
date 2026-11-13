// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { InventoryEntryDraft, ProductTypeDraft } from '@commercetools/platform-sdk';
import { COUNTRIES, K, MARKETS, hash, ls, slugify } from './base';
import { CHANNEL_DRINKS } from './brands';
import raw from './drinks.json';
import { oneTimeCents } from './prices';

/**
 * Malva Drinks catalogue. The lines come from `drinks.json`, produced by `scripts/reduce-drinks.ts` from the scraped
 * Maison Perrier data: one line per distinct (name, size) with `sku`, `category`, `name`, `size`, `description` and the
 * distinct image URLs. One product per name, one variant per size line. Prices and stock are invented. Image URLs are
 * used as they are (no image recording for drinks).
 */
export interface DrinkLine { sku: string; category: string; name: string; size: string; description: string; images: string[] }
export const DRINK_LINES: DrinkLine[] = raw as DrinkLine[];

export const PT_DRINK = 'mcf-drink';
/** Not `size`: an attribute name has one type project-wide and the in-store ready drinks already use `size` as an enum. */
export const DRINK_SIZE_ATTR = 'drinkSize';

export const drinkProductType: ProductTypeDraft = {
  key: PT_DRINK, name: 'Malva drink', description: 'Sparkling water by size; one variant per size.',
  attributes: [{
    name: DRINK_SIZE_ATTR, label: ls('Size'), isRequired: true, isSearchable: true, attributeConstraint: 'CombinationUnique', inputHint: 'SingleLine',
    type: { name: 'text' },
  }],
};

interface DrinkCategory { key: string; en: string; slug: string; description: string }
export const DRINK_CATEGORIES: DrinkCategory[] = [
  { key: 'mcf-cat-drinks-french-kiss', en: 'French Kiss', slug: 'french-kiss', description: 'Sparkling water blended with real fruit juices in love-match pairings.' },
  { key: 'mcf-cat-drinks-unflavored', en: 'Unflavored', slug: 'unflavored', description: 'Crisp, clean sparkling water.' },
  { key: 'mcf-cat-drinks-flavored-forever', en: 'Flavored Forever', slug: 'flavored-forever', description: 'Everyday flavoured sparkling water.' },
  { key: 'mcf-cat-drinks-chic', en: 'Chic', slug: 'chic', description: 'Cocktail-inspired sparkling drinks, no alcohol.' },
];
const categoryKeyOf = (name: string): string => {
  const c = DRINK_CATEGORIES.find((x) => x.en.toLowerCase() === name.toLowerCase());
  if (!c) throw new Error(`Unknown drinks category "${name}"`);
  return c.key;
};

/** The category image: the first scraped image of the first product line of the category (none when no line has an image). */
const categoryAssets = (key: string): Record<string, unknown>[] => {
  const url = DRINK_LINES.find((l) => categoryKeyOf(l.category) === key && l.images.length > 0)?.images[0];
  return url ? [{ key: 'image-1', name: ls('Image'), sources: [{ uri: url, dimensions: { w: 1000, h: 1000 }, contentType: 'image/jpeg' }], tags: ['image'] }] : [];
};

export const drinkCategoryDrafts = (): Record<string, unknown>[] =>
  DRINK_CATEGORIES.map((c, i) => {
    const assets = categoryAssets(c.key);
    return { key: c.key, name: ls(c.en), slug: ls(c.slug), description: ls(c.description), orderHint: `0.${i + 1}`, ...(assets.length ? { assets } : {}) };
  });

/** Units in the pack and fluid ounces per unit, read from the size text ("(24 count)", "8 Pack", "6-11.15 FL OZ", "16.9 fl oz bottle"). */
export function parseSize(size: string): { count: number; floz: number } {
  const floz = Number(/(\d+(?:\.\d+)?)\s*fl\.?\s*oz/i.exec(size)?.[1] ?? 12);
  const count = Number(/^\s*(\d+)\s*-/.exec(size)?.[1] ?? /\((\d+)\s*count\)/i.exec(size)?.[1] ?? /(\d+)\s*pack/i.exec(size)?.[1] ?? 1);
  return { count, floz };
}

/** Invented US price in cents (a multiple of 5): per-unit price by volume (Chic costs more), times the pack, with a pack discount. */
export function priceUsd(line: DrinkLine): number {
  const { count, floz } = parseSize(line.size);
  const unit = line.category.toLowerCase() === 'chic' ? 250 : Math.round(60 + floz * 8);
  const total = unit * count * (count >= 12 ? 0.85 : count >= 6 ? 0.92 : 1);
  return Math.max(5, Math.round(total / 5) * 5);
}

export const drinkProductKey = (name: string): string => `mcf-dr-${slugify(name)}`;

const price = (line: DrinkLine) => COUNTRIES.map((country) => ({
  key: `${country.toLowerCase()}-one-time`, country,
  value: { currencyCode: MARKETS[country].currency, centAmount: oneTimeCents(priceUsd(line), MARKETS[country].currency) },
}));

const variantDraft = (line: DrinkLine, withPrices: boolean): Record<string, unknown> => ({
  sku: line.sku, key: line.sku, attributes: [{ name: DRINK_SIZE_ATTR, value: line.size }],
  ...(withPrices ? { prices: price(line) } : {}),
  ...(line.images.length ? { images: line.images.map((url) => ({ url, dimensions: { w: 1000, h: 1000 } })) } : {}),
});

/** Names in first-appearance order with their size lines. */
export const drinkGroups = (): { name: string; lines: DrinkLine[] }[] => {
  const by = new Map<string, DrinkLine[]>();
  for (const l of DRINK_LINES) by.set(l.name, [...(by.get(l.name) ?? []), l]);
  return [...by].map(([name, lines]) => ({ name, lines }));
};

export const drinkProductDrafts = (withPrices = true): Record<string, unknown>[] =>
  drinkGroups().map(({ name, lines }) => {
    const [master, ...rest] = lines as [DrinkLine, ...DrinkLine[]];
    return {
      key: drinkProductKey(name), productType: { typeId: 'product-type', key: PT_DRINK }, taxCategory: { typeId: 'tax-category', key: K.taxFood },
      name: ls(name), slug: ls(slugify(name)), description: ls(master.description),
      categories: [{ typeId: 'category', key: categoryKeyOf(master.category) }],
      masterVariant: variantDraft(master, withPrices), variants: rest.map((l) => variantDraft(l, withPrices)),
      searchKeywords: { 'en-US': [{ text: name }], 'en-CA': [{ text: name }] },
      publish: true,
    };
  });

export const DRINK_PRODUCT_KEYS: string[] = drinkGroups().map((g) => drinkProductKey(g.name));
export const DRINK_SKUS: string[] = DRINK_LINES.map((l) => l.sku);

export const drinkInventoryKey = (sku: string): string => `mcf-inv-${sku}-drinks`;

/** Stock only on the drinks channel: 1 in 12 is low (1 to 5), the rest 40 to 239. Deterministic. */
export const drinkInventoryDrafts = (): InventoryEntryDraft[] =>
  DRINK_SKUS.map((sku) => {
    const h = hash(`${sku}@drinks`);
    return {
      key: drinkInventoryKey(sku), sku, supplyChannel: { typeId: 'channel', key: CHANNEL_DRINKS },
      quantityOnStock: h % 12 === 0 ? 1 + ((h >>> 8) % 5) : 40 + ((h >>> 8) % 200),
    };
  });
