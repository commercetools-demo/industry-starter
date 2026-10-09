import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Overview } from '@/components/portal/Overview';
import { listOpenThreads } from '@/lib/ct/portal-quotes';
import { getPortalData } from '@/lib/portal/data-source';
import { localizeVisits } from '@/lib/portal/localize';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { robots: { index: false } };

export default async function OverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, session] = await Promise.all([getTranslations('portal.overview'), getSession(locale)]);
  const bu = session.businessUnitKey;
  const data = getPortalData();
  const [visits, alerts, invoices] = bu ? await Promise.all([data.visits(bu), data.alerts(bu), data.invoices(bu)]) : [[], [], []];
  // Open quote requests come from the quotes module; if commercetools cannot answer, the block shows its empty text instead of failing the page.
  const requests = bu && session.customerId ? await listOpenThreads({ customerId: session.customerId, businessUnitKey: bu, locale: session.locale }).catch(() => []) : [];
  return <Overview title={t('title')} requests={requests} visits={(await localizeVisits(visits, locale)).sort((a, b) => a.date.localeCompare(b.date))} alerts={alerts} invoices={invoices} locale={locale} />;
}
