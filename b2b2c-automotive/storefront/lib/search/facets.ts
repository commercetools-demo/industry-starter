// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Facet buckets of a search response to the filter groups of the panel (workstream L). Pure.
import { FACETS } from './facet-config';
import type { ListingParams } from './params';
import type { FacetGroup } from '@/lib/types';

export interface FacetBuckets {
  name: string;
  buckets: { key: string; count: number }[];
}

/** `malva-select` to `Malva Select`: the label when the product type has none. */
export const humanizeKey = (key: string): string => key.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const selectedOf = (params: ListingParams, name: string): string[] => (name === 'brand' ? params.brand : (params.attrs[name] ?? []));

/**
 * One group per configured facet that the response returned: the brand group when it has a value, a part facet (quality,
 * position) only with at least two values. Options are sorted alphabetically by label, ignoring counts. A selected value is
 * always listed (count 0 when the result no longer has it) so it can be unticked. `title` is the facet name; the page replaces
 * it with the translated group title.
 */
export function buildFacetGroups(facets: readonly FacetBuckets[], params: ListingParams, labels: Record<string, Record<string, string>>): FacetGroup[] {
  const groups: FacetGroup[] = [];
  for (const config of FACETS) {
    const found = facets.find((f) => f.name === config.name);
    if (!found) continue;
    const selected = new Set(selectedOf(params, config.name));
    const options = found.buckets.filter((b) => b.count > 0).map((b) => ({ key: b.key, count: b.count }));
    for (const key of selected) if (!options.some((o) => o.key === key)) options.push({ key, count: 0 });
    const minimum = config.name === 'brand' ? 1 : 2;
    if (options.length < minimum) continue;
    groups.push({
      name: config.name,
      param: config.param,
      title: config.name,
      options: options
        .map((o) => ({ key: o.key, label: labels[config.name]?.[o.key] ?? humanizeKey(o.key), count: o.count, selected: selected.has(o.key) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    });
  }
  return groups;
}
