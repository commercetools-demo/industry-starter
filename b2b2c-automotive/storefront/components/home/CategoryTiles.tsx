// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// "Shop by category": one tile per first-level category of the store's assortment (HomeData.categories, the same list as the
// shell navigation). A category without a name or slug never renders as an empty tile.
import { useTranslations } from 'next-intl';
import { BlockLink } from '@/components/home/BlockLink';
import { useHomeData } from '@/components/home/HomeDataContext';
import { Link } from '@/i18n/routing';
import { fillTemplate } from '@/lib/home/template';
import { parseBlockProps } from '@/lib/puck/automotive-blocks.schema';

export function CategoryTiles(raw: Record<string, unknown>) {
  const t = useTranslations('home');
  const data = useHomeData();
  const props = parseBlockProps('CategoryTiles', raw, { title: t('categoriesTitle') });
  const tiles = data.categories.filter((c) => c.name.trim() !== '' && c.slug.trim() !== '');
  if (tiles.length === 0) return null;

  return (
    <section aria-labelledby="home-categories-title" className="mx-auto w-full max-w-content px-5 py-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="home-categories-title" className="font-display text-2xl font-semibold text-text-strong">
          {fillTemplate(props.title, { reseller: data.storeName, city: data.branch?.city })}
        </h2>
        {props.viewAllLabel ? (
          <BlockLink href="/parts" store={data.storeKey} className="inline-flex min-h-7 items-center font-utility text-sm font-medium text-text-link hover:underline">
            {props.viewAllLabel}
          </BlockLink>
        ) : null}
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.375rem,1fr))] gap-3">
        {tiles.map((c) => (
          <li key={c.id} className="contents">
            <Link
              href={`/${data.storeKey}/category/${c.slug}`}
              className="flex min-h-9 items-end rounded-lg bg-surface-brand-deep p-4 font-display text-sm font-semibold text-text-on-brand hover:bg-brand-800"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
