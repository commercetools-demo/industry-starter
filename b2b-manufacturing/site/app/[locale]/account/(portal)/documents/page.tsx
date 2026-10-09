import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DocumentsList } from '@/components/portal/DocumentsList';
import { getPortalData } from '@/lib/portal/data-source';
import { getSession } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('portal.documents'))('title'), robots: { index: false } };
}

export default async function DocumentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [session, query] = await Promise.all([getSession(locale), searchParams]);
  const docs = session.businessUnitKey ? await getPortalData().wasteDocs(session.businessUnitKey) : [];
  return <DocumentsList docs={docs} params={query} locale={locale} />;
}
