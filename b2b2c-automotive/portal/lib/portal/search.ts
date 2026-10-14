/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Global search helpers (R-13). Pure: shared by the top bar, the palette and the (future) Product Search port.
import type { PartHit } from './types';

/** Attributes of the seed product type `mau-pt-part`. */
export const PART_NUMBER_ATTRIBUTE = 'part-number';
export const OE_ATTRIBUTE = 'oem-numbers';
export const MIN_QUERY = 2;
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export const catalogHref = (sku: string) => `/catalog?tab=assortment&sku=${encodeURIComponent(sku)}`;

export type EnterResult =
  | { kind: 'none' }
  | { kind: 'navigate'; href: string }
  | { kind: 'vin' }
  | { kind: 'palette'; prefill: string };

/** What Enter does in the top-bar field, given the parts the search returned for the same text. */
export function resolveEnter(raw: string, hits: PartHit[]): EnterResult {
  const q = raw.trim();
  if (q.length < MIN_QUERY) return { kind: 'none' };
  const exact = hits.find((h) => h.sku.toLowerCase() === q.toLowerCase() || h.oe?.toLowerCase() === q.toLowerCase());
  if (exact) return { kind: 'navigate', href: catalogHref(exact.sku) };
  if (VIN_PATTERN.test(q.toUpperCase())) return { kind: 'vin' };
  return { kind: 'palette', prefill: q };
}

/** Request body for `POST /in-store/key={store}/products/search` (store scoped Product Search). `language` is the name language. */
export function buildPartSearchBody(q: string, language: string) {
  return {
    query: {
      or: [
        { exact: { field: 'variants.sku', value: q } },
        { exact: { field: `variants.attributes.${PART_NUMBER_ATTRIBUTE}`, value: q } },
        { exact: { field: `variants.attributes.${OE_ATTRIBUTE}`, value: q } },
        { fullText: { field: 'name', language, value: q } },
      ],
    },
    limit: 8,
  };
}
