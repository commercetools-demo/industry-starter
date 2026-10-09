import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Audiences } from '@/components/home/Audiences';
import { Hero } from '@/components/home/Hero';
import { Pillars } from '@/components/home/Pillars';
import { Proof } from '@/components/home/Proof';
import { StatsBand } from '@/components/home/StatsBand';
import { CtaBand } from '@/components/ui/content';
import { getSiteImage } from '@/content/images';
import { getAccreditations, getAudiences, getStats, getTestimonials } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';
import { ROUTES } from '@/lib/site';

/** Public and identical for every visitor: static with revalidation, never reads the session (D20). */
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return pageMetadata({ locale, title: `${t('metaTitle')} | Malva`, description: t('metaDescription') });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  return (
    <>
      <Hero image={getSiteImage('home-hero')} />
      <Pillars plumbingImage={getSiteImage('pillar-plumbing')} wasteImage={getSiteImage('pillar-waste')} />
      <StatsBand items={getStats()} />
      <Audiences items={getAudiences()} />
      <Proof accreditations={getAccreditations()} testimonials={getTestimonials()} />
      <CtaBand title={t('ctaTitle')} cta={t('ctaButton')} href={ROUTES.quote} />
    </>
  );
}
