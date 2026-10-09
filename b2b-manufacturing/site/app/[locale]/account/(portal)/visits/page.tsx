import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { VisitsList } from '@/components/portal/VisitsList';
import { getPortalData } from '@/lib/portal/data-source';
import { localizeVisits } from '@/lib/portal/localize';
import { getSession } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('portal.visits'))('title'), robots: { index: false } };
}

export default async function VisitsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [session, query] = await Promise.all([getSession(locale), searchParams]);
  const visits = session.businessUnitKey ? await getPortalData().visits(session.businessUnitKey) : [];
  return <VisitsList visits={await localizeVisits(visits, locale)} params={query} />;
}
