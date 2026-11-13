import { brandOf } from '@/lib/brands';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import JournalView from '@/components/journal/JournalView';
import { routing } from '@/i18n/routing';
import { parseJournalQuery } from '@/lib/content/journal';
import { pageMetadata } from '@/lib/content/seo';
import { journalHref } from '@/lib/routes';

type Props = {
  params: Promise<{ brand?: string; locale: string }>;
  searchParams: Promise<{ tag?: string | string[]; q?: string | string[]; page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'journal' });
  return pageMetadata({ brand: brandOf(brand).slug, locale, path: journalHref(), title: t('title'), description: t('intro'), ownLocales: [...routing.locales] });
}

export default async function JournalPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseJournalQuery(await searchParams);
  return <JournalView locale={locale} query={query} />;
}
