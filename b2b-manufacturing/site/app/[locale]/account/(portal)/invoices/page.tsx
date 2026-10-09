import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InvoicesList } from '@/components/portal/InvoicesList';
import { getPortalData } from '@/lib/portal/data-source';
import { getSession } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('portal.invoices'))('title'), robots: { index: false } };
}

export default async function InvoicesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [session, query] = await Promise.all([getSession(locale), searchParams]);
  const invoices = session.businessUnitKey ? await getPortalData().invoices(session.businessUnitKey) : [];
  return <InvoicesList invoices={invoices} params={query} locale={locale} />;
}
