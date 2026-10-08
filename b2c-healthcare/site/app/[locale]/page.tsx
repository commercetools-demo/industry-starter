import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { AvailableToday } from '@/components/home/AvailableToday';
import { ClosingCta } from '@/components/home/ClosingCta';
import { Hero } from '@/components/home/Hero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { ServicesGrid } from '@/components/home/ServicesGrid';
import { StatsBand } from '@/components/home/StatsBand';
import { siteImage } from '@/content/images';
import { getHomeSnapshot } from '@/lib/ct/home';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, isSupportedLocale } from '@/lib/utils';

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
  const snapshot = await getHomeSnapshot({ locale, currency: region.currency, country: region.country });
  return (
    <>
      <Hero image={siteImage('home-hero')} availableToday={snapshot?.stats.availableToday ?? null} />
      <ServicesGrid />
      <HowItWorks />
      <AvailableToday data={snapshot?.available ?? null} />
      <StatsBand stats={snapshot?.stats ?? null} />
      <ClosingCta />
    </>
  );
}

export const metadata: Metadata = {};
