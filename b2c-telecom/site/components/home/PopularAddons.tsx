/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { ProductImage } from '@/components/ui/ProductImage';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { ADDONS_CATEGORY_KEY } from '@/lib/config/listing';
import { formatMoney } from '@/lib/format';
import type { PopularAddon } from '@/lib/home/derive';
import { categoryPath, offerPath } from '@/lib/listing/links';
import type { Category, Locale } from '@/lib/types';

type PopularAddonsProps = { locale: Locale; tree: Category[]; addons: PopularAddon[] };

/** The "Popular add-ons" band; hidden when no add-on can be shown. Each tile opens the add-on's canonical card (D-052). */
export function PopularAddons({ locale, tree, addons }: PopularAddonsProps): ReactElement | null {
  const t = useTranslations('home.addons');
  const tiles = addons.flatMap((addon) => {
    const href = offerPath(addon.offer, locale, tree);
    return href === undefined ? [] : [{ addon, href }];
  });
  if (tiles.length === 0) return null;
  const viewAll = categoryPath(ADDONS_CATEGORY_KEY, locale, tree);
  return (
    <section aria-labelledby="home-addons" className="bg-surface-brand-subtle py-(--ext-space-56)">
      <div className="mx-auto flex w-full max-w-(--container-width) flex-col gap-7 px-5 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-5">
          <h2 id="home-addons" className="m-0 font-display text-4xl font-bold">
            {t('title')}
          </h2>
          {viewAll ? (
            <Link href={viewAll} className={`font-display text-md font-semibold text-action ${FOCUS_RING}`}>
              {t('viewAll')}
            </Link>
          ) : null}
        </div>
        <ul className="m-0 grid list-none grid-cols-2 gap-5 p-0 md:grid-cols-4">
          {tiles.map(({ addon, href }) => (
            <li key={addon.key}>
              <Link href={href} className={`flex h-full flex-col overflow-hidden rounded-lg bg-surface text-text no-underline hover:shadow-md ${FOCUS_RING}`}>
                <ProductImage src={addon.offer.image} name={addon.name} sizes="(min-width: 48rem) 16rem, 50vw" />
                <span className="flex flex-col p-4">
                  <span className="font-display text-md font-semibold">{addon.name}</span>
                  <span className="text-sm text-text-muted">{t('price', { price: formatMoney(addon.price, locale) })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
