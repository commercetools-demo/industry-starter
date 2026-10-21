import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import ContactView from '@/components/contact/ContactView';
import { pageMetadata } from '@/lib/content/seo';
import { contactHref } from '@/lib/routes';
import { routing } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return pageMetadata({ locale, path: contactHref(), title: t('title'), description: t('intro'), ownLocales: [...routing.locales] });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContactView locale={locale} />;
}
