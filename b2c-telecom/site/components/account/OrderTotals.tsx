import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatMoneyExact } from '@/lib/format';
import type { AcquisitionMode, Locale, Money, Order } from '@/lib/types';

const MODES: readonly AcquisitionMode[] = ['outright', 'installments', 'lease'];

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }): ReactElement {
  return (
    <div className={strong ? 'flex justify-between gap-5 font-display text-xl font-bold' : 'flex justify-between gap-5 text-md'}>
      <dt>{label}</dt>
      <dd className="m-0">{value}</dd>
    </div>
  );
}

/** "Due at order" (the order's own total) and "Monthly after that"; one line per acquisition mode only when the order mixes modes. */
export function OrderTotals({ order }: { order: Order }): ReactElement {
  const t = useTranslations('account');
  const locale = useLocale() as Locale;
  const fmt = (money: Money): string => formatMoneyExact(money, locale);
  const currencyCode = order.total.currencyCode;

  const perMode = MODES.map((mode) => {
    const lines = order.lines.filter((line) => line.acquisition?.mode === mode);
    return { mode, count: lines.length, amount: { centAmount: lines.reduce((sum, line) => sum + line.total.centAmount, 0), currencyCode } };
  }).filter((entry) => entry.count > 0);

  return (
    <div className="flex max-w-md flex-col gap-3 rounded-xl border border-border p-7">
      <dl className="m-0 flex flex-col gap-3">
        <Row label={t('order.dueAtOrder')} value={fmt(order.total)} strong />
        <Row label={t('order.monthlyAfter')} value={t('order.perMonth', { amount: fmt(order.monthly) })} />
      </dl>
      {perMode.length > 1 ? (
        <ul className="m-0 flex list-none flex-col gap-1 border-t border-border p-0 pt-3 text-sm text-text-muted">
          {perMode.map((entry) => (
            <li key={entry.mode}>{t(`order.modeTotal.${entry.mode}`, { amount: fmt(entry.amount) })}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
