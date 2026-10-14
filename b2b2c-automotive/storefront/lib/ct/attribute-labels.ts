// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Enum labels of the part product type for the filter panel (brand names, part positions). The product type is the same for
// every shopper: one in-memory cache per server instance, one hour (same style as the store lookup of workstream G).
import 'server-only';
import type { ProductType } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { PART_PRODUCT_TYPE_KEY } from '@/lib/search/facet-config';
import { createTtlCache } from '@/lib/ttl-cache';
import { getLocalizedString } from '@/lib/utils';

/** `labels[attributeName][enumKey]` */
export type EnumLabels = Record<string, Record<string, string>>;

const cache = createTtlCache<ProductType>({ ttlMs: 3_600_000, negativeTtlMs: 30_000 });

function toLabels(type: ProductType, locale: string): EnumLabels {
  const out: EnumLabels = {};
  for (const attribute of type.attributes ?? []) {
    const t = attribute.type;
    if (t.name !== 'enum' && t.name !== 'lenum') continue;
    out[attribute.name] = Object.fromEntries(
      t.values.map((v) => [v.key, typeof v.label === 'string' ? v.label : getLocalizedString(v.label as Record<string, string>, locale)]),
    );
  }
  return out;
}

/** Labels of every enum attribute of `mau-pt-part`; `{}` when the product type cannot be read (the panel then shows humanised keys). */
export async function getEnumLabels(locale: string): Promise<EnumLabels> {
  const hit = cache.get(PART_PRODUCT_TYPE_KEY);
  if (hit?.value) return toLabels(hit.value, locale);
  try {
    const { body } = await apiRoot.productTypes().withKey({ key: PART_PRODUCT_TYPE_KEY }).get().execute();
    cache.set(PART_PRODUCT_TYPE_KEY, body);
    return toLabels(body, locale);
  } catch {
    console.error('[listing] enum labels could not be read');
    const stale = cache.getStale(PART_PRODUCT_TYPE_KEY)?.value;
    return stale ? toLabels(stale, locale) : {};
  }
}
