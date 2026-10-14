/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// CSV import validation (W-13). Pure: the server calls it on every validate AND on every commit (the commit never trusts a client
// list). Counts: `valid` rows pass without an issue, `warnings` rows import with a default, `errors` rows are skipped.
import { LOCAL_PART_TYPE, mapColumns, type ColumnMapping, type ImportTarget, type MappingOverrides } from './columns';
import type { ParsedCsv } from './csv';
import { isValidSku, LOCALES, parsePriceCents, slugify, type Locale } from './local-product';

export interface ImportItem {
  /** File row number, header = 1. */
  row: number;
  key: string;
  sku: string;
  name: Partial<Record<Locale, string>>;
  description: Partial<Record<Locale, string>>;
  slug: Partial<Record<Locale, string>>;
  categoryKeys: string[];
  priceCents: number;
}

export interface ImportIssue {
  row: number;
  column?: string;
  message: string;
  effect: 'Skipped' | 'Default used';
}

export interface ValidationResult {
  rows: number;
  valid: number;
  warnings: number;
  errors: number;
  /** Rows that will be created: valid plus warnings (a warning row uses a default). */
  importable: number;
  mapping: ColumnMapping[];
  issues: ImportIssue[];
  items: ImportItem[];
}

export interface ValidateContext {
  storeKey: string;
  categoryKeys: ReadonlySet<string>;
  /** SKUs that already exist anywhere in the project (never say whose). */
  existingSkus: ReadonlySet<string>;
  existingKeys: ReadonlySet<string>;
  overrides?: MappingOverrides;
}

/** Product key of an imported local product. A product draft import overwrites an existing key, so existing keys are refused. */
export const localProductKey = (storeKey: string, sku: string): string => `local-${storeKey}-${sku}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

const FORMULA = /^[=+\-@]/;
const REQUIRED: ImportTarget[] = ['sku', 'price', 'categories'];

export function validateImport(parsed: ParsedCsv, ctx: ValidateContext): ValidationResult {
  const mapping = mapColumns(parsed.headers, ctx.overrides);
  const column = (target: ImportTarget) => mapping.findIndex((m) => m.target === target);
  const col = Object.fromEntries((['productType', 'key', 'sku', 'price', 'categories', 'name.de-DE', 'name.en-US', 'description.de-DE', 'description.en-US', 'slug.de-DE', 'slug.en-US'] as ImportTarget[]).map((t) => [t, column(t)])) as Record<ImportTarget, number>;
  const issues: ImportIssue[] = [];
  const items: ImportItem[] = [];
  const seenSkus = new Set<string>();
  let valid = 0;
  let warnings = 0;
  let errors = 0;

  parsed.rows.forEach((cells, index) => {
    const row = index + 2;
    const own: ImportIssue[] = [];
    const skip = (message: string, columnName?: string) => own.push({ row, message, effect: 'Skipped', ...(columnName ? { column: columnName } : {}) });
    const note = (message: string, columnName?: string) => own.push({ row, message, effect: 'Default used', ...(columnName ? { column: columnName } : {}) });
    const cell = (target: ImportTarget) => (col[target] >= 0 ? (cells[col[target]] ?? '').trim() : '');
    const header = (target: ImportTarget) => (col[target] >= 0 ? mapping[col[target]].header : target);

    // text cells: a leading = + - @ is kept as text (never evaluated)
    for (const target of ['sku', 'key', 'name.de-DE', 'name.en-US', 'description.de-DE', 'description.en-US', 'slug.de-DE', 'slug.en-US'] as ImportTarget[]) {
      if (FORMULA.test(cell(target))) note('The cell starts with a formula character and is kept as text', header(target));
    }

    const type = cell('productType');
    if (type && type !== LOCAL_PART_TYPE) skip(`Product type ${type} is not supported; only ${LOCAL_PART_TYPE}`, header('productType'));

    let sku = cell('sku');
    if (!sku) skip('The SKU is missing', header('sku'));
    else {
      if (sku !== sku.toUpperCase() && isValidSku(sku.toUpperCase())) {
        sku = sku.toUpperCase();
        note('The SKU was changed to capital letters', header('sku'));
      }
      if (!isValidSku(sku)) skip('The SKU is not valid (3 to 40 capital letters, digits, dots, dashes or underscores; MLV- is reserved)', header('sku'));
      else if (seenSkus.has(sku)) skip('The SKU appears twice in the file', header('sku'));
      else if (ctx.existingSkus.has(sku)) skip('SKU already in use', header('sku'));
    }

    const name: Partial<Record<Locale, string>> = {};
    for (const locale of LOCALES) {
      const text = cell(`name.${locale}` as ImportTarget);
      if (text) name[locale] = text.slice(0, 120);
    }
    if (!name['de-DE'] && !name['en-US']) skip('The name is missing', header('name.en-US'));
    else {
      for (const locale of LOCALES) {
        if (!name[locale]) {
          name[locale] = (name['de-DE'] ?? name['en-US']) as string;
          if (col[`name.${locale}` as ImportTarget] >= 0) note(`The ${locale} name is missing; the other language is used`, header(`name.${locale}` as ImportTarget));
        }
      }
      for (const locale of LOCALES) if ((name[locale] as string).length < 2) skip('The name needs at least 2 characters', header(`name.${locale}` as ImportTarget));
    }

    const rawPrice = cell('price');
    const priceCents = parsePriceCents(rawPrice);
    if (!rawPrice) skip('The price is missing', header('price'));
    else if (priceCents === null) skip('The price must be above zero with a point and at most two decimals', header('price'));

    const categoryKeys = cell('categories') ? cell('categories').split('|').map((k) => k.trim()).filter(Boolean) : [];
    if (categoryKeys.length === 0) skip('The category is missing', header('categories'));
    else for (const key of categoryKeys) if (!ctx.categoryKeys.has(key)) skip(`Unknown category ${key}`, header('categories'));

    const description: Partial<Record<Locale, string>> = {};
    const slug: Partial<Record<Locale, string>> = {};
    for (const locale of LOCALES) {
      const d = cell(`description.${locale}` as ImportTarget);
      if (d) description[locale] = d.slice(0, 2000);
      const s = slugify(cell(`slug.${locale}` as ImportTarget));
      if (s) slug[locale] = s;
      else if (name[locale]) {
        slug[locale] = slugify(`${name[locale]} ${sku}`) || slugify(sku);
        if (col[`slug.${locale}` as ImportTarget] >= 0) note(`The ${locale} slug is missing; it was made from the name`, header(`slug.${locale}` as ImportTarget));
      }
    }

    const key = cell('key') && !FORMULA.test(cell('key')) ? cell('key') : sku ? localProductKey(ctx.storeKey, sku) : '';
    if (key && ctx.existingKeys.has(key)) skip('A product with this key already exists', header('key'));

    const skipped = own.some((i) => i.effect === 'Skipped');
    issues.push(...own);
    if (skipped) errors += 1;
    else {
      if (own.length) warnings += 1;
      else valid += 1;
      seenSkus.add(sku);
      items.push({ row, key, sku, name, description, slug, categoryKeys, priceCents: priceCents as number });
    }
  });

  const missingColumns = REQUIRED.filter((t) => col[t] < 0);
  for (const target of missingColumns) issues.unshift({ row: 1, message: `The file has no ${target} column`, effect: 'Skipped', column: target });

  return { rows: parsed.rows.length, valid, warnings, errors, importable: valid + warnings, mapping, issues, items };
}

/** SKUs named in the file's SKU column (for the project-wide existence lookup before validation). */
export function collectSkus(parsed: ParsedCsv, overrides?: MappingOverrides): string[] {
  const index = mapColumns(parsed.headers, overrides).findIndex((m) => m.target === 'sku');
  if (index < 0) return [];
  return [...new Set(parsed.rows.map((r) => (r[index] ?? '').trim().toUpperCase()).filter(isValidSku))];
}
