import { useTranslations } from 'next-intl';
import { LinkButton } from '@/components/ui/Button';
import { Link } from '@/i18n/routing';
import type { Alert, Invoice, Visit } from '@/lib/portal/data-source';
import type { QuoteThread } from '@/lib/portal/types';
import { ROUTES } from '@/lib/site';
import { StatusBadge } from './QuotesStatus';

/** DD/MM/YYYY for the portal (design content rule). */
export const formatDate = (iso: string): string => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

function Block({ title, empty, children, href, more }: { title: string; empty: string; children?: React.ReactNode[]; href: string; more: string }) {
  return (
    <section className="card" aria-label={title}><div className="b">
      <h2 style={{ font: '600 20px/1.2 var(--font-display)' }}>{title}</h2>
      {children && children.length > 0 ? <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>{children}</ul> : <p>{empty}</p>}
      <Link className="more" href={href}>{more}</Link>
    </div></section>
  );
}

export function Overview({ title, visits, alerts, invoices, requests = [] }: { title: string; visits: Visit[]; alerts: Alert[]; invoices: Invoice[]; requests?: QuoteThread[]; locale: string }) {
  const t = useTranslations('portal.overview');
  const latest = [...invoices].sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <>
      <h1 style={{ marginBottom: 24 }}>{title}</h1>
      <div className="grid g2">
        <Block title={t('visits')} empty={t('noVisits')} href={`${ROUTES.account}/visits`} more={t('viewAll')}>
          {visits.filter((v) => v.status === 'Scheduled').slice(0, 3).map((v) => <li key={v.id}>{formatDate(v.date)} · {v.siteName} · {v.service}</li>)}
        </Block>
        <Block title={t('requests')} empty={t('noRequests')} href={`${ROUTES.account}/quotes`} more={t('viewAll')}>
          {requests.slice(0, 3).map((r) => <li key={r.id}>{r.reference} · {r.createdAt ? formatDate(r.createdAt) : ''} · <StatusBadge status={r.status} /></li>)}
        </Block>
        <Block title={t('invoice')} empty={t('noInvoices')} href={`${ROUTES.account}/invoices`} more={t('viewAll')}>
          {latest ? [<li key={latest.id}>{latest.number} · {formatDate(latest.date)} · {latest.status}</li>] : []}
        </Block>
        <Block title={t('alerts')} empty={t('noAlerts')} href={`${ROUTES.account}/documents`} more={t('viewAll')}>
          {alerts.map((a) => <li key={a.id}>{formatDate(a.date)} · {a.message}</li>)}
        </Block>
      </div>
      <p style={{ marginTop: 32 }}><LinkButton href={ROUTES.quote}>{t('newRequest')}</LinkButton></p>
    </>
  );
}
