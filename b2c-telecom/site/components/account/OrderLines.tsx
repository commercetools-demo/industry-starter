import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/account/format';
import { formatMoneyExact } from '@/lib/format';
import type { Locale, Money, Order, OrderLine } from '@/lib/types';

const HEAD = 'px-5 py-4 text-left font-display text-xs font-semibold uppercase tracking-ui';
const CELL = 'border-t border-border px-5 py-4 align-top text-md';

/** The items of an order: name (handsets with memory and colour), type, quantity, unit price and line total; "/mo" on recurring lines. */
export function OrderLines({ order }: { order: Order }): ReactElement {
  const t = useTranslations('account');
  const locale = useLocale() as Locale;
  const byId = new Map(order.lines.map((line) => [line.id, line]));
  const money = (value: Money, recurring: boolean): string => (recurring ? t('order.perMonth', { amount: formatMoneyExact(value, locale) }) : formatMoneyExact(value, locale));

  const nameOf = (line: OrderLine): string =>
    line.deviceVariant ? t('device.variant', { name: line.name, memory: line.deviceVariant.memoryGb, color: t(`color.${line.deviceVariant.color}`) }) : line.name;

  const acquisitionText = (line: OrderLine): string | null => {
    const acquisition = line.acquisition;
    if (!acquisition) return null;
    const months = acquisition.termMonths ?? 0;
    const mode = acquisition.mode === 'outright' ? t('order.modeOutright') : acquisition.mode === 'installments' ? t('order.modeInstallments', { months }) : t('order.modeLease', { months });
    if (!acquisition.endDate || acquisition.mode === 'outright') return mode;
    const end = acquisition.mode === 'installments' ? t('order.finalPayment', { date: formatDate(acquisition.endDate, locale) }) : t('order.returnBy', { date: formatDate(acquisition.endDate, locale) });
    return `${mode} · ${end}`;
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border" role="region" aria-label={t('order.itemsLabel')} tabIndex={0}>
      <table className="w-full min-w-160 border-collapse">
        <thead className="bg-neutral-50">
          <tr>
            <th scope="col" className={HEAD}>
              {t('order.cols.item')}
            </th>
            <th scope="col" className={HEAD}>
              {t('order.cols.type')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('order.cols.qty')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('order.cols.unit')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('order.cols.total')}
            </th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => {
            const parent = line.parentLineId ? byId.get(line.parentLineId) : undefined;
            const detail = acquisitionText(line);
            return (
              <tr key={line.id}>
                <th scope="row" className={`${CELL} text-left font-display font-semibold`}>
                  <span className="block">{nameOf(line)}</span>
                  {detail ? <span className="block font-body text-sm font-normal text-text-muted">{detail}</span> : null}
                  {parent ? <span className="block font-body text-sm font-normal text-text-muted">{t('order.partOf', { plan: parent.name })}</span> : null}
                </th>
                <td className={CELL}>{t(`type.${line.family}`)}</td>
                <td className={`${CELL} text-right`}>{line.quantity}</td>
                <td className={`${CELL} text-right`}>{money(line.unitPrice, line.recurring)}</td>
                <td className={`${CELL} text-right font-display font-semibold`}>{money(line.total, line.recurring)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
