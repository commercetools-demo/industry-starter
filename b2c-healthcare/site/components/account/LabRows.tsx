import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { statusVariant } from '@/components/ui/status';
import { Link } from '@/i18n/routing';
import type { LabListItem } from '@/lib/account-types';
import { formatIsoDate } from '@/lib/format-date';

/** Status badge of a lab test: "Results ready" (green) or "Processing" (amber). */
export function LabStatusBadge({ status }: { status: LabListItem['status'] }) {
  const t = useTranslations('account.labs');
  return <Badge variant={statusVariant(status === 'ready' ? 'ready' : 'processing')}>{status === 'ready' ? t('statusReady') : t('statusProcessing')}</Badge>;
}

/**
 * Rows of lab tests: name, date (and laboratory in the full list), status badge and an arrow. The whole row is one
 * link to the detail page (the prototype's clickable div is a defect). The detail URL carries the lab id only.
 */
export function LabRows({ labs, showLaboratory }: { labs: LabListItem[]; showLaboratory?: boolean }) {
  const t = useTranslations('account.labs');
  const locale = useLocale();
  return (
    <ul>
      {labs.map((lab) => {
        const date = formatIsoDate(lab.collectedAt, locale);
        return (
          <li key={lab.id} className="border-t border-border first:border-t-0">
            <Link
              href={`/account/labs/${encodeURIComponent(lab.id)}`}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 hover:bg-brand-50"
            >
              <span>
                <b className="block font-medium text-navy-900">{lab.name}</b>
                <span className="text-sm text-text-muted">{showLaboratory ? t('rowMeta', { date, laboratory: lab.laboratory }) : date}</span>
              </span>
              <LabStatusBadge status={lab.status} />
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
