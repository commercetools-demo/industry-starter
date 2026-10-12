// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';
// "Popular at {reseller}": 4 to 8 products from HomeData.popular (server read: seeded popularity rank, fit-only with a vehicle).
// The cards are the listing's ProductCard (stock line, price and old price, rating, add to cart).
import { useTranslations } from 'next-intl';
import { BlockLink } from '@/components/home/BlockLink';
import { useHomeData } from '@/components/home/HomeDataContext';
import { ProductCard } from '@/components/listing/ProductCard';
import { fillTemplate } from '@/lib/home/template';
import { parseBlockProps } from '@/lib/puck/automotive-blocks.schema';

export function PopularProducts(raw: Record<string, unknown>) {
  const t = useTranslations('home');
  const data = useHomeData();
  const props = parseBlockProps('PopularProducts', raw, { title: t.raw('popularTitle') as string, viewAllLabel: t('viewAll') });
  const items = data.popular.slice(0, props.count);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="home-popular-title" className="mx-auto w-full max-w-content px-5 py-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="home-popular-title" className="font-display text-2xl font-semibold text-text-strong">
          {fillTemplate(props.title, { reseller: data.storeName, city: data.branch?.city })}
        </h2>
        <BlockLink href="/parts" store={data.storeKey} className="font-utility text-sm font-medium text-text-link hover:underline">
          {props.viewAllLabel}
        </BlockLink>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(15.625rem,1fr))] gap-4">
        {items.map(({ product, fit }) => (
          <li key={product.id} className="contents">
            <ProductCard product={product} store={data.storeKey} fit={fit} city={data.branch?.city} shipDays={data.shipDays} alternativesHref={`/${data.storeKey}/parts?fit=0`} />
          </li>
        ))}
      </ul>
    </section>
  );
}
