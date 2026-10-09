'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LinkButton } from '@/components/ui/Button';
import { usePathname, useRouter } from '@/i18n/routing';
import { useQuotes } from '@/hooks/useQuotes';
import type { QuoteThread } from '@/lib/portal/types';
import { ROUTES } from '@/lib/site';
import { formatDate } from './Overview';
import { StatusBadge } from './QuotesStatus';

type Column = 'reference' | 'created' | 'services' | 'site' | 'status';
const VALUE: Record<Column, (t: QuoteThread) => string> = {
  reference: (t) => t.reference, created: (t) => t.createdAt, services: (t) => t.services.join(', '), site: (t) => t.site, status: (t) => t.status,
};
const SORT_BUTTON = { background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer' } as const;
const COLUMNS: Column[] = ['reference', 'created', 'services', 'site', 'status'];

/** Quote requests and quotes of the company as a sortable table; the site filter is kept in the URL (`?site=`). */
export function QuotesList() {
  const t = useTranslations('portal.quotes');
  const { threads, isLoading, failed } = useQuotes();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const site = params?.get('site') ?? '';
  const [sort, setSort] = useState<{ column: Column; dir: 'asc' | 'desc' }>({ column: 'created', dir: 'desc' });

  const sites = useMemo(() => [...new Set(threads.map((x) => x.site).filter(Boolean))].sort(), [threads]);
  const rows = useMemo(() => {
    const filtered = site ? threads.filter((x) => x.site === site) : threads;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => sign * VALUE[sort.column](a).localeCompare(VALUE[sort.column](b)));
  }, [threads, site, sort]);

  const setSite = (value: string) => router.replace(value ? `${pathname}?site=${encodeURIComponent(value)}` : pathname);
  const toggle = (column: Column) => setSort((s) => ({ column, dir: s.column === column && s.dir === 'asc' ? 'desc' : 'asc' }));

  return (
    <>
      <h1 style={{ marginBottom: 24 }}>{t('title')}</h1>
      {isLoading ? <p role="status">{t('loading')}</p> : null}
      {failed ? <p className="em" role="alert">{t('loadFailed')}</p> : null}
      {!isLoading && !failed && threads.length === 0 ? (
        <div className="card"><div className="b">
          <p>{t('empty')}</p>
          <p><LinkButton href={ROUTES.quote}>{t('requestCta')}</LinkButton></p>
        </div></div>
      ) : null}
      {threads.length > 0 ? (
        <>
          {sites.length > 1 || site ? (
            <div style={{ maxWidth: 320, marginBottom: 16 }}>
              <label htmlFor="quotes-site" style={{ fontWeight: 500, fontSize: 14, display: 'block', marginBottom: 6 }}>{t('siteFilter')}</label>
              <select id="quotes-site" value={site} onChange={(e) => setSite(e.target.value)}>
                <option value="">{t('allSites')}</option>
                {sites.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ) : null}
          <div style={{ overflowX: 'auto' }}>
            <table>
              <caption className="sr-only">{t('caption')}</caption>
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column} scope="col" aria-sort={sort.column === column ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => toggle(column)} aria-label={t('sortBy', { column: t(column) })} style={SORT_BUTTON}>
                        {t(column)}{sort.column === column ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    </th>
                  ))}
                  <th scope="col"><span className="sr-only">{t('actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><span className="num">{row.reference}</span></td>
                    <td>{row.createdAt ? formatDate(row.createdAt) : ''}</td>
                    <td>{row.services.join(', ')}</td>
                    <td>{row.site}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td><LinkButton small variant="outline" href={`${ROUTES.account}/quotes/${row.id}`} aria-label={t('viewAria', { reference: row.reference })}>{t('view')}</LinkButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? <p style={{ marginTop: 16 }}>{t('noMatch')}</p> : null}
        </>
      ) : null}
    </>
  );
}
