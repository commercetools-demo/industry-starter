import { useTranslations } from 'next-intl';
import type { WasteDocument } from '@/lib/portal/data-source';
import { diversionRate, first, monthsWithNotes, pick, sortRows, sortState, toQuery, type Dir, type SearchParams } from '@/lib/portal/list-query';
import { ROUTES } from '@/lib/site';
import { formatDate } from './Overview';
import { DataTable, DemoNote, DownloadLink, FilterForm } from './ListParts';

const KIND_KEY: Record<WasteDocument['kind'], string> = { 'Transfer note': 'transferNote', 'Consignment note': 'consignmentNote', 'Annual report': 'annualReport' };
const COLUMNS = ['number', 'kind', 'date', 'site', 'wasteType'] as const;
const BASE = `${ROUTES.account}/documents`;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Waste documents and the diversion rate summary. Filters (`site`, `wasteType`, `from`, `to`), `month` and sort are in the URL. */
export function DocumentsList({ docs, params, locale }: { docs: WasteDocument[]; params: SearchParams; locale: string }) {
  const t = useTranslations('portal.documents');
  const tl = useTranslations('portal.lists');
  const sites = [...new Map(docs.map((d) => [d.siteKey, d.siteName])).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  const types = [...new Set(docs.map((d) => d.wasteType))].sort().map((v) => ({ value: v, label: v }));
  const site = pick(params.site, sites.map((s) => s.value));
  const wasteType = pick(params.wasteType, types.map((x) => x.value));
  const from = DAY.test(first(params.from)) ? first(params.from) : '';
  const to = DAY.test(first(params.to)) ? first(params.to) : '';
  const months = monthsWithNotes(docs);
  const month = pick(params.month, months) || months[0] || '';
  const { sort, dir } = sortState(params, COLUMNS, { sort: 'date', dir: 'desc' });
  const value = (d: WasteDocument, key: string) => (key === 'number' ? d.number : key === 'kind' ? d.kind : key === 'site' ? d.siteName : key === 'wasteType' ? d.wasteType : d.date);
  const shown = sortRows(docs.filter((d) => (!site || d.siteKey === site) && (!wasteType || d.wasteType === wasteType) && (!from || d.date >= from) && (!to || d.date <= to)), sort, dir, value);
  const href = (s: string, d: Dir) => `${BASE}${toQuery({ site, wasteType, from, to, month: params.month ? month : '', sort: s, dir: d })}`;
  const kg = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const pct = (rate: number | null) => (rate === null ? t('noRate') : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(rate / 100));
  const monthLabel = (m: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`));
  const div = month ? diversionRate(docs, month) : null;

  return (
    <>
      <h1 style={{ marginBottom: 24 }}>{t('title')}</h1>
      {docs.length === 0 ? <p>{t('empty')}</p> : (
        <>
          {div && (
            <section aria-labelledby="diversion-h" style={{ marginBottom: 32 }}>
              <h2 id="diversion-h" style={{ font: '600 20px/1.2 var(--font-display)', marginBottom: 8 }}>{t('diversionTitle')}</h2>
              <p className="hint" style={{ marginBottom: 12 }}>{t('diversionFormula')}</p>
              <DataTable
                caption={t('diversionCaption', { month: monthLabel(month) })}
                sort="" dir="asc" sortHref={() => ''}
                columns={[{ key: 'period', label: t('period') }, { key: 'recycled', label: t('recycledKg') }, { key: 'total', label: t('totalKg') }, { key: 'rate', label: t('diversionRate') }]}
                rows={[
                  { id: 'month', cells: [monthLabel(month), kg.format(div.month.recycledKg), kg.format(div.month.totalKg), <strong key="r">{pct(div.month.rate)}</strong>] },
                  { id: 'trailing', cells: [t('trailing'), kg.format(div.trailing.recycledKg), kg.format(div.trailing.totalKg), <strong key="r">{pct(div.trailing.rate)}</strong>] },
                ]}
              />
            </section>
          )}
          <FilterForm
            resetHref={BASE}
            hidden={{ sort: params.sort ? sort : '', dir: params.dir ? dir : '' }}
            fields={[
              { name: 'site', label: tl('site'), value: site, all: tl('allSites'), options: sites },
              { name: 'wasteType', label: t('wasteType'), value: wasteType, all: t('allWasteTypes'), options: types },
              { name: 'from', label: t('from'), value: from, type: 'date' },
              { name: 'to', label: t('to'), value: to, type: 'date' },
              { name: 'month', label: t('summaryMonth'), value: month, options: months.map((m) => ({ value: m, label: monthLabel(m) })) },
            ]}
          />
          {shown.length === 0 ? <p>{tl('noMatch')}</p> : (
            <DataTable
              caption={t('caption', { count: shown.length })}
              sort={sort} dir={dir} sortHref={href}
              columns={[
                { key: 'number', label: t('number'), sortable: true }, { key: 'kind', label: t('kind'), sortable: true }, { key: 'date', label: t('date'), sortable: true },
                { key: 'site', label: t('site'), sortable: true }, { key: 'wasteType', label: t('wasteType'), sortable: true }, { key: 'file', label: t('file') },
              ]}
              rows={shown.map((d) => ({
                id: d.id,
                cells: [d.number, t(`kinds.${KIND_KEY[d.kind]}`), formatDate(d.date), d.siteName, d.wasteType,
                  <DownloadLink key="f" href={d.fileUrl} label={t('downloadDocument', { number: d.number })}>{tl('download')}</DownloadLink>],
              }))}
            />
          )}
        </>
      )}
      <DemoNote />
    </>
  );
}
