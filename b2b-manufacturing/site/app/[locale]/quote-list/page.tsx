import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { QuoteListPage } from '@/components/quote/QuoteListPage';
import { PageHeader } from '@/components/ui/content';

/** A static shell: the list itself is fetched in the browser (the page never reads the session). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'quoteList' });
  return pageMetadata({ locale, title: t('metaTitle'), description: t('metaDescription'), path: '/quote-list', noindex: true });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('quoteList');
  return (
    <>
      <PageHeader breadcrumb={{ homeLabel: t('crumbHome'), current: t('title') }} title={t('title')} lead={t('lead')} />
      <section className="s"><div className="wrap"><QuoteListPage /></div></section>
    </>
  );
}
