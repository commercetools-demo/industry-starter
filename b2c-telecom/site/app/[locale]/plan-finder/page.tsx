import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PlanFinder } from '@/components/finder/PlanFinder';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { isLocale } from '@/lib/config/markets';

// The plan finder: one screen to pick a plan, its extras and continue to the bundle. Everything on it is read client-side from the public
// offer endpoints for the buyer, so the page itself is static and never cached per buyer.

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'finder' });
  return { title: t('title') };
}

const OFFER_KEY = /^malva-offer-[a-z0-9-]+$/;

export default async function PlanFinderPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ plan?: string | string[] }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('finder');
  const { plan } = await searchParams;
  const initialPlanKey = typeof plan === 'string' && OFFER_KEY.test(plan) ? plan : undefined;

  return (
    <>
      <section className="bg-brand-100 py-10 md:py-12">
        <div className="mx-auto w-full max-w-(--container-width) px-5 md:px-10">
          <Breadcrumb items={[{ label: t('home'), href: '/' }, { label: t('title') }]} />
          <h1 className="mb-2 mt-3 font-display text-5xl font-bold tracking-ui">{t('title')}</h1>
          <p className="m-0 text-md text-text-muted">{t('intro')}</p>
        </div>
      </section>
      <section aria-label={t('title')} className="mx-auto w-full max-w-(--container-width) px-5 pb-16 pt-8 md:px-10">
        <PlanFinder initialPlanKey={initialPlanKey} />
      </section>
    </>
  );
}
