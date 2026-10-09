import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AvailableToday } from '@/components/home/AvailableToday';
import { ClosingCta } from '@/components/home/ClosingCta';
import { Hero } from '@/components/home/Hero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { JournalRow } from '@/components/home/JournalRow';
import { RxDelivery } from '@/components/home/RxDelivery';
import { ServicesGrid } from '@/components/home/ServicesGrid';
import { StatsBand } from '@/components/home/StatsBand';
import { siteImage } from '@/content/images';
import { getPublishedArticles } from '@/lib/content';
import { getHomeSnapshot, hasSameDayMethod } from '@/lib/ct/home';
import { autoRefillEnabled } from '@/lib/features';
import { showJournal } from '@/lib/routes';
import { pageMetadata } from '@/lib/seo';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

/** Journal cards on the home page. */
const JOURNAL_CARDS = 3;

/**
 * Home page (design-home-page, home-landing-page). The body is shared markup: nothing here depends on the
 * visitor (the header and its cart count and sign-in state come from the session in the layout). Live parts
 * (doctors available today, statistics) read public data only, with a 60 s shared cache; when the sources are
 * down those parts are left out and the static page still renders.
 */
export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const region = COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE];
  const [snapshot, sameDay] = await Promise.all([
    getHomeSnapshot({ locale, currency: region.currency, country: region.country }),
    hasSameDayMethod(),
  ]);
  const articles = showJournal(locale) ? getPublishedArticles(locale).slice(0, JOURNAL_CARDS) : [];
  return (
    <>
      <Hero image={siteImage('home-hero')} availableToday={snapshot?.stats.availableToday ?? null} />
      <ServicesGrid />
      <HowItWorks />
      <AvailableToday data={snapshot?.available ?? null} />
      <RxDelivery image={siteImage('home-rx-delivery')} sameDay={sameDay} autoRefill={autoRefillEnabled()} />
      <StatsBand stats={snapshot?.stats ?? null} />
      <JournalRow articles={articles} />
      <ClosingCta image={siteImage('home-cta')} />
    </>
  );
}

/** Title, description, absolute canonical (`<SITE_URL>/<locale>`) and hreflang alternates for every supported locale plus x-default. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return pageMetadata({ locale, path: '/', title: t('metaTitle'), description: t('metaDescription') });
}
