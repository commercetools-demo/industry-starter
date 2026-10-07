import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ContentArticle } from '@/components/content/ContentArticle';
import { FaqSections } from '@/components/content/FaqSections';
import { JsonLd } from '@/components/content/JsonLd';
import { getFaq } from '@/lib/content/faq';
import { faqJsonLd } from '@/lib/content/jsonld';
import { contentMetadata } from '@/lib/content/metadata';
import { LOCALES, isSupportedLocale } from '@/lib/utils';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const faq = getFaq(locale);
  if (!faq) return {};
  const { page } = faq;
  return contentMetadata({ title: page.title, description: page.description, locale, pathname: '/faq', fallback: page.fallback });
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const faq = getFaq(locale);
  if (!faq) notFound();
  return (
    <ContentArticle doc={faq.page}>
      <FaqSections topics={faq.topics} />
      <JsonLd data={faqJsonLd(faq)} />
    </ContentArticle>
  );
}
