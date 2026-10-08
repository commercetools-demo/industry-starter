import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { formatIsoDate } from '@/lib/format-date';
import { controlClassLabel } from '@/lib/funding/credential';
import { formatMoney } from '@/lib/utils';
import type { RxLineView } from '@/lib/types';

export interface MedicationRowProps {
  line: RxLineView;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Why a row cannot be selected, in words that say what remains. */
function useReason(line: RxLineView): string | null {
  const t = useTranslations('rx.reason');
  const tc = useTranslations('credentials.requirement');
  const locale = useLocale();
  if (line.selectable) return null;
  switch (line.status) {
    case 'CREDENTIAL':
      return tc(line.credential ?? 'NONE', { class: controlClassLabel(line.controlClass ?? 'controlled') });
    case 'NO_REFILLS':
      return line.remaining && line.remaining > 0 ? t('NO_REFILLS_SOME', { remaining: line.remaining }) : t('NO_REFILLS');
    case 'EXPIRED':
      return t('EXPIRED');
    case 'OUT_OF_STOCK':
      return t('OUT_OF_STOCK');
    case 'CEILING':
      return t(line.scope === 'period' ? 'CEILING_PERIOD' : 'CEILING_ORDER', { ceiling: line.ceiling ?? 0, remaining: line.remaining ?? 0 });
    case 'SHELF_LIFE':
      return t('SHELF_LIFE', { date: line.expiryDate ? formatIsoDate(line.expiryDate, locale) : '' });
    default:
      return null;
  }
}

/**
 * One medication of a prescription: checkbox, name, sig, quantity and pack price. A row that cannot be dispensed
 * keeps its place, is disabled and says why (the reason is linked to the checkbox for assistive technology).
 */
export function MedicationRow({ line, checked, onChange }: MedicationRowProps) {
  const t = useTranslations('rx');
  const locale = useLocale();
  const reason = useReason(line);
  const id = useId();
  const noteId = `${id}-note`;
  const notes = [
    reason,
    line.status === 'short-dated' && line.expiryDate ? t('shortDated', { date: formatIsoDate(line.expiryDate, locale) }) : null,
    line.minShelfLifeMonths ? t('shelfLife', { months: line.minShelfLifeMonths }) : null,
  ].filter((n): n is string => n !== null);
  return (
    <li
      className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 border-b border-border py-4 last:border-b-0 sm:grid-cols-[auto_1fr_auto_auto]"
      data-line={line.lineRef}
      data-status={line.status}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={!line.selectable}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={notes.length > 0 ? noteId : undefined}
        className="size-5 accent-brand-500 disabled:cursor-not-allowed"
      />
      <label htmlFor={id} className={line.selectable ? 'cursor-pointer' : 'cursor-not-allowed text-neutral-600'}>
        <b className="block text-navy-900">{line.name}</b>
        <span className="block text-sm text-neutral-600">{line.sig}</span>
      </label>
      <span className="text-sm text-neutral-600">{t('qty', { count: line.qty })}</span>
      <b className="text-navy-900">{line.price ? formatMoney(line.price.centAmount, line.price.currencyCode, locale) : ''}</b>
      {notes.length > 0 ? (
        <div id={noteId} className="col-start-2 col-end-[-1] flex flex-wrap gap-2 text-sm">
          {reason ? <Badge variant="no">{reason}</Badge> : null}
          {line.status === 'short-dated' && line.expiryDate ? <Badge variant="wait">{t('shortDated', { date: formatIsoDate(line.expiryDate, locale) })}</Badge> : null}
          {line.minShelfLifeMonths ? <span className="text-neutral-600">{t('shelfLife', { months: line.minShelfLifeMonths })}</span> : null}
        </div>
      ) : null}
    </li>
  );
}
