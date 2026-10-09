import { useTranslations } from 'next-intl';
import type { Visit } from '@/lib/portal/data-source';
import { pick, sortRows, sortState, toQuery, type Dir, type SearchParams } from '@/lib/portal/list-query';
import { ROUTES } from '@/lib/site';
import { formatDate } from './Overview';
import { DataTable, DemoNote, DownloadLink, FilterForm, StatusBadge, type Tone } from './ListParts';

export const VISIT_STATUSES = ['Scheduled', 'In progress', 'Completed', 'Missed'] as const;
const TONE: Record<Visit['status'], Tone> = { Scheduled: 'info', 'In progress': 'warn', Completed: 'success', Missed: 'danger' };
const STATUS_KEY: Record<Visit['status'], string> = { Scheduled: 'scheduled', 'In progress': 'inProgress', Completed: 'completed', Missed: 'missed' };
const COLUMNS = ['date', 'site', 'service', 'status'] as const;
const BASE = `${ROUTES.account}/visits`;

/** Service visits: filters (`?site=&status=`) and sort (`?sort=&dir=`) live in the URL. */
export function VisitsList({ visits, params }: { visits: Visit[]; params: SearchParams }) {
  const t = useTranslations('portal.visits');
  const tl = useTranslations('portal.lists');
  const sites = [...new Map(visits.map((v) => [v.siteKey, v.siteName])).entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  const site = pick(params.site, sites.map((s) => s.value));
  const status = pick(params.status, VISIT_STATUSES);
  const { sort, dir } = sortState(params, COLUMNS, { sort: 'date', dir: 'desc' });
  const value = (v: Visit, key: string) => (key === 'site' ? v.siteName : key === 'service' ? v.service : key === 'status' ? v.status : v.date);
  const shown = sortRows(visits.filter((v) => (!site || v.siteKey === site) && (!status || v.status === status)), sort, dir, value);
  const href = (s: string, d: Dir) => `${BASE}${toQuery({ site, status, sort: s, dir: d })}`;
  const label = (c: string) => t(c);

  return (
    <>
      <h1 style={{ marginBottom: 24 }}>{t('title')}</h1>
      {visits.length === 0 ? <p>{t('empty')}</p> : (
        <>
          <FilterForm
            resetHref={BASE}
            hidden={{ sort: params.sort ? sort : '', dir: params.dir ? dir : '' }}
            fields={[
              { name: 'site', label: tl('site'), value: site, all: tl('allSites'), options: sites },
              { name: 'status', label: tl('status'), value: status, all: tl('allStatuses'), options: VISIT_STATUSES.map((s) => ({ value: s, label: t(`status.${STATUS_KEY[s]}`) })) },
            ]}
          />
          {shown.length === 0 ? <p>{tl('noMatch')}</p> : (
            <DataTable
              caption={t('caption', { count: shown.length })}
              sort={sort} dir={dir} sortHref={href}
              columns={[
                { key: 'date', label: label('date'), sortable: true }, { key: 'site', label: label('site'), sortable: true }, { key: 'service', label: label('service'), sortable: true },
                { key: 'status', label: label('statusColumn'), sortable: true }, { key: 'report', label: label('report') },
              ]}
              rows={shown.map((v) => ({
                id: v.id,
                cells: [
                  formatDate(v.date), v.siteName, v.service,
                  <StatusBadge key="s" tone={TONE[v.status]}>{t(`status.${STATUS_KEY[v.status]}`)}</StatusBadge>,
                  <DownloadLink key="r" href={v.reportUrl} label={t('downloadReport', { date: formatDate(v.date), site: v.siteName })}>{tl('download')}</DownloadLink>,
                ],
              }))}
            />
          )}
        </>
      )}
      <DemoNote />
    </>
  );
}
