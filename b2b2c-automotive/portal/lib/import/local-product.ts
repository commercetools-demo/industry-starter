/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Pure validation of a local product (W-12) and the field helpers the CSV import shares. A price is valid when it is above zero
// with at most two decimals; there is no floor (Q-T03). A SKU never starts with the Malva prefix `MLV-`.
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,39}$/;
export const RESERVED_SKU_PREFIX = 'MLV-';

export type Locale = 'de-DE' | 'en-US';
export const LOCALES: readonly Locale[] = ['de-DE', 'en-US'];

export const isValidSku = (sku: string): boolean => SKU_PATTERN.test(sku) && !sku.startsWith(RESERVED_SKU_PREFIX);

/** `12`, `12.5`, `12.50` give cents; anything else (comma, sign, three decimals, zero) gives null. */
export function parsePriceCents(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/ß/g, 'ss')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export interface LocalProductInput {
  name: Partial<Record<Locale, string>>;
  sku: string;
  /** Whole cents. */
  priceCents: number;
  categoryKey: string;
  type: string;
  brandName?: string;
  /** Claimed vehicles (master `fitment-keys` values). A claim sends the product to Malva review. */
  fitment?: string[];
}

export interface FieldIssue {
  field: 'name' | 'sku' | 'price' | 'category' | 'type' | 'fitment';
  locale?: Locale;
  message: string;
}

export interface LocalProductContext {
  /** The store's languages; every one needs a name. */
  languages: readonly Locale[];
  categoryKeys: ReadonlySet<string>;
}

export function validateLocalProduct(input: LocalProductInput, ctx: LocalProductContext): FieldIssue[] {
  const issues: FieldIssue[] = [];
  for (const locale of ctx.languages) {
    const name = (input.name[locale] ?? '').trim();
    if (name.length < 2 || name.length > 120) issues.push({ field: 'name', locale, message: 'The name needs 2 to 120 characters' });
  }
  if (!isValidSku(input.sku)) issues.push({ field: 'sku', message: 'Use 3 to 40 capital letters, digits, dots, dashes or underscores; MLV- is reserved' });
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents <= 0) issues.push({ field: 'price', message: 'Enter a price above zero with at most two decimals' });
  if (!ctx.categoryKeys.has(input.categoryKey)) issues.push({ field: 'category', message: 'Choose a category' });
  if (input.type !== 'Local part') issues.push({ field: 'type', message: 'Create bundles on the Bundles page' });
  if (input.fitment && (input.fitment.length > 50 || input.fitment.some((k) => !/^[^\s].{0,120}$/.test(k)))) issues.push({ field: 'fitment', message: 'Choose up to 50 vehicles' });
  return issues;
}
