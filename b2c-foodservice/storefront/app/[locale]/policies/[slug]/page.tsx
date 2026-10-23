import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import PolicyView from '@/components/content/PolicyView';
import { POLICIES } from '@/content/policies';
import { routing } from '@/i18n/routing';
import { getPageFigures } from '@/lib/content/figures';
import { hasOwnText, resolveLocalized } from '@/lib/content/localized';
import { pageMetadata } from '@/lib/content/seo';
import { POLICY_SLUGS, policyHref, type PolicySlug } from '@/lib/routes';

type Props = { params: Promise<{ locale: string; slug: string }> };

function isPolicySlug(slug: string): slug is PolicySlug {
  return (POLICY_SLUGS as readonly string[]).includes(slug);
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => POLICY_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isPolicySlug(slug)) return {};
  const { value } = resolveLocalized(POLICIES[slug], locale);
  return pageMetadata({
    locale,
    path: policyHref(slug),
    title: value.title,
    description: value.metaDescription,
    ownLocales: routing.locales.filter((l) => hasOwnText(POLICIES[slug], l)),
  });
}

export default async function PolicyPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isPolicySlug(slug)) notFound();
  setRequestLocale(locale);
  const figures = await getPageFigures(locale);
  return <PolicyView slug={slug} locale={locale} figures={figures} />;
}
