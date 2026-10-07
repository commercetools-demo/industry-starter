import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/account/format';
import { formatMoneyExact } from '@/lib/format';
import type { ContractRow, Locale } from '@/lib/types';

const HEAD = 'px-5 py-4 text-left font-display text-xs font-semibold uppercase tracking-ui';
const CELL = 'border-t border-border px-5 py-4 align-top text-md';

/** "Current contract": one row per recurring service, device installment or lease. Scrolls sideways inside its frame under 640 px. */
export function ContractTable({ rows }: { rows: ContractRow[] }): ReactElement {
  const t = useTranslations('account');
  const locale = useLocale() as Locale;

  const itemOf = (row: ContractRow): string =>
    row.deviceVariant ? t('device.variant', { name: row.name, memory: row.deviceVariant.memoryGb, color: t(`color.${row.deviceVariant.color}`) }) : row.name;

  const termOf = (row: ContractRow): string => {
    if (row.termMonths === null) return t('contract.unknownTerm');
    if (row.termMonths === 0) return t('contract.monthToMonth');
    return row.endsOn ? t('contract.term', { months: row.termMonths, date: formatDate(row.endsOn, locale) }) : t('contract.months', { months: row.termMonths });
  };

  return (
    <div role="region" aria-label={t('contract.title')} tabIndex={0} className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-160 border-collapse">
        <thead className="bg-neutral-50">
          <tr>
            <th scope="col" className={`${HEAD} w-[29%]`}>
              {t('contract.cols.item')}
            </th>
            <th scope="col" className={`${HEAD} w-[17%]`}>
              {t('contract.cols.type')}
            </th>
            <th scope="col" className={`${HEAD} w-[20%]`}>
              {t('contract.cols.started')}
            </th>
            <th scope="col" className={`${HEAD} w-[20%]`}>
              {t('contract.cols.term')}
            </th>
            <th scope="col" className={`${HEAD} w-[14%] text-right`}>
              {t('contract.cols.price')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className={`${CELL} text-left font-display font-semibold`}>
                {itemOf(row)}
              </th>
              <td className={CELL}>{t(`type.${row.family}`)}</td>
              <td className={CELL}>{formatDate(row.startedOn, locale)}</td>
              <td className={CELL}>{termOf(row)}</td>
              <td className={`${CELL} text-right font-display font-semibold`}>{t('contract.perMonth', { amount: formatMoneyExact(row.monthly, locale) })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The footnote under the table. */
export function ContractNote(): ReactElement {
  const t = useTranslations('account');
  return <p className="m-0 mt-3 text-sm text-text-muted">{t('contract.note')}</p>;
}
