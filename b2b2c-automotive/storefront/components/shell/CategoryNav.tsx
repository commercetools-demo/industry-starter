// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import type { NavCategory } from '@/lib/types';

const ITEM = 'inline-flex min-h-7 items-center border-b-2 px-4 font-display text-sm font-medium text-text-body hover:text-text-link';

/**
 * "All parts" first, then the first-level categories of the store's assortment. The active item has a 2 px underline in the brand
 * border token and `aria-current="page"`. The list scrolls sideways on narrow screens (no mobile menu in this phase, D9).
 */
export function CategoryNav({ store, categories }: { store: string; categories: NavCategory[] }) {
  const t = useTranslations('shell.nav');
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const items = [
    { key: 'all', href: `/${store}/parts`, label: t('allParts') },
    ...categories.map((c) => ({ key: c.id, href: `/${store}/category/${c.slug}`, label: c.name })),
  ];
  return (
    <nav aria-label={t('label')} className="border-b border-border bg-surface">
      <ul className="mx-auto flex max-w-page overflow-x-auto whitespace-nowrap px-2">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.key}>
              <Link href={item.href} aria-current={active ? 'page' : undefined} className={`${ITEM} ${active ? 'border-border-brand' : 'border-transparent'}`}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
