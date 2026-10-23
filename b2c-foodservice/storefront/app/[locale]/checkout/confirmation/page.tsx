import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import NoRecentOrder from '@/components/order/NoRecentOrder';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'order.none' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** `/[locale]/checkout/confirmation` without an id: "No recent order" (HTTP 200). */
export default async function ConfirmationIndexRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NoRecentOrder locale={locale} />;
}
