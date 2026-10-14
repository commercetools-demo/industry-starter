/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Sanity limits of a bundle (W-08). There is no price floor (Q-T03): a price only has to be above zero. Pure.
export interface BundleDraft {
  name: string;
  discountPercent: number;
  components: { sku: string; qty: number }[];
}

export type BundleIssueCode = 'NAME_LENGTH' | 'COMPONENT_COUNT' | 'COMPONENT_DUPLICATE' | 'QUANTITY_RANGE' | 'DISCOUNT_RANGE' | 'COMPONENT_PRICE' | 'BUNDLE_PRICE';

export interface BundleIssue {
  code: BundleIssueCode;
  message: string;
  sku?: string;
}

export const BUNDLE_LIMITS = { minComponents: 2, maxComponents: 8, minQty: 1, maxQty: 20, minDiscount: 1, maxDiscount: 50, minName: 3, maxName: 80 } as const;

/** `retailCents` maps a SKU to its price (null: no price). Returns every issue; empty means valid. */
export function validateBundle(draft: BundleDraft, retailCents: ReadonlyMap<string, number | null>, bundleCents?: number): BundleIssue[] {
  const L = BUNDLE_LIMITS;
  const issues: BundleIssue[] = [];
  const name = draft.name.trim();
  if (name.length < L.minName || name.length > L.maxName) issues.push({ code: 'NAME_LENGTH', message: `The name needs ${L.minName} to ${L.maxName} characters` });
  if (draft.components.length < L.minComponents || draft.components.length > L.maxComponents) issues.push({ code: 'COMPONENT_COUNT', message: `A bundle has ${L.minComponents} to ${L.maxComponents} components` });
  const seen = new Set<string>();
  for (const c of draft.components) {
    if (seen.has(c.sku)) issues.push({ code: 'COMPONENT_DUPLICATE', message: 'Each part can be a component once', sku: c.sku });
    seen.add(c.sku);
    if (!Number.isInteger(c.qty) || c.qty < L.minQty || c.qty > L.maxQty) issues.push({ code: 'QUANTITY_RANGE', message: `Quantity is ${L.minQty} to ${L.maxQty}`, sku: c.sku });
    const price = retailCents.get(c.sku);
    if (price === null || price === undefined || !(price > 0)) issues.push({ code: 'COMPONENT_PRICE', message: 'A component has no price above zero', sku: c.sku });
  }
  if (!Number.isFinite(draft.discountPercent) || draft.discountPercent < L.minDiscount || draft.discountPercent > L.maxDiscount) {
    issues.push({ code: 'DISCOUNT_RANGE', message: `The discount is ${L.minDiscount} to ${L.maxDiscount} percent` });
  }
  if (bundleCents !== undefined && !(bundleCents > 0)) issues.push({ code: 'BUNDLE_PRICE', message: 'The bundle price must be above zero' });
  return issues;
}
