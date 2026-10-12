// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { NavCategory } from '@/lib/types';

/** Home, the category trail (each a link to its listing) and the product name as the current page. */
export function Breadcrumb({ store, trail, name }: { store: string; trail: NavCategory[]; name: string }) {
  const t = useTranslations('pdp');
  return (
    <nav aria-label={t('breadcrumb')} className="font-ui text-sm text-text-muted">
      <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
        <li>
          <Link href={`/${store}`} className="text-text-link hover:underline">
            {t('home')}
          </Link>
        </li>
        {trail.map((category) => (
          <li key={category.id} className="flex items-center gap-2">
            <span aria-hidden="true">›</span>
            <Link href={`/${store}/category/${category.slug}`} className="text-text-link hover:underline">
              {category.name}
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden="true">›</span>
          <span aria-current="page">{name}</span>
        </li>
      </ol>
    </nav>
  );
}
