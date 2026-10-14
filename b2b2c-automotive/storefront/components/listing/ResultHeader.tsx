// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { SortSelect } from '@/components/listing/SortSelect';
import { GarageBar } from '@/components/vehicle/GarageBar';
import { Link } from '@/i18n/routing';
import type { SortKey } from '@/lib/search/params';

export interface Crumb {
  label: string;
  /** Address without locale, for example `/{store}/category/brakes`. */
  href: string;
}

export interface ResultHeaderProps {
  store: string;
  title: string;
  /** Between "Home" and the current page (the category's ancestors, root first). */
  crumbs: Crumb[];
  count: number;
  /** City of the selected branch for "prices and stock for {city}". */
  city?: string;
  sort: SortKey | 'relevance';
  hasQuery: boolean;
  /** The mobile filter button (`FilterSheet`), placed beside the sort control. */
  filterButton?: ReactNode;
}

/** Breadcrumb, garage bar, title, count line with the store city, and the sort control (design view `plp`). */
export function ResultHeader({ store, title, crumbs, count, city, sort, hasQuery, filterButton }: ResultHeaderProps) {
  const t = useTranslations('listing');
  return (
    <header className="grid gap-5">
      <nav aria-label={t('breadcrumb')} className="font-ui text-sm text-text-muted">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
          <li>
            <Link href={`/${store}`} className="text-text-link hover:underline">
              {t('home')}
            </Link>
          </li>
          {crumbs.map((crumb) => (
            <li key={crumb.href} className="flex items-center gap-2">
              <span aria-hidden="true">›</span>
              <Link href={crumb.href} className="text-text-link hover:underline">
                {crumb.label}
              </Link>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span aria-hidden="true">›</span>
            <span aria-current="page">{title}</span>
          </li>
        </ol>
      </nav>
      <GarageBar />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 font-display text-3xl font-semibold text-text">{title}</h1>
          <p className="m-0 font-ui text-sm text-text-muted">{city ? t('count', { count, city }) : t('countNoCity', { count })}</p>
        </div>
        <div className="flex items-end gap-3">
          {filterButton}
          <SortSelect value={sort} hasQuery={hasQuery} />
        </div>
      </div>
    </header>
  );
}
