import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ClosingCta } from '@/components/home/ClosingCta';
import { Hero } from '@/components/home/Hero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { ServicesGrid } from '@/components/home/ServicesGrid';
import { siteImage } from '@/content/images';

/**
 * Home page (design-home-page, home-landing-page). The body is shared markup: nothing here depends on the
 * visitor (the header and its cart count and sign-in state come from the session in the layout). Live parts
 * (doctors available today, statistics) read public data only, with a 60 s shared cache.
 */
export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Hero image={siteImage('home-hero')} availableToday={null} />
      <ServicesGrid />
      <HowItWorks />
      <ClosingCta />
    </>
  );
}

export const metadata: Metadata = {};
