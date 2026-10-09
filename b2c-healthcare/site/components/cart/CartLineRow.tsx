import { useLocale, useTranslations } from 'next-intl';
import { MedicineLink } from '@/components/medicine/MedicineLink';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { formatIsoDate } from '@/lib/format-date';
import { controlClassLabel } from '@/lib/funding/credential';
import { getLocalizedString } from '@/lib/utils';
import type { CartLine, CartLineProblem } from '@/lib/types';
import { CoverBadge, LinePrice } from './CoverFigures';

export interface CartLineRowProps {
  line: CartLine;
  busy: boolean;
  onRemove: (line: CartLine) => void;
}

function useReason(problem: CartLineProblem): string {
  const t = useTranslations('cart.reason');
  const tc = useTranslations('credentials.requirement');
  const locale = useLocale();
  switch (problem.reason) {
    case 'CREDENTIAL':
      return tc(problem.credential ?? 'NONE', { class: controlClassLabel(problem.credentialClass ?? 'controlled') });
    case 'CEILING':
      return t(problem.scope === 'period' ? 'CEILING_PERIOD' : 'CEILING_ORDER', { ceiling: problem.ceiling ?? 0 });
    case 'SHELF_LIFE':
      return t('SHELF_LIFE', { date: problem.expiryDate ? formatIsoDate(problem.expiryDate, locale) : '' });
    default:
      return t(problem.reason);
  }
}

function Reason({ problem, id }: { problem: CartLineProblem; id: string }) {
  const reason = useReason(problem);
  return (
    <p id={id} className="text-sm font-medium text-danger-700" data-unavailable={problem.reason}>
      {reason}
    </p>
  );
}

/**
 * One medication in the cart: name, "<RX number> · Qty N" (read-only: the quantity is what the doctor prescribed),
 * the platform's line total and a real Remove button. A line that can no longer be dispensed stays, struck through,
 * and says why; "Price updated" marks a unit price that changed since the previous visit.
 */
export function CartLineRow({ line, busy, onRemove }: CartLineRowProps) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const name = getLocalizedString(line.name, locale);
  const noteId = `line-${line.id}-note`;
  return (
    <li
      className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_auto_auto]"
      data-line={line.id}
      data-unavailable-line={line.unavailable ? 'true' : undefined}
    >
      <div>
        <b className={cx('font-medium text-text-heading', line.unavailable && 'text-neutral-600 line-through')}>
          <MedicineLink sku={line.sku} className="text-text-heading underline-offset-2 hover:underline">
            {name}
          </MedicineLink>
        </b>
        <div className="font-meta text-sm text-neutral-600">{t('rxQty', { rx: line.rxNumber, count: line.prescribedQty })}</div>
        {line.unavailable ? <Reason problem={line.unavailable} id={noteId} /> : null}
        <CoverBadge line={line} />
        {line.priceUpdated ? (
          <Badge variant="wait" className="mt-1">
            {t('priceUpdated')}
          </Badge>
        ) : null}
      </div>
      <LinePrice line={line} struck={Boolean(line.unavailable)} />
      <Button
        variant="outline"
        size="sm"
        className="col-span-2 justify-self-start sm:col-span-1"
        aria-label={t('removeLabel', { name })}
        aria-describedby={line.unavailable ? noteId : undefined}
        busy={busy}
        onClick={() => onRemove(line)}
      >
        {t('remove')}
      </Button>
    </li>
  );
}
