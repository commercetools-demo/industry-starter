import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ContentArticle } from '@/components/content/ContentArticle';
import { contentMetadata } from '@/lib/content/metadata';
import { getPage } from '@/lib/content/pages';
import { LOCALES, isSupportedLocale } from '@/lib/utils';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const doc = getPage('about', locale);
  if (!doc) return {};
  return contentMetadata({ title: doc.title, description: doc.description, locale, pathname: '/about', fallback: doc.fallback });
}

// Static content: this page never touches the commerce API, so it renders when commercetools is down.
export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  setRequestLocale(locale);
  const doc = getPage('about', locale);
  if (!doc) notFound();
  return <ContentArticle doc={doc} />;
}
