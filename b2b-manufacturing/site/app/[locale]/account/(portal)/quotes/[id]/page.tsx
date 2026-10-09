import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { QuotesDetail } from '@/components/portal/QuotesDetail';

export const metadata: Metadata = { robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <QuotesDetail id={id} />;
}
