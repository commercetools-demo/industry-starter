// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// "Shop by category" of the Malva home: a tile per first-level category of the whole catalogue, linking to its Malva listing.
// Categories carry no image in the navigation read, so a tile is the name on a brand surface (same look as the reseller home).
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { NavCategory } from '@/lib/types';

export function MalvaCategoryTiles({ categories }: { categories: NavCategory[] }) {
  const t = useTranslations('malva.categories');
  const tiles = categories.filter((c) => c.name.trim() !== '' && c.slug.trim() !== '');
  if (tiles.length === 0) return null;
  return (
    <section aria-labelledby="malva-categories-title" className="mx-auto w-full max-w-content px-5 py-5">
      <h2 id="malva-categories-title" className="mb-4 font-display text-2xl font-semibold text-text-strong">
        {t('title')}
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.375rem,1fr))] gap-3">
        {tiles.map((c) => (
          <li key={c.id} className="contents">
            <Link
              href={`/categories/${c.slug}`}
              aria-label={t('tileLabel', { category: c.name })}
              className="flex min-h-9 items-end rounded-lg bg-surface-brand-deep p-4 font-display text-sm font-semibold text-text-on-brand hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
