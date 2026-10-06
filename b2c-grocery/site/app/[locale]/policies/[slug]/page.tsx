import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ContentArticle } from '@/components/content/ContentArticle';
import { getPage, POLICY_SLUGS } from '@/lib/content';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return POLICY_SLUGS.map((slug) => ({ slug }));
}

const isPolicy = (slug: string) => (POLICY_SLUGS as readonly string[]).includes(slug);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = isPolicy(slug) ? await getPage(`policies/${slug}`, locale) : null;
  return page ? { title: page.title, description: page.description } : {};
}

export default async function PolicyPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = isPolicy(slug) ? await getPage(`policies/${slug}`, locale) : null;
  if (!page) notFound();
  return <ContentArticle page={page} />;
}
