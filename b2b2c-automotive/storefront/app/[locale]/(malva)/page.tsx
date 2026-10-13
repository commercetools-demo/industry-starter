// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BannerCarousel } from '@/components/malva/BannerCarousel';
import { MalvaCategoryTiles } from '@/components/malva/MalvaCategoryTiles';
import { ResellerFinder } from '@/components/malva/ResellerFinder';
import { isAppLocale } from '@/i18n/config';
import { getMalvaBanners } from '@/lib/ct/malva-banners';
import { getMalvaNavCategories } from '@/lib/ct/malva-catalog';
import type { NavCategory } from '@/lib/types';

/**
 * The Malva home at `/{locale}` (no store segment, no session): banner carousel, the reseller finder centred below it, category tiles.
 * The header and footer come from the Malva layout. A missing banner object or a category outage drops that block, never the page.
 */
export default async function MalvaHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'malva.finder' });
  const [banners, categories] = await Promise.all([
    getMalvaBanners(locale).catch(() => []),
    getMalvaNavCategories(locale).catch((): NavCategory[] => []),
  ]);
  return (
    <main id="main" className="text-text">
      <BannerCarousel banners={banners} />
      <section aria-labelledby="malva-finder-title" className="mx-auto flex w-full max-w-content flex-col items-center px-5 py-6">
        <div className="mb-4 text-center">
          <h2 id="malva-finder-title" className="font-display text-3xl font-semibold text-text-strong">
            {t('title')}
          </h2>
          <p className="mt-2 font-body text-md text-text-muted">{t('intro')}</p>
        </div>
        <div className="w-full rounded-xl border border-border bg-surface p-5 shadow-card">
          <ResellerFinder mode="inline" locale={locale} />
        </div>
      </section>
      <MalvaCategoryTiles categories={categories} />
    </main>
  );
}
