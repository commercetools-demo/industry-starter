import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { QuotesList } from '@/components/portal/QuotesList';

export const metadata: Metadata = { robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <QuotesList />;
}
