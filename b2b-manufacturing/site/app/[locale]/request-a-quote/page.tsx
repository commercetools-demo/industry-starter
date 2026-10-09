import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactAside } from '@/components/quote/ContactAside';
import { RequestForm } from '@/components/quote/RequestForm';
import { pageMetadata } from '@/lib/seo';
import { PageHeader } from '@/components/ui/content';

/** A static shell: `?service=` and `?sector=` are read in the browser, and everything per-visitor is fetched there too (D20). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'requestQuote' });
  return pageMetadata({ locale, title: t('metaTitle'), description: t('metaDescription'), path: '/request-a-quote' });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('requestQuote');
  return (
    <>
      <PageHeader breadcrumb={{ homeLabel: t('crumbHome'), current: t('title') }} title={t('title')} lead={t('lead')} />
      <section className="s"><div className="wrap ql-grid">
        <Suspense fallback={<div className="rq-skeleton" aria-hidden="true" />}><RequestForm /></Suspense>
        <ContactAside locale={locale} />
      </div></section>
    </>
  );
}
