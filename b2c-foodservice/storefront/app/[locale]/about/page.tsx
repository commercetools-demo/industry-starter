import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import AboutView from '@/components/content/AboutView';
import { ABOUT } from '@/content/about';
import { hasOwnText, resolveLocalized } from '@/lib/content/localized';
import { pageMetadata } from '@/lib/content/seo';
import { aboutHref } from '@/lib/routes';
import { routing } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { value } = resolveLocalized(ABOUT, locale);
  return pageMetadata({
    locale,
    path: aboutHref(),
    title: value.title,
    description: value.metaDescription,
    ownLocales: routing.locales.filter((l) => hasOwnText(ABOUT, l)),
  });
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AboutView locale={locale} />;
}
