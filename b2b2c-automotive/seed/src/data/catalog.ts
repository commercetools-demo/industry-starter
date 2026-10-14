// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Attribute, ProductDraft } from '@commercetools/platform-sdk';
import { K, ls, slugify } from './base';
import { categoryKeyOf } from './categories';
import { BUNDLES, LOCAL_PARTS, eurOf, keyOfSku, type BundleDef, type LocalPartDef } from './items';
import { PARTS, POPULARITY, partKey, relatedSkus, type PartDef } from './parts';
import { BRANDS, QUALITY_TIERS } from './product-types';

export interface PickedImage { url: string; dimensions: { w: number; h: number } }
export type ImageMap = Record<string, PickedImage[]>;

const HERE = path.dirname(new URL(import.meta.url).pathname);

/** Recorded images (written by `npm run seed:images`). A missing or empty file means: no images, no failure. */
export function loadImages(file: string, dir: string = HERE): ImageMap {
  const p = path.join(dir, file);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, 'utf8')) as ImageMap;
}

const ref = <T extends string>(typeId: T, key: string) => ({ typeId, key });
const eurMoney = (centAmount: number) => ({ currencyCode: 'EUR', centAmount });
const usdMoney = (centAmount: number) => ({ currencyCode: 'USD', centAmount });

/** Synthetic OE cross references (every tier but economy); none are real OE numbers. */
export const oemNumbersOf = (p: PartDef): string[] => (p.tier !== 'economy' ? [`OE-${p.sku.slice(-5)}-1`, `OE-${p.sku.slice(-5)}-2`] : []);

const brandLabel = (key: string) => BRANDS.find((b) => b.key === key)?.label ?? key;
const tierOf = (key: string) => QUALITY_TIERS.find((q) => q.key === key);

export function partAttributes(p: PartDef): Attribute[] {
  const attrs: Attribute[] = [
    { name: 'part-number', value: p.sku },
    { name: 'brand', value: p.brand },
    { name: 'quality-tier', value: p.tier },
    { name: 'warranty-months', value: p.warranty },
    { name: 'universal-fit', value: p.fit === 'universal' },
    // Subscribable: the PDP offers "Subscribe" with the recurrence policies of `extras.ts` (Q-Q06).
    { name: 'recurring-eligible', value: p.recurring === true },
  ];
  if (p.position) attrs.push({ name: 'position', value: p.position });
  const oem = oemNumbersOf(p);
  if (oem.length > 0) attrs.push({ name: 'oem-numbers', value: oem });
  if (p.fit !== 'universal') attrs.push({ name: 'fitment-keys', value: p.fit });
  if (p.core) {
    attrs.push({ name: 'core-charge-eur', value: eurMoney(p.core.eur) }, { name: 'core-charge-usd', value: usdMoney(p.core.usd) });
  }
  if (p.size) attrs.push({ name: 'size-spec', value: p.size });
  const rank = POPULARITY[p.sku];
  if (rank !== undefined) attrs.push({ name: 'popularity-rank', value: rank });
  const related = relatedSkus(p.sku);
  if (related.length > 0) attrs.push({ name: 'related-skus', value: related });
  return attrs;
}

const searchKeywords = (texts: string[]) => {
  const kw = texts.filter(Boolean).map((text) => ({ text }));
  return { 'de-DE': kw, 'en-US': kw };
};

export function partDraft(p: PartDef, images: ImageMap = {}): ProductDraft {
  const key = partKey(p.sku);
  const tier = tierOf(p.tier);
  const brand = brandLabel(p.brand);
  return {
    key, productType: ref('product-type', K.ptPart), priceMode: 'Standalone',
    name: ls(`${brand} ${p.de}`, `${brand} ${p.en}`),
    slug: ls(slugify(`${brand} ${p.de} ${p.sku}`), slugify(`${brand} ${p.en} ${p.sku}`)),
    description: ls(
      `${p.de}. Marke: ${brand}. Qualität: ${tier?.de}.${p.warranty ? ` Garantie: ${p.warranty} Monate.` : ''} Teilenummer ${p.sku}.`,
      `${p.en}. Brand: ${brand}. Quality: ${tier?.en}.${p.warranty ? ` Warranty: ${p.warranty} months.` : ''} Part number ${p.sku}.`,
    ),
    categories: [ref('category', categoryKeyOf(p.cat))],
    taxCategory: ref('tax-category', K.taxParts),
    searchKeywords: searchKeywords([p.sku, ...oemNumbersOf(p), brand]),
    masterVariant: {
      sku: p.sku, key: p.sku, attributes: partAttributes(p),
      // No embedded prices (Q-003): see prices.ts. A pre-release part gets no standalone price either ("price pending", never 0).
      images: images[key] ?? [],
    },
    publish: true,
  };
}

export function bundleDraft(b: BundleDef, images: ImageMap = {}): ProductDraft {
  const key = keyOfSku(b.sku);
  return {
    key, productType: ref('product-type', K.ptBundle), priceMode: 'Standalone',
    name: ls(b.de, b.en), slug: ls(slugify(`${b.de} ${b.sku}`), slugify(`${b.en} ${b.sku}`)),
    description: ls(`${b.de}: ${b.components.map((c) => `${c.qty} x ${c.sku}`).join(', ')}. ${b.discountPercent} % Set-Rabatt.`, `${b.en}: ${b.components.map((c) => `${c.qty} x ${c.sku}`).join(', ')}. ${b.discountPercent}% bundle discount.`),
    categories: [ref('category', categoryKeyOf(b.cat))], taxCategory: ref('tax-category', K.taxParts),
    searchKeywords: searchKeywords([b.sku]),
    masterVariant: {
      sku: b.sku, key: b.sku,
      attributes: [
        { name: 'part-number', value: b.sku },
        { name: 'component-skus', value: b.components.map((c) => c.sku) },
        { name: 'component-quantities', value: b.components.map((c) => `${c.sku}:${c.qty}`) },
        { name: 'bundle-discount-percent', value: b.discountPercent },
        ...(b.owner ? [{ name: 'owner-store', value: b.owner }] : []),
      ],
      images: images[key] ?? [],
    },
    publish: true,
  };
}

export function localPartDraft(l: LocalPartDef, images: ImageMap = {}): ProductDraft {
  const key = keyOfSku(l.sku);
  return {
    key, productType: ref('product-type', K.ptLocalPart), priceMode: 'Standalone',
    name: ls(l.de, l.en), slug: ls(slugify(`${l.de} ${l.sku}`), slugify(`${l.en} ${l.sku}`)),
    description: ls(`${l.de}. Eigenes Produkt von ${l.brandName}.`, `${l.en}. Own product of ${l.brandName}.`),
    categories: [ref('category', categoryKeyOf(l.cat))], taxCategory: ref('tax-category', K.taxParts),
    searchKeywords: searchKeywords([l.sku, l.brandName]),
    masterVariant: {
      sku: l.sku, key: l.sku,
      attributes: [
        { name: 'part-number', value: l.sku }, { name: 'brand-name', value: l.brandName }, { name: 'owner-store', value: l.owner },
        { name: 'review-state', value: l.review }, { name: 'recurring-eligible', value: l.recurring === true },
      ],
      images: images[key] ?? [],
    },
    publish: l.review === 'approved',
  };
}

/** Every product draft, in creation order: parts, local parts, bundles (bundles reference component SKUs only as text). */
export function allProductDrafts(images: ImageMap = {}): ProductDraft[] {
  return [...PARTS.map((p) => partDraft(p, images)), ...LOCAL_PARTS.map((l) => localPartDraft(l, images)), ...BUNDLES.map((b) => bundleDraft(b, images))];
}

export { eurOf };
