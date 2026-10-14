// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import { clearFilters, listingHref as hrefFor, removeFilter, type FilterKey, type ListingParams } from '@/lib/search/params';
import type { FacetGroup } from '@/lib/types';

export interface ActiveFiltersProps {
  params: ListingParams;
  /** Address of the surface without locale and query: `/{store}/parts`, `/{store}/category/{slug}` or `/{store}/search`. */
  basePath: string;
  groups: FacetGroup[];
  /** City of the selected branch for the pickup chip. */
  city?: string;
}

/**
 * One removable chip per active filter (brand, part facets, pickup) and "Clear all" (keeps the query, sort and category).
 * Links, so removing a filter works without JavaScript and goes back to page 1.
 */
export function ActiveFilters({ params, basePath, groups, city }: ActiveFiltersProps) {
  const t = useTranslations('listing');
  const labelOf = (name: string, key: string) => groups.find((g) => g.name === name)?.options.find((o) => o.key === key)?.label ?? key;
  const chips: { id: string; label: string; href: string }[] = [];
  for (const b of params.brand) chips.push({ id: `brand:${b}`, label: labelOf('brand', b), href: hrefFor(basePath, removeFilter(params, 'brand', b)) });
  for (const [name, selected] of Object.entries(params.attrs)) {
    for (const v of selected) {
      const key: FilterKey = `attr:${name}`;
      chips.push({ id: `${name}:${v}`, label: labelOf(name, v), href: hrefFor(basePath, removeFilter(params, key, v)) });
    }
  }
  if (params.pickup) chips.push({ id: 'pickup', label: t('chipPickup', { city: city ?? '' }).trim(), href: hrefFor(basePath, removeFilter(params, 'pickup')) });
  if (chips.length === 0) return null;

  return (
    <div role="group" aria-label={t('activeFilters')} className="flex flex-wrap items-center gap-2">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {chips.map((chip) => (
          <li key={chip.id}>
            <Link
              href={chip.href}
              aria-label={t('removeFilter', { label: chip.label })}
              className="inline-flex min-h-7 items-center gap-2 rounded-xs border border-border-strong bg-surface-quiet px-3 font-ui text-sm text-text hover:bg-surface-subtle"
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={hrefFor(basePath, clearFilters(params))} className={buttonClass('link')}>
        {t('clearAll')}
      </Link>
    </div>
  );
}
