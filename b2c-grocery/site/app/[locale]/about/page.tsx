import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ContentArticle } from '@/components/content/ContentArticle';
import { getPage } from '@/lib/content';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const page = await getPage('about', locale);
  return page ? { title: page.title, description: page.description } : {};
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const page = await getPage('about', locale);
  if (!page) notFound();
  return <ContentArticle page={page} />;
}
