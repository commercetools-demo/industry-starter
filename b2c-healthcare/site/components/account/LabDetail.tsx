import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { buttonClasses, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { statusVariant } from '@/components/ui/status';
import { Link } from '@/i18n/routing';
import type { LabDetailView } from '@/lib/account-types';
import { apiAccountLabPdf } from '@/lib/api-paths';
import { formatIsoDate } from '@/lib/format-date';
import type { LabFlag } from '@/lib/labs';
import { rangeLabel } from '@/lib/labs';
import { LabStatusBadge } from './LabRows';
import { RangeBar } from './RangeBar';

const FLAG_KEY = { normal: 'flagNormal', high: 'flagHigh', low: 'flagLow' } as const satisfies Record<LabFlag, string>;

/** Lab detail (design-account-area: Lab tests). A processing test shows the header and the note only. */
export function LabDetail({ lab }: { lab: LabDetailView }) {
  const t = useTranslations('account.labs');
  const locale = useLocale();
  const hasResults = lab.status === 'ready' && lab.results.length > 0;
  return (
    <div className="grid gap-5">
      <Link href="/account/labs" className="text-text-link">
        {t('back')}
      </Link>
      <Card className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold text-navy-900">{lab.name}</h1>
          <LabStatusBadge status={lab.status} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
          <dt className="text-text-muted">{t('collected')}</dt>
          <dd>{formatIsoDate(lab.collectedAt, locale)}</dd>
          {lab.orderedByName ? (
            <>
              <dt className="text-text-muted">{t('orderedBy')}</dt>
              <dd>{lab.orderedByName}</dd>
            </>
          ) : null}
          <dt className="text-text-muted">{t('laboratory')}</dt>
          <dd>{lab.laboratory}</dd>
        </dl>
        <p className="rounded-md bg-surface-brand-subtle p-4 text-sm text-text-body">{lab.note}</p>
      </Card>
      {hasResults ? (
        <>
          <div role="region" aria-label={t('resultsRegion')} tabIndex={0} className="overflow-x-auto rounded-lg bg-surface p-2 shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-text-muted">
                  <th scope="col" className="px-3 py-2.5 font-medium">{t('colTest')}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t('colResult')}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t('colRange')}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t('colFlag')}</th>
                </tr>
              </thead>
              <tbody>
                {lab.results.map((r) => {
                  const range = rangeLabel(r.low, r.high, r.unit);
                  const flag = t(FLAG_KEY[r.flag]);
                  return (
                    <tr key={r.name} className="border-t border-border" data-flag={r.flag}>
                      <th scope="row" className="px-3 py-3 font-medium text-navy-900">{r.name}</th>
                      <td className="px-3 py-3">
                        <b>{r.value}</b> <span className="text-text-muted">{r.unit}</span>
                      </td>
                      <td className="px-3 py-3">
                        <RangeBar value={r.value} low={r.low} high={r.high} flag={r.flag} label={t('rangeLabel', { name: r.name, value: r.value, unit: r.unit, range, flag })} />
                        <div className="mt-1.5 text-xs text-text-muted">{range}</div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={statusVariant(r.flag === 'normal' ? 'normal' : 'out-of-range')}>{flag}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* An authenticated GET to the server-generated PDF: the URL carries the lab id only, never a value. */}
            <a href={apiAccountLabPdf(lab.id)} download className={buttonClasses({ variant: 'outline', size: 'sm' })}>
              {t('downloadPdf')}
            </a>
            <ButtonLink href={`/doctor/${encodeURIComponent(lab.orderedByDoctorKey)}`} size="sm">
              {t('discuss')}
            </ButtonLink>
          </div>
        </>
      ) : null}
    </div>
  );
}
