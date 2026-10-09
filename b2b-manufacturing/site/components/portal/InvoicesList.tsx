import { useTranslations } from 'next-intl';
import type { Invoice } from '@/lib/portal/data-source';
import { pick, sortRows, sortState, toQuery, type Dir, type SearchParams } from '@/lib/portal/list-query';
import { ROUTES } from '@/lib/site';
import { formatMoney } from '@/lib/utils';
import { formatDate } from './Overview';
import { DataTable, DemoNote, DownloadLink, FilterForm, StatusBadge, type Tone } from './ListParts';

export const INVOICE_STATUSES = ['Paid', 'Due', 'Overdue'] as const;
const TONE: Record<Invoice['status'], Tone> = { Paid: 'success', Due: 'info', Overdue: 'danger' };
const STATUS_KEY: Record<Invoice['status'], string> = { Paid: 'paid', Due: 'due', Overdue: 'overdue' };
const COLUMNS = ['number', 'date', 'site', 'amount', 'status'] as const;
const BASE = `${ROUTES.account}/invoices`;

/** Invoices: read only, PDF download, no payment control (online payment is out of scope). */
export function InvoicesList({ invoices, params, locale }: { invoices: Invoice[]; params: SearchParams; locale: string }) {
  const t = useTranslations('portal.invoices');
  const tl = useTranslations('portal.lists');
  const sites = [...new Map(invoices.map((i) => [i.siteKey, i.siteName])).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  const site = pick(params.site, sites.map((s) => s.value));
  const status = pick(params.status, INVOICE_STATUSES);
  const { sort, dir } = sortState(params, COLUMNS, { sort: 'date', dir: 'desc' });
  const value = (i: Invoice, key: string) => (key === 'number' ? i.number : key === 'site' ? i.siteName : key === 'amount' ? i.amountCents : key === 'status' ? i.status : i.date);
  const shown = sortRows(invoices.filter((i) => (!site || i.siteKey === site) && (!status || i.status === status)), sort, dir, value);
  const href = (s: string, d: Dir) => `${BASE}${toQuery({ site, status, sort: s, dir: d })}`;
  const overdue = invoices.filter((i) => i.status === 'Overdue').length;

  return (
    <>
      <h1 style={{ marginBottom: 24 }}>{t('title')}</h1>
      {overdue > 0 && (
        <section aria-labelledby="overdue-h" style={{ border: '1px solid var(--sl-danger-fg)', background: 'var(--sl-danger-bg)', padding: 16, marginBottom: 24 }}>
          <h2 id="overdue-h" style={{ font: '600 16px var(--font-sans)', marginBottom: 4 }}>{t('overdueTitle', { count: overdue })}</h2>
          <p>{t('contactAccounts')}</p>
        </section>
      )}
      {invoices.length === 0 ? <p>{t('empty')}</p> : (
        <>
          <FilterForm
            resetHref={BASE}
            hidden={{ sort: params.sort ? sort : '', dir: params.dir ? dir : '' }}
            fields={[
              { name: 'site', label: tl('site'), value: site, all: tl('allSites'), options: sites },
              { name: 'status', label: tl('status'), value: status, all: tl('allStatuses'), options: INVOICE_STATUSES.map((s) => ({ value: s, label: t(`status.${STATUS_KEY[s]}`) })) },
            ]}
          />
          {shown.length === 0 ? <p>{tl('noMatch')}</p> : (
            <DataTable
              caption={t('caption', { count: shown.length })}
              sort={sort} dir={dir} sortHref={href}
              columns={[
                { key: 'number', label: t('number'), sortable: true }, { key: 'date', label: t('date'), sortable: true }, { key: 'site', label: t('site'), sortable: true },
                { key: 'amount', label: t('amount'), sortable: true }, { key: 'status', label: t('statusColumn'), sortable: true }, { key: 'pdf', label: t('pdf') },
              ]}
              rows={shown.map((i) => ({
                id: i.id,
                cells: [i.number, formatDate(i.date), i.siteName, formatMoney(i.amountCents, i.currency, locale),
                  <StatusBadge key="s" tone={TONE[i.status]}>{t(`status.${STATUS_KEY[i.status]}`)}</StatusBadge>,
                  <DownloadLink key="p" href={i.pdfUrl} label={t('downloadInvoice', { number: i.number })}>{tl('download')}</DownloadLink>],
              }))}
            />
          )}
          <p className="hint" style={{ marginTop: 16 }}>{t('noOnlinePayment')}</p>
          {overdue === 0 && <p className="hint">{t('contactAccounts')}</p>}
        </>
      )}
      <DemoNote />
    </>
  );
}
