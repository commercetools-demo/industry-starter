import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/components/ui/cx';
import { formatMoney } from '@/lib/utils';
import type { CartLine } from '@/lib/types';

/**
 * Payer cost-share on a cart line (workstream U): what the patient owes and what the plan covers, both from the
 * platform/resolver figures on the line. "Not covered" (the plan answered: nothing covered) and "Cover unresolved"
 * (the plan could not be asked: no figure at all) look different on purpose.
 */

export function CoverBadge({ line }: { line: CartLine }) {
  const t = useTranslations('funding');
  if (line.cover === 'unresolved') {
    return (
      <Badge variant="wait" className="mt-1" data-cover="unresolved">
        {t('unresolved')}
      </Badge>
    );
  }
  if (line.cover === 'not-covered') {
    return (
      <Badge variant="neutral" className="mt-1" data-cover="not-covered">
        {t('notCovered')}
      </Badge>
    );
  }
  if (line.cover === 'covered') {
    return (
      <Badge variant="ok" className="mt-1" data-cover="covered">
        {t('fullyCovered')}
      </Badge>
    );
  }
  if (line.cover === 'partly') {
    return (
      <Badge variant="info" className="mt-1" data-cover="partly">
        {t('partlyCovered')}
      </Badge>
    );
  }
  return null;
}

/** The right-hand figure of a cart line: the line total, or both figures when a scheme applies, or no figure when unresolved. */
export function LinePrice({ line, struck }: { line: CartLine; struck: boolean }) {
  const t = useTranslations('funding');
  const locale = useLocale();
  const money = (m: { centAmount: number; currencyCode: string }) => formatMoney(m.centAmount, m.currencyCode, locale);
  if (line.cover === 'unresolved') {
    return (
      <span className="max-w-40 text-right text-sm font-medium text-warning-700" data-line-price data-cover-figure="unresolved">
        {t('unresolvedLine')}
      </span>
    );
  }
  const owed = line.youOwe;
  const covered = line.coveredAmount;
  if (line.cover === undefined || !owed || !covered) {
    return (
      <b className={cx('text-text-heading', struck && 'text-neutral-600 line-through')} data-line-price>
        {money(line.totalPrice)}
      </b>
    );
  }
  return (
    <span className={cx('grid justify-items-end gap-0.5 text-right', struck && 'text-neutral-600 line-through')} data-cover-figure={line.cover}>
      <b className="text-text-heading" data-line-price data-line-owed>
        {t('lineYouOwe', { amount: money(owed) })}
      </b>
      <span className="font-meta text-sm text-neutral-600" data-line-covered>
        {t('linePlanCovers', { amount: money(covered) })}
      </span>
    </span>
  );
}
