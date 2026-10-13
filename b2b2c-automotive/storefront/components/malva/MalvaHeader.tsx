// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// Header of the Malva level pages: wordmark, first-level categories of the whole catalogue, the "Find your reseller" button (opens the
// finder drawer) and the locale switch. No cart, no account link, no store chip: Malva level has no store, cart or account.
import { useTranslations } from 'next-intl';
import { FinderDrawerButton } from '@/components/malva/FinderDrawerButton';
import { LocaleSwitch } from '@/components/malva/LocaleSwitch';
import { Link, usePathname } from '@/i18n/routing';
import type { NavCategory } from '@/lib/types';

const ITEM = 'inline-flex min-h-7 items-center border-b-2 px-4 font-display text-sm font-medium text-text-body hover:text-text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export function MalvaHeader({ categories }: { categories: NavCategory[] }) {
  const t = useTranslations('malva.header');
  const common = useTranslations('common');
  const pathname = usePathname();
  return (
    <header className="bg-surface">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/" aria-label={t('homeLabel')} className="inline-flex min-h-7 items-center font-display text-xl font-bold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          {common('appName')}
        </Link>
        <div className="flex items-center gap-4">
          <FinderDrawerButton label={t('findReseller')} />
          <LocaleSwitch />
        </div>
      </div>
      <nav aria-label={t('navLabel')} className="border-b border-border">
        <ul className="mx-auto flex max-w-page overflow-x-auto whitespace-nowrap px-2">
          {categories.map((c) => {
            const href = `/categories/${c.slug}`;
            const active = pathname === href;
            return (
              <li key={c.id}>
                <Link href={href} aria-current={active ? 'page' : undefined} className={`${ITEM} ${active ? 'border-border-brand' : 'border-transparent'}`}>
                  {c.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
