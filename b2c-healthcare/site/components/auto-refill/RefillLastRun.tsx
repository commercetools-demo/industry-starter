'use client';
import { useLocale, useTranslations } from 'next-intl';
import { formatIsoDate } from '@/lib/format-date';
import type { RefillLogView } from '@/lib/refill-types';

/**
 * "Last run: skipped (Nov 7, 2026), your prescription has expired." Says what the last scheduled check did and why, so
 * a refill that did not happen is never mistaken for an outage. Reason codes only: no medication, no RX number.
 */
export function RefillLastRun({ run }: { run: RefillLogView }) {
  const t = useTranslations('autoRefill.lastRun');
  const locale = useLocale();
  const date = formatIsoDate(run.runAt.slice(0, 10), locale);
  const text = run.outcome === 'allowed' ? t('allowed', { date }) : t(run.outcome, { date, reason: run.reason ? t(`reason.${run.reason}`) : '' });
  return (
    <p className={run.outcome === 'allowed' ? 'text-sm text-neutral-600' : 'text-sm font-medium text-warning-700'} data-last-run={run.outcome} data-reason={run.reason}>
      {text}
    </p>
  );
}
