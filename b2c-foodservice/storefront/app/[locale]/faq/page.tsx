import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import FaqView from '@/components/faq/FaqView';
import { getPageFigures } from '@/lib/content/figures';
import { pageMetadata } from '@/lib/content/seo';
import { faqHref } from '@/lib/routes';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'faq' });
  // The FAQ text exists in en-US only today, so only en-US is advertised as an alternate.
  return pageMetadata({ locale, path: faqHref(), title: t('title'), description: t('intro'), ownLocales: ['en-US'] });
}

export default async function FaqPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);
  const figures = await getPageFigures(locale);
  return <FaqView locale={locale} figures={figures} openId={Array.isArray(q) ? q[0] : q} />;
}
